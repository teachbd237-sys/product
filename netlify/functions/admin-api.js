// POST /.netlify/functions/admin-api   { action, ...params }   Header: Authorization: Bearer <Supabase access token>
// Admin-এর সব সংবেদনশীল কাজ এখানে: Approve / Reject / Revoke / Code দেখা / Settings / Requirement।
// প্রতিটি Request-এ Server আবার যাচাই করে ব্যবহারকারী সত্যিই Admin কিনা।
import { db } from './_lib/supabase.js'
import { json, parseJson, wrap, HttpError } from './_lib/http.js'
import { requireAdmin } from './_lib/auth.js'
import { generateCode, hashCode, encryptCode, decryptCode } from './_lib/crypto.js'
import { formatCode } from '../../shared/codes.js'
import { audit } from './_lib/audit.js'
import { cleanText, cleanMultiline, isHttpUrl, isUuid, validateEmail, LIMITS } from '../../shared/validation.js'
import { PLATFORMS } from '../../shared/requirements.js'
import { SETTINGS_SCHEMA, validateSettingValue } from '../../shared/settingsSchema.js'

const rpcError = (error) => {
  const m = error?.message || ''
  if (m.includes('request_not_found') || m.includes('code_not_found')) return new HttpError(404, 'not_found', 'রিকোয়েস্ট বা কোড খুঁজে পাওয়া যায়নি।')
  if (m.includes('invalid_status')) return new HttpError(409, 'invalid_status', 'রিকোয়েস্টের বর্তমান অবস্থায় এই কাজটি করা যায় না। পেজ রিফ্রেশ করুন।')
  if (m.includes('already_redeemed')) return new HttpError(409, 'already_redeemed', 'কোডটি ইতোমধ্যে ব্যবহৃত হয়েছে, তাই বাতিল করা যায় না।')
  if (m.includes('already_revoked')) return new HttpError(409, 'already_revoked', 'কোডটি আগেই বাতিল করা হয়েছে।')
  if (m.includes('product_missing')) return new HttpError(409, 'product_missing', 'এই রিকোয়েস্টের প্রোডাক্ট আর নেই।')
  return error
}

async function newCodeFor(call) {
  // কোড-Hash Unique; অত্যন্ত অসম্ভাব্য সংঘর্ষে নতুন কোড বানিয়ে আবার চেষ্টা
  for (let i = 0; i < 3; i++) {
    const c = generateCode()
    const { data, error } = await call({ hash: hashCode(c.body), enc: encryptCode(c.body), hint: c.hint })
    if (!error) return { display: c.display, id: data }
    if (error.code === '23505' && String(error.message).includes('download_codes_hash_key')) continue
    throw rpcError(error)
  }
  throw new HttpError(500, 'server_error', 'কোড তৈরি করা যায়নি। আবার চেষ্টা করুন।')
}

const actions = {
  async approve(sb, admin, p) {
    if (!isUuid(p.requestId)) throw new HttpError(400, 'bad_request', 'অনুরোধ সঠিক নয়।')
    const out = await newCodeFor(({ hash, enc, hint }) =>
      sb.rpc('approve_download_request', { p_request_id: p.requestId, p_admin: admin.id, p_code_hash: hash, p_code_encrypted: enc, p_code_hint: hint }))
    return { code: out.display, codeId: out.id }
  },

  async reject(sb, admin, p) {
    if (!isUuid(p.requestId)) throw new HttpError(400, 'bad_request', 'অনুরোধ সঠিক নয়।')
    const reason = cleanText(p.reason, LIMITS.reasonMax)
    if (!reason) throw new HttpError(400, 'reason_required', 'বাতিলের কারণ লিখুন।')
    const { error } = await sb.rpc('reject_download_request', { p_request_id: p.requestId, p_admin: admin.id, p_reason: reason })
    if (error) throw rpcError(error)
    return { ok: true }
  },

  async revoke(sb, admin, p) {
    let codeId = p.codeId
    if (!codeId && isUuid(p.requestId)) {
      const { data } = await sb.from('download_codes').select('id').eq('request_id', p.requestId).eq('status', 'active').maybeSingle()
      codeId = data?.id
      if (!codeId) throw new HttpError(409, 'no_active_code', 'বাতিল করার মতো কোনো সক্রিয় কোড নেই।')
    }
    if (!isUuid(codeId)) throw new HttpError(400, 'bad_request', 'অনুরোধ সঠিক নয়।')
    const { error } = await sb.rpc('revoke_download_code', { p_code_id: codeId, p_admin: admin.id, p_reason: cleanText(p.reason, LIMITS.reasonMax) || null })
    if (error) throw rpcError(error)
    return { ok: true }
  },

  async regenerate(sb, admin, p) {
    if (!isUuid(p.requestId)) throw new HttpError(400, 'bad_request', 'অনুরোধ সঠিক নয়।')
    const reason = cleanText(p.reason, LIMITS.reasonMax) || null
    const out = await newCodeFor(({ hash, enc, hint }) =>
      sb.rpc('regenerate_download_code', { p_request_id: p.requestId, p_admin: admin.id, p_code_hash: hash, p_code_encrypted: enc, p_code_hint: hint, p_reason: reason }))
    return { code: out.display, codeId: out.id }
  },

  // একই কোড আবার WhatsApp-এ পাঠানোর জন্য (শুধু Active কোড; Audit Log থাকে)
  async 'reveal-code'(sb, admin, p) {
    if (!isUuid(p.requestId)) throw new HttpError(400, 'bad_request', 'অনুরোধ সঠিক নয়।')
    const { data, error } = await sb.from('download_codes').select('id, code_encrypted, product_id')
      .eq('request_id', p.requestId).eq('status', 'active').maybeSingle()
    if (error) throw error
    if (!data) throw new HttpError(404, 'no_active_code', 'কোনো সক্রিয় কোড নেই। কোড ব্যবহৃত বা বাতিল হয়ে থাকলে "নতুন কোড দিন" ব্যবহার করুন।')
    let body
    try { body = decryptCode(data.code_encrypted) } catch {
      throw new HttpError(409, 'decrypt_failed', 'কোডটি পড়া যায়নি (CODE_SECRET বদলে গেছে?)। "নতুন কোড দিন" ব্যবহার করুন।')
    }
    await audit({ actorType: 'admin', actorId: admin.id, action: 'code_revealed', requestId: p.requestId, codeId: data.id, productId: data.product_id })
    return { code: formatCode(body) }
  },

  async 'mark-sent'(sb, admin, p) {
    if (!isUuid(p.requestId)) throw new HttpError(400, 'bad_request', 'অনুরোধ সঠিক নয়।')
    const sent = p.sent !== false
    const { data, error } = await sb.from('download_requests')
      .update({ whatsapp_sent_at: sent ? new Date().toISOString() : null, whatsapp_sent_by: sent ? admin.id : null })
      .eq('id', p.requestId).in('status', ['approved', 'redeemed']).select('id').maybeSingle()
    if (error) throw error
    if (!data) throw new HttpError(409, 'invalid_status', 'শুধু অনুমোদিত রিকোয়েস্টে এটি করা যায়।')
    await audit({ actorType: 'admin', actorId: admin.id, action: sent ? 'whatsapp_marked_sent' : 'whatsapp_unmarked', requestId: p.requestId })
    return { ok: true }
  },

  async 'save-notes'(sb, admin, p) {
    if (!isUuid(p.requestId)) throw new HttpError(400, 'bad_request', 'অনুরোধ সঠিক নয়।')
    const notes = cleanMultiline(p.notes, LIMITS.noteMax)
    const { data, error } = await sb.from('download_requests').update({ admin_notes: notes || null }).eq('id', p.requestId).select('id').maybeSingle()
    if (error) throw error
    if (!data) throw new HttpError(404, 'not_found', 'রিকোয়েস্ট খুঁজে পাওয়া যায়নি।')
    return { ok: true }
  },

  async 'evidence-urls'(sb, admin, p) {
    if (!isUuid(p.requestId)) throw new HttpError(400, 'bad_request', 'অনুরোধ সঠিক নয়।')
    const { data: rows, error } = await sb.from('request_verification_evidence')
      .select('id, requirement_title, storage_path, mime_type, created_at').eq('request_id', p.requestId).order('created_at')
    if (error) throw error
    const items = []
    for (const r of rows || []) {
      const { data: s } = await sb.storage.from('verification-evidence').createSignedUrl(r.storage_path, 600)
      items.push({ id: r.id, title: r.requirement_title, url: s?.signedUrl || null })
    }
    return { items }
  },

  // খালি টেবিল Error নয় — { codes: [] } ফেরত যায়। আলাদা Query ব্যবহার হয় যাতে সম্পর্কিত রেকর্ড (প্রোডাক্ট/রিকোয়েস্ট)
  // মোছা বা অনুপস্থিত থাকলেও পেজ ভাঙে না। code_hash / code_encrypted কখনো ফেরত যায় না।
  async 'list-codes'(sb, admin, p) {
    let q = sb.from('download_codes')
      .select('id, status, code_hint, created_at, redeemed_at, revoked_at, revoke_reason, request_id, product_id')
      .order('created_at', { ascending: false }).limit(300)
    if (['active', 'redeemed', 'revoked'].includes(p.status)) q = q.eq('status', p.status)
    const { data, error } = await q
    if (error) throw error
    const codes = data || []
    const reqIds = [...new Set(codes.map((c) => c.request_id).filter(Boolean))]
    const prodIds = [...new Set(codes.map((c) => c.product_id).filter(Boolean))]
    const reqMap = new Map()
    const prodMap = new Map()
    if (reqIds.length) {
      const { data: rs, error: e1 } = await sb.from('download_requests')
        .select('id, request_ref, customer_name, whatsapp_sent_at, status').in('id', reqIds)
      if (e1) throw e1
      for (const r of rs || []) reqMap.set(r.id, r)
    }
    if (prodIds.length) {
      const { data: ps, error: e2 } = await sb.from('products').select('id, name, slug').in('id', prodIds)
      if (e2) throw e2
      for (const r of ps || []) prodMap.set(r.id, r)
    }
    return {
      codes: codes.map((c) => ({
        ...c,
        download_requests: reqMap.get(c.request_id) || null,
        products: prodMap.get(c.product_id) || null,
      })),
    }
  },

  async 'save-settings'(sb, admin, p) {
    if (!p.settings || typeof p.settings !== 'object') throw new HttpError(400, 'bad_request', 'অনুরোধ সঠিক নয়।')
    const helpers = { cleanText, cleanMultiline, isHttpUrl, validateEmail }
    const rows = []
    const errors = []
    for (const [key, raw] of Object.entries(p.settings)) {
      const r = validateSettingValue(key, raw, helpers)
      if (!r.ok) { errors.push(r.error); continue }
      rows.push({ key, value: r.value, is_public: SETTINGS_SCHEMA[key].public, updated_by: admin.id, updated_at: new Date().toISOString() })
    }
    if (errors.length) throw Object.assign(new HttpError(400, 'validation', errors[0]), { fieldErrors: errors })
    if (rows.length) {
      const { error } = await sb.from('website_settings').upsert(rows, { onConflict: 'key' })
      if (error) throw error
    }
    return { ok: true, saved: rows.length }
  },

  // Admin Panel-এর ভেরিফিকেশন ধাপ + প্রোডাক্ট তালিকা (Server-এ Admin যাচাই হয়ে তবেই)
  async 'list-requirements'(sb) {
    const [r, p] = await Promise.all([
      sb.from('verification_requirements').select('*').order('sort_order').order('created_at'),
      sb.from('products').select('id, name, status').neq('status', 'archived').order('name'),
    ])
    if (r.error) throw r.error
    if (p.error) throw p.error
    return { requirements: r.data || [], products: p.data || [] }
  },

  async 'upsert-requirement'(sb, admin, p) {
    const r = p.requirement
    if (!r || typeof r !== 'object' || Array.isArray(r)) throw new HttpError(400, 'validation', 'ফর্মের তথ্য পাওয়া যায়নি।')
    const title = cleanText(r.title, 120)
    const instruction = cleanText(r.instruction, 500)
    const url = typeof r.target_url === 'string' ? r.target_url.trim() : ''
    const label = cleanText(r.button_label, 40)
    const fieldErrors = {}
    if (!title) fieldErrors.title = 'শিরোনাম লিখুন।'
    if (!url) fieldErrors.target_url = 'সোশ্যাল মিডিয়া লিংক দিন।'
    else if (url.length > 500 || !isHttpUrl(url)) fieldErrors.target_url = 'সঠিক লিংক দিন (https:// দিয়ে শুরু)।'
    if (!label) fieldErrors.button_label = 'বাটনের লেখা দিন।'
    // Object.hasOwn: "toString" / "constructor" জাতীয় নাম যেন প্ল্যাটফর্ম হিসেবে পার না পায়
    if (typeof r.platform !== 'string' || !Object.hasOwn(PLATFORMS, r.platform)) fieldErrors.platform = 'প্ল্যাটফর্ম বেছে নিন।'
    if (r.product_id && !isUuid(r.product_id)) fieldErrors.product_id = 'প্রোডাক্ট সঠিক নয়।'
    if (r.id && !isUuid(r.id)) fieldErrors.id = 'ধাপ শনাক্ত করা যায়নি।'
    for (const k of ['is_enabled', 'requires_screenshot', 'is_mandatory']) {
      if (r[k] !== undefined && typeof r[k] !== 'boolean') fieldErrors[k] = 'অবৈধ মান।'
    }
    const sortNum = r.sort_order === undefined || r.sort_order === '' ? 0 : Number(r.sort_order)
    if (!Number.isInteger(sortNum) || Math.abs(sortNum) > 100000) fieldErrors.sort_order = 'ক্রম একটি পূর্ণসংখ্যা হতে হবে।'
    if (Object.keys(fieldErrors).length) {
      throw Object.assign(new HttpError(400, 'validation', Object.values(fieldErrors)[0]), { fieldErrors })
    }

    if (r.product_id) {
      const { data: prod, error: pe } = await sb.from('products').select('id').eq('id', r.product_id).maybeSingle()
      if (pe) throw pe
      if (!prod) throw new HttpError(400, 'validation', 'নির্বাচিত প্রোডাক্টটি আর নেই। পেজ রিফ্রেশ করুন।')
    }
    const row = {
      title, instruction, target_url: url, button_label: label, platform: r.platform,
      product_id: r.product_id || null,
      is_enabled: r.is_enabled !== false,
      requires_screenshot: r.requires_screenshot !== false,
      is_mandatory: r.is_mandatory !== false,
      sort_order: sortNum,
    }

    if (r.id) {
      const { data, error } = await sb.from('verification_requirements').update(row).eq('id', r.id).select('*').maybeSingle()
      if (error) throw error
      if (!data) throw new HttpError(404, 'not_found', 'ধাপটি খুঁজে পাওয়া যায়নি (হয়তো মুছে গেছে)। পেজ রিফ্রেশ করুন।')
      return { ok: true, id: data.id, requirement: data }
    }

    // Double-click / দুইবার Submit আটকানো: একই প্রোডাক্ট-স্কোপে একই শিরোনাম+লিংক থাকলে নতুন রো তৈরি হয় না
    let dq = sb.from('verification_requirements').select('id').eq('title', title).eq('target_url', url).eq('platform', r.platform)
    dq = row.product_id ? dq.eq('product_id', row.product_id) : dq.is('product_id', null)
    const { data: dup, error: de } = await dq.limit(1)
    if (de) throw de
    if (dup && dup.length) throw new HttpError(409, 'duplicate', 'একই শিরোনাম ও লিংকের ধাপ এই স্কোপে আগে থেকেই আছে।')

    const { data, error } = await sb.from('verification_requirements').insert(row).select('*').single()
    if (error) throw error
    return { ok: true, id: data.id, requirement: data }
  },

  async 'delete-requirement'(sb, admin, p) {
    if (!isUuid(p.id)) throw new HttpError(400, 'bad_request', 'অনুরোধ সঠিক নয়।')
    const { data, error } = await sb.from('verification_requirements').delete().eq('id', p.id).select('id')
    if (error) throw error
    if (!data || data.length === 0) throw new HttpError(404, 'not_found', 'ধাপটি আগেই মুছে গেছে। পেজ রিফ্রেশ করুন।')
    return { ok: true }
  },

  async 'reorder-requirements'(sb, admin, p) {
    if (!Array.isArray(p.ids) || p.ids.length > 100 || !p.ids.every(isUuid)) throw new HttpError(400, 'bad_request', 'অনুরোধ সঠিক নয়।')
    const results = await Promise.all(p.ids.map((id, i) =>
      sb.from('verification_requirements').update({ sort_order: (i + 1) * 10 }).eq('id', id)))
    const failed = results.find((x) => x.error)
    if (failed) throw failed.error
    return { ok: true }
  },
}

export const handler = wrap(async (event) => {
  const body = parseJson(event)
  const admin = await requireAdmin(event)
  const fn = Object.hasOwn(actions, body.action) ? actions[body.action] : null
  if (!fn) throw new HttpError(400, 'unknown_action', 'অজানা কাজ।')
  const result = await fn(db(), admin, body)
  return json(200, result)
})
