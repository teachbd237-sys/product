// POST /.netlify/functions/request-submit
// Customer-এর ফ্রি ডাউনলোড রিকোয়েস্ট জমা। সব যাচাই Server-এ হয়।
import { randomUUID } from 'node:crypto'
import { db } from './_lib/supabase.js'
import { json, parseJson, wrap, HttpError, clientIp } from './_lib/http.js'
import { rateLimit } from './_lib/ratelimit.js'
import { hashIp, hashLookup, randomBase32 } from './_lib/crypto.js'
import { audit } from './_lib/audit.js'
import { normalizePhone } from '../../shared/phone.js'
import { validateName, validateEmail, isUuid, detectImageType } from '../../shared/validation.js'
import { applicableRequirements } from '../../shared/requirements.js'
import { formatGroups } from '../../shared/codes.js'
import { DEFAULT_SETTINGS } from '../../shared/defaults.js'

const MAX_BODY = 6 * 1024 * 1024 // Netlify Function-এর সীমা ~6MB
const MAX_IMAGE_BYTES = 2.5 * 1024 * 1024
const MAX_EVIDENCE = 8
const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }

export const handler = wrap(async (event) => {
  const body = parseJson(event, MAX_BODY)
  const sb = db()
  const ip = clientIp(event)
  const ipHash = hashIp(ip)

  // Bot ধরার সহজ ফাঁদ: মানুষ এই লুকানো ফিল্ড পূরণ করে না
  if (typeof body.website === 'string' && body.website.trim() !== '') {
    throw new HttpError(400, 'invalid', 'অনুরোধটি গ্রহণ করা যায়নি।')
  }

  await rateLimit(`submit:ip:${ipHash}`, 5, 3600)
  await rateLimit(`submit:ip-day:${ipHash}`, 15, 86400)

  // ---- ইনপুট যাচাই ----
  const fieldErrors = {}
  const name = validateName(body.name)
  if (!name.ok) fieldErrors.name = 'আপনার সম্পূর্ণ নাম লিখুন (২-৮০ অক্ষর)।'
  const email = validateEmail(body.email)
  if (!email.ok) fieldErrors.email = 'সঠিক ইমেইল অ্যাড্রেস দিন।'
  const phone = normalizePhone(typeof body.whatsapp === 'string' ? body.whatsapp : '')
  if (!phone.ok) fieldErrors.whatsapp = 'সঠিক WhatsApp নম্বর দিন। বাংলাদেশি নম্বর হলে 01XXXXXXXXX, অন্য দেশের হলে + সহ কান্ট্রি কোড লিখুন।'
  if (body.confirmed !== true) fieldErrors.confirmed = 'নির্দেশনা সম্পন্ন করার নিশ্চিতকরণে টিক দিন।'
  if (!isUuid(body.productId)) fieldErrors.productId = 'প্রোডাক্ট নির্বাচন সঠিক নয়।'
  if (Object.keys(fieldErrors).length) throw Object.assign(new HttpError(400, 'validation', 'ফর্মে কিছু তথ্য সঠিক নয়।'), { fieldErrors })

  await rateLimit(`submit:email:${email.value}`, 3, 86400, 'এই ইমেইল থেকে আজ অনেকগুলো রিকোয়েস্ট এসেছে। আগামীকাল আবার চেষ্টা করুন।')

  // ---- প্রোডাক্ট ও প্রযোজ্য Requirement ----
  const { data: product, error: pErr } = await sb.from('products')
    .select('id, name, slug, status, verification_mode, file_path').eq('id', body.productId).eq('status', 'active').maybeSingle()
  if (pErr) throw pErr
  if (!product) throw new HttpError(404, 'product_not_found', 'প্রোডাক্টটি খুঁজে পাওয়া যায়নি।')

  const { data: allReqs, error: rErr } = await sb.from('verification_requirements').select('*').eq('is_enabled', true)
  if (rErr) throw rErr
  const reqs = applicableRequirements(product, allReqs)

  // ---- Screenshot যাচাই (ফাইলের আসল Type Magic Byte দিয়ে) ----
  const evidenceIn = Array.isArray(body.evidence) ? body.evidence : []
  if (evidenceIn.length > MAX_EVIDENCE) throw new HttpError(400, 'too_many_files', 'অনেকগুলো স্ক্রিনশট।')

  const byReq = new Map()
  for (const e of evidenceIn) {
    if (!e || !isUuid(e.requirementId) || typeof e.data !== 'string') throw new HttpError(400, 'bad_evidence', 'স্ক্রিনশট সঠিক নয়।')
    if (byReq.has(e.requirementId)) throw new HttpError(400, 'bad_evidence', 'একই ধাপের জন্য একাধিক স্ক্রিনশট দেওয়া হয়েছে।')
    byReq.set(e.requirementId, e)
  }
  const accepted = []
  for (const r of reqs) {
    if (!r.requires_screenshot) continue
    const e = byReq.get(r.id)
    if (!e) {
      if (r.is_mandatory) throw Object.assign(new HttpError(400, 'missing_screenshot', `"${r.title}" ধাপের স্ক্রিনশট আপলোড করুন।`), { requirementId: r.id })
      continue
    }
    const buf = Buffer.from(e.data, 'base64')
    if (buf.length === 0 || buf.length > MAX_IMAGE_BYTES) throw Object.assign(new HttpError(400, 'bad_image_size', `"${r.title}" ধাপের স্ক্রিনশটটি খুব বড় বা ফাঁকা (সর্বোচ্চ ২.৫ MB)।`), { requirementId: r.id })
    const type = detectImageType(buf)
    if (!type) throw Object.assign(new HttpError(400, 'bad_image_type', `"${r.title}" ধাপে শুধু JPG, PNG বা WEBP ছবি দিন।`), { requirementId: r.id })
    accepted.push({ req: r, buf, type })
    byReq.delete(r.id)
  }
  if (byReq.size > 0) throw new HttpError(400, 'bad_evidence', 'অপ্রযোজ্য ধাপের স্ক্রিনশট পাঠানো হয়েছে।')

  // ---- আগের চালু রিকোয়েস্ট আছে কিনা (Database-এর Unique Index-ও এটি আটকায়) ----
  const { data: dup, error: dErr } = await sb.from('download_requests').select('id')
    .eq('product_id', product.id).in('status', ['pending', 'approved'])
    .or(`customer_email.eq."${email.value}",whatsapp_number.eq."${phone.e164}"`).limit(1)
  if (dErr) throw dErr
  if (dup && dup.length) throw new HttpError(409, 'duplicate', 'এই প্রোডাক্টের জন্য আপনার একটি রিকোয়েস্ট ইতোমধ্যে চলমান আছে। অনুগ্রহ করে অপেক্ষা করুন।')

  // ---- রিকোয়েস্ট তৈরি ----
  const id = randomUUID()
  const lookupBody = randomBase32(16)
  const snapshot = reqs.map((r) => ({
    id: r.id, title: r.title, platform: r.platform, target_url: r.target_url,
    is_mandatory: r.is_mandatory, requires_screenshot: r.requires_screenshot,
  }))

  let requestRef = null
  for (let attempt = 0; attempt < 5 && !requestRef; attempt++) {
    const ref = 'SF-R' + randomBase32(8)
    const { error } = await sb.from('download_requests').insert({
      id, request_ref: ref, product_id: product.id, product_name: product.name,
      customer_name: name.value, customer_email: email.value, whatsapp_number: phone.e164,
      status: 'pending', requirements_snapshot: snapshot,
      lookup_secret_hash: hashLookup(lookupBody), ip_hash: ipHash,
    })
    if (!error) { requestRef = ref; break }
    const msg = `${error.message} ${error.details || ''}`
    if (error.code === '23505' && msg.includes('download_requests_ref_key')) continue
    if (error.code === '23505') throw new HttpError(409, 'duplicate', 'এই প্রোডাক্টের জন্য আপনার একটি রিকোয়েস্ট ইতোমধ্যে চলমান আছে। অনুগ্রহ করে অপেক্ষা করুন।')
    throw error
  }
  if (!requestRef) throw new HttpError(500, 'server_error', 'রিকোয়েস্ট তৈরি করা যায়নি। আবার চেষ্টা করুন।')

  // ---- Screenshot Private Bucket-এ আপলোড; ব্যর্থ হলে সব পরিষ্কার ----
  const uploaded = []
  try {
    for (let i = 0; i < accepted.length; i++) {
      const a = accepted[i]
      const path = `${id}/${i + 1}-${randomBase32(8).toLowerCase()}.${EXT[a.type]}`
      const { error: upErr } = await sb.storage.from('verification-evidence').upload(path, a.buf, { contentType: a.type, upsert: false })
      if (upErr) throw upErr
      uploaded.push(path)
      const { error: insErr } = await sb.from('request_verification_evidence').insert({
        request_id: id, requirement_id: a.req.id, requirement_title: a.req.title,
        storage_path: path, mime_type: a.type, size_bytes: a.buf.length,
      })
      if (insErr) throw insErr
    }
  } catch (e) {
    console.error('[submit-upload]', e?.message)
    if (uploaded.length) await sb.storage.from('verification-evidence').remove(uploaded)
    await sb.from('download_requests').delete().eq('id', id)
    throw new HttpError(500, 'upload_failed', 'স্ক্রিনশট আপলোড করা যায়নি। আবার চেষ্টা করুন।')
  }

  await audit({ actorType: 'customer', action: 'request_submitted', requestId: id, productId: product.id, ipHash })

  return json(200, {
    ok: true,
    requestRef,
    lookupSecret: formatGroups(lookupBody),
    status: 'pending',
    message: DEFAULT_SETTINGS.msg_submitted,
  })
})
