// Production-fix টেস্ট: WebSocket ক্র্যাশের রিগ্রেশন, Node কনফিগ, Error নিরাপত্তা, ভেরিফিকেশন-ধাপ CRUD, ডাউনলোড-কোড তালিকা।
// এখানে একটি ছোট In-memory Database ব্যবহার হয় (আসল Supabase নয়) — Live Supabase/Netlify-তে Deploy-এর পর
// DEPLOYMENT_GUIDE_BANGLA.md-এর "লাইভ যাচাই" ধাপগুলো আলাদাভাবে করতে হবে।
import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'

process.env.CODE_SECRET = 'test-secret-test-secret-test-secret-1234'
process.env.SUPABASE_URL = 'https://example-project.supabase.co'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-test-key'

const sbMod = await import('../netlify/functions/_lib/supabase.js')
const { __setDbForTests, RealtimeOff } = sbMod
const admin = (await import('../netlify/functions/admin-api.js')).handler
const { wrap, HttpError } = await import('../netlify/functions/_lib/http.js')
const { classify } = await import('../netlify/functions/_lib/errors.js')
const { applicableRequirements } = await import('../shared/requirements.js')

// ---------------------------------------------------------------------------------------------
// ছোট In-memory Supabase: select/insert/update/delete/eq/neq/is/in/order/limit/maybeSingle/single
// ---------------------------------------------------------------------------------------------
function memDb({ seed = {}, users = {}, fail = {} } = {}) {
  const tables = {}
  for (const [k, v] of Object.entries(seed)) tables[k] = v.map((r) => ({ ...r }))
  const log = { calls: [] }
  const from = (t) => {
    tables[t] ||= []
    const st = { op: 'select', filters: [], payload: null, cols: null, returning: false, order: null, lim: null }
    const proj = (r) => (st.cols ? Object.fromEntries(st.cols.map((c) => [c, r[c]])) : { ...r })
    const exec = (mode) => {
      log.calls.push([t, st.op])
      const injected = fail[t]?.[st.op]
      if (injected) return { data: null, error: injected }
      let rows = tables[t].filter((r) => st.filters.every((f) => f(r)))
      if (st.order) rows = [...rows].sort((a, b) => (a[st.order.c] > b[st.order.c] ? 1 : a[st.order.c] < b[st.order.c] ? -1 : 0) * (st.order.asc ? 1 : -1))
      if (st.lim != null) rows = rows.slice(0, st.lim)
      let out
      if (st.op === 'select') out = rows.map(proj)
      else if (st.op === 'insert') {
        const arr = (Array.isArray(st.payload) ? st.payload : [st.payload]).map((p) => ({ id: randomUUID(), created_at: new Date().toISOString(), ...p }))
        tables[t].push(...arr); out = arr.map(proj)
      } else if (st.op === 'update') { rows.forEach((r) => Object.assign(r, st.payload)); out = rows.map(proj) }
      else if (st.op === 'delete') { tables[t] = tables[t].filter((r) => !rows.includes(r)); out = rows.map(proj) }
      if (st.op !== 'select' && !st.returning) out = null
      if (mode === 'maybe') return { data: Array.isArray(out) ? out[0] ?? null : out, error: null }
      if (mode === 'single') return Array.isArray(out) && out[0] ? { data: out[0], error: null } : { data: null, error: { code: 'PGRST116', message: 'no rows' } }
      return { data: out, error: null }
    }
    const b = {
      select(cols) { if (st.op === 'select') st.cols = cols && !cols.includes('(') && cols !== '*' ? cols.split(',').map((x) => x.trim()) : null; else st.returning = true; return b },
      insert(p) { st.op = 'insert'; st.payload = p; return b },
      update(p) { st.op = 'update'; st.payload = p; return b },
      delete() { st.op = 'delete'; return b },
      eq(c, v) { st.filters.push((r) => r[c] === v); return b },
      neq(c, v) { st.filters.push((r) => r[c] !== v); return b },
      is(c, v) { st.filters.push((r) => (r[c] ?? null) === v); return b },
      in(c, arr) { st.filters.push((r) => arr.includes(r[c])); return b },
      order(c, o = {}) { st.order = { c, asc: o.ascending !== false }; return b },
      limit(n) { st.lim = n; return b },
      maybeSingle: () => Promise.resolve(exec('maybe')),
      single: () => Promise.resolve(exec('single')),
      then: (res, rej) => Promise.resolve(exec()).then(res, rej),
    }
    return b
  }
  return {
    tables, log, from,
    rpc: async () => ({ data: true, error: null }),
    storage: { from: () => ({ createSignedUrl: async () => ({ data: { signedUrl: 'https://signed.example/x' }, error: null }) }) },
    auth: {
      getUser: async (tok) => {
        if (users.__outage) return { data: null, error: { message: 'fetch failed', status: 0 } }
        return users[tok] ? { data: { user: users[tok] }, error: null } : { data: null, error: { message: 'invalid JWT', status: 401 } }
      },
    },
  }
}

const ADMIN = { id: 'aaaaaaaa-0000-4000-8000-000000000001' }
const OTHER = { id: 'bbbbbbbb-0000-4000-8000-000000000002' }
const P1 = '11111111-1111-4111-8111-111111111111'
const P2 = '33333333-3333-4333-8333-333333333333'

function setup(extra = {}) {
  const db = memDb({
    seed: {
      admins: [{ user_id: ADMIN.id }],
      products: [{ id: P1, name: 'Glitch Pack', slug: 'glitch', status: 'active', verification_mode: 'global' }, { id: P2, name: 'Zoom Pack', slug: 'zoom', status: 'active', verification_mode: 'combined' }],
      ...(extra.seed || {}),
    },
    users: { adm: ADMIN, usr: OTHER, ...(extra.users || {}) },
    fail: extra.fail || {},
  })
  __setDbForTests(db)
  return db
}
const ev = (body, token = 'adm') => ({
  httpMethod: 'POST',
  headers: { host: 'site.test', origin: 'https://site.test', ...(token ? { authorization: `Bearer ${token}` } : {}) },
  body: JSON.stringify(body),
})
const call = async (body, token) => { const r = await admin(ev(body, token)); return { status: r.statusCode, body: JSON.parse(r.body) } }
const goodReq = (over = {}) => ({
  title: 'YouTube চ্যানেল Subscribe করুন', instruction: 'Subscribe করে স্ক্রিনশট নিন।', platform: 'youtube',
  target_url: 'https://www.youtube.com/@storyframe', button_label: 'চ্যানেল খুলুন',
  product_id: null, is_enabled: true, is_mandatory: true, requires_screenshot: true, sort_order: 10, ...over,
})

// ============================== ১. WebSocket ক্র্যাশের রিগ্রেশন ==============================
test('REGRESSION: server client is created even when the runtime has NO native WebSocket', async () => {
  const { createClient } = await import('@supabase/supabase-js')
  const desc = Object.getOwnPropertyDescriptor(globalThis, 'WebSocket')
  delete globalThis.WebSocket
  try {
    assert.equal(typeof globalThis.WebSocket, 'undefined')
    // নিয়ন্ত্রণ-পরীক্ষা: সাধারণ createClient() এই অবস্থায় আসলেই ক্র্যাশ করে (Production Log-এর হুবহু বার্তা)
    assert.throws(() => createClient('https://x.supabase.co', 'k'), /native WebSocket not found/)
    // আমাদের db() ক্র্যাশ করে না
    __setDbForTests(undefined)
    const client = sbMod.db()
    assert.equal(typeof client.from, 'function')
    assert.equal(typeof client.auth.getUser, 'function')
    // Realtime কেউ ব্যবহার করতে গেলে নীরবে নয়, স্পষ্ট Error
    assert.throws(() => new RealtimeOff(), /Realtime/)
  } finally {
    if (desc) Object.defineProperty(globalThis, 'WebSocket', desc)
    __setDbForTests(undefined)
  }
})

test('config: Node 22 is pinned consistently (netlify.toml cannot silently override it back to 20)', () => {
  const toml = readFileSync('netlify.toml', 'utf8')
  const m = toml.match(/^\s*NODE_VERSION\s*=\s*"(\d+)/m)
  assert.ok(m, 'netlify.toml-এ NODE_VERSION নেই')
  assert.ok(Number(m[1]) >= 22, `netlify.toml NODE_VERSION=${m[1]} (কমপক্ষে 22 লাগবে)`)
  assert.ok(Number(readFileSync('.nvmrc', 'utf8').trim().split('.')[0]) >= 22, '.nvmrc 22+ নয়')
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'))
  assert.match(pkg.engines.node, />=\s*22/)
  assert.match(pkg.scripts.prebuild, /check-node/)
  assert.equal(pkg.scripts.build, 'vite build')
  assert.match(toml, /functions\s*=\s*"netlify\/functions"/)
  assert.match(toml, /publish\s*=\s*"dist"/)
})

// ============================== ২. Error নিরাপত্তা ও শ্রেণিবিন্যাস ==============================
test('errors: classify() separates network / permission / validation / schema / storage / config', () => {
  assert.equal(classify(Object.assign(new Error('TypeError: fetch failed'), {})).kind, 'network')
  assert.equal(classify({ code: '42501', message: 'permission denied for table x' }).status, 403)
  assert.equal(classify({ code: '23505', message: 'dup' }).status, 409)
  assert.equal(classify({ code: '23514', message: 'check' }).status, 400)
  const schema = classify({ code: 'PGRST204', message: "Could not find the 'category' column of 'products' in the schema cache" })
  assert.equal(schema.error, 'schema_mismatch')
  assert.ok(!schema.message.includes('category'), 'ভিতরের Column নাম ব্যবহারকারীকে দেখানো হয়নি')
  assert.equal(classify({ name: 'StorageApiError', __isStorageError: true, message: 'x' }).error, 'storage_error')
  assert.equal(classify(new sbMod.ConfigError('SUPABASE_SERVICE_ROLE_KEY missing')).error, 'server_not_configured')
  assert.equal(classify(new Error('boom')).status, 500)
})

test('errors: wrap() hides internals but returns a safe errorId; HttpError passes through', async () => {
  const secret = 'postgres://user:SuperSecretPw@db.internal:5432/x'
  const origErr = console.error; const logged = []; console.error = (...a) => logged.push(a.join(' '))
  try {
    const r = await wrap(async () => { throw Object.assign(new Error(secret), { stack: 'at /var/task/secret.js:1' }) })({})
    const body = JSON.parse(r.body)
    assert.equal(r.statusCode, 500)
    assert.match(body.errorId, /^E-[0-9A-F]{8}$/)
    assert.ok(!r.body.includes('SuperSecretPw') && !r.body.includes('secret.js') && !r.body.includes('postgres://'))
    assert.ok(logged.some((l) => l.includes(body.errorId)), 'errorId দিয়ে Log-এ খুঁজে পাওয়া যায়')
    const v = await wrap(async () => { throw new HttpError(400, 'validation', 'ভুল তথ্য') })({})
    assert.deepEqual(JSON.parse(v.body), { error: 'validation', message: 'ভুল তথ্য' })
    const net = await wrap(async () => { throw new Error('fetch failed') })({})
    assert.equal(net.statusCode, 503)
  } finally { console.error = origErr }
})

test('auth: Supabase outage is 503 (not a fake "logged out" 401); invalid token is 401; non-admin is 403', async () => {
  setup({ users: { __outage: true } })
  assert.equal((await call({ action: 'list-codes' }, 'adm')).status, 503)
  setup()
  assert.equal((await call({ action: 'list-codes' }, 'wrong')).status, 401)
  assert.equal((await call({ action: 'list-codes' }, null)).status, 401)
  assert.equal((await call({ action: 'list-codes' }, 'usr')).status, 403)
  for (const action of ['list-requirements', 'upsert-requirement', 'delete-requirement', 'reorder-requirements', 'list-codes', 'reveal-code', 'mark-sent']) {
    assert.equal((await call({ action }, 'usr')).status, 403, `${action} must be admin-only`)
    assert.equal((await call({ action }, null)).status, 401, `${action} must need a session`)
  }
})

// ============================== ৩. ভেরিফিকেশন ধাপ CRUD ==============================
test('requirements: create → list → edit → disable → delete (full CRUD)', async () => {
  const db = setup()
  const c = await call({ action: 'upsert-requirement', requirement: goodReq() })
  assert.equal(c.status, 200)
  assert.match(c.body.id, /^[0-9a-f-]{36}$/)
  assert.equal(db.tables.verification_requirements.length, 1)
  const stored = db.tables.verification_requirements[0]
  assert.equal(stored.is_enabled, true); assert.equal(stored.product_id, null); assert.equal(stored.platform, 'youtube')

  const l = await call({ action: 'list-requirements' })
  assert.equal(l.status, 200)
  assert.equal(l.body.requirements.length, 1)
  assert.equal(l.body.products.length, 2)

  const e = await call({ action: 'upsert-requirement', requirement: goodReq({ id: c.body.id, title: 'নতুন শিরোনাম', requires_screenshot: false }) })
  assert.equal(e.status, 200)
  assert.equal(db.tables.verification_requirements[0].title, 'নতুন শিরোনাম')
  assert.equal(db.tables.verification_requirements[0].requires_screenshot, false)
  assert.equal(db.tables.verification_requirements.length, 1, 'edit নতুন রো বানায়নি')

  const d = await call({ action: 'upsert-requirement', requirement: goodReq({ id: c.body.id, is_enabled: false, title: 'নতুন শিরোনাম', requires_screenshot: false }) })
  assert.equal(d.status, 200)
  assert.equal(db.tables.verification_requirements[0].is_enabled, false)
  assert.equal(applicableRequirements({ id: P1, verification_mode: 'global' }, db.tables.verification_requirements).length, 0, 'বন্ধ ধাপ গ্রাহক দেখে না')

  assert.equal((await call({ action: 'delete-requirement', id: c.body.id })).status, 200)
  assert.equal(db.tables.verification_requirements.length, 0)
  assert.equal((await call({ action: 'delete-requirement', id: c.body.id })).status, 404)
  assert.equal((await call({ action: 'upsert-requirement', requirement: goodReq({ id: c.body.id }) })).status, 404, 'মুছে যাওয়া ধাপ Edit করলে নীরব সফলতা নয়')
})

test('requirements: every field is validated server-side with field-level Bangla errors; nothing stored', async () => {
  const db = setup()
  const bad = await call({ action: 'upsert-requirement', requirement: goodReq({ title: '   ', target_url: '', button_label: '', platform: 'nope' }) })
  assert.equal(bad.status, 400)
  assert.ok(bad.body.fieldErrors.title && bad.body.fieldErrors.target_url && bad.body.fieldErrors.button_label && bad.body.fieldErrors.platform)
  for (const url of ['javascript:alert(1)', 'ftp://x.y/z', 'not a url', 'https://' + 'a'.repeat(600) + '.com']) {
    const r = await call({ action: 'upsert-requirement', requirement: goodReq({ target_url: url }) })
    assert.equal(r.status, 400, `url ${url.slice(0, 20)} rejected`)
  }
  for (const platform of ['toString', 'constructor', '__proto__', 42, null]) {
    assert.equal((await call({ action: 'upsert-requirement', requirement: goodReq({ platform }) })).status, 400, `platform ${String(platform)} rejected`)
  }
  assert.equal((await call({ action: 'upsert-requirement', requirement: goodReq({ product_id: 'not-a-uuid' }) })).status, 400)
  assert.equal((await call({ action: 'upsert-requirement', requirement: goodReq({ product_id: '99999999-9999-4999-8999-999999999999' }) })).status, 400, 'অস্তিত্বহীন প্রোডাক্ট')
  assert.equal((await call({ action: 'upsert-requirement', requirement: goodReq({ is_enabled: 'yes' }) })).status, 400)
  assert.equal((await call({ action: 'upsert-requirement', requirement: goodReq({ sort_order: 'abc' }) })).status, 400)
  assert.equal((await call({ action: 'upsert-requirement' })).status, 400)
  assert.equal((await call({ action: 'upsert-requirement', requirement: [] })).status, 400)
  assert.equal(db.tables.verification_requirements?.length || 0, 0)
})

test('requirements: double-submit does not create duplicates; same rule for another scope is allowed', async () => {
  const db = setup()
  assert.equal((await call({ action: 'upsert-requirement', requirement: goodReq() })).status, 200)
  const again = await call({ action: 'upsert-requirement', requirement: goodReq() })
  assert.equal(again.status, 409); assert.equal(again.body.error, 'duplicate')
  assert.equal(db.tables.verification_requirements.length, 1)
  assert.equal((await call({ action: 'upsert-requirement', requirement: goodReq({ product_id: P2 }) })).status, 200, 'প্রোডাক্ট-নির্দিষ্ট স্কোপ আলাদা')
  assert.equal(db.tables.verification_requirements.length, 2)
})

test('requirements: global rules apply to global-mode products; product rules stay independent', async () => {
  const db = setup()
  await call({ action: 'upsert-requirement', requirement: goodReq({ title: 'Global YT', target_url: 'https://y.t/1' }) })
  await call({ action: 'upsert-requirement', requirement: goodReq({ title: 'Only P2', target_url: 'https://y.t/2', platform: 'facebook_page', product_id: P2 }) })
  const all = db.tables.verification_requirements
  const titles = (mode, id) => applicableRequirements({ id, verification_mode: mode }, all).map((r) => r.title)
  assert.deepEqual(titles('global', P1), ['Global YT'])
  assert.deepEqual(titles('global', P2), ['Global YT'], 'global মোডে নিজস্ব ধাপ আসে না')
  assert.deepEqual(titles('custom', P2), ['Only P2'])
  assert.deepEqual(titles('custom', P1), [], 'অন্য প্রোডাক্টের ধাপ P1-এ আসে না')
  assert.deepEqual(titles('combined', P2).sort(), ['Global YT', 'Only P2'])
  assert.deepEqual(titles('none', P2), [])
})

test('requirements: DB failures become safe, classified responses (not raw messages)', async () => {
  const origErr = console.error; console.error = () => {}
  try {
    setup({ fail: { verification_requirements: { insert: { code: '23514', message: 'new row violates check constraint "verification_requirements_target_url_check"' } } } })
    const a = await call({ action: 'upsert-requirement', requirement: goodReq() })
    assert.equal(a.status, 400); assert.ok(!JSON.stringify(a.body).includes('check constraint'))
    setup({ fail: { verification_requirements: { insert: { code: '42501', message: 'permission denied for table verification_requirements' } } } })
    const b = await call({ action: 'upsert-requirement', requirement: goodReq() })
    assert.equal(b.status, 403); assert.equal(b.body.error, 'db_permission'); assert.match(b.body.errorId, /^E-/)
    setup({ fail: { verification_requirements: { select: { code: 'PGRST205', message: "Could not find the table 'public.verification_requirements' in the schema cache" } } } })
    const c = await call({ action: 'list-requirements' })
    assert.equal(c.status, 500); assert.equal(c.body.error, 'schema_mismatch')
    assert.ok(!JSON.stringify(c.body).includes('public.verification_requirements'))
  } finally { console.error = origErr }
})

// ============================== ৪. ডাউনলোড কোড তালিকা ==============================
test('list-codes: EMPTY table is a normal 200 with codes: [] (never a server error)', async () => {
  setup()
  const r = await call({ action: 'list-codes' })
  assert.equal(r.status, 200); assert.deepEqual(r.body, { codes: [] })
  assert.deepEqual((await call({ action: 'list-codes', status: 'redeemed' })).body, { codes: [] })
})

test('list-codes: joins product + request, tolerates missing related rows, filters by status, never leaks hash/ciphertext', async () => {
  const REQ1 = 'cccccccc-0000-4000-8000-000000000001'
  const GONE = 'dddddddd-0000-4000-8000-000000000009'
  const mk = (n, over) => ({ id: `eeeeeeee-0000-4000-8000-00000000000${n}`, status: 'active', code_hint: `ABC${n}`, code_hash: 'SECRETHASH' + n, code_encrypted: 'SECRETCIPHER' + n,
    created_at: `2026-10-0${n}T00:00:00Z`, redeemed_at: null, revoked_at: null, revoke_reason: null, request_id: REQ1, product_id: P1, ...over })
  setup({ seed: {
    download_requests: [{ id: REQ1, request_ref: 'SF-RAAAAAAAA', customer_name: 'রহিম', whatsapp_sent_at: '2026-10-02T00:00:00Z', status: 'approved' }],
    download_codes: [mk(1), mk(2, { status: 'redeemed', redeemed_at: '2026-10-03T00:00:00Z' }), mk(3, { request_id: GONE, product_id: '99999999-9999-4999-8999-999999999999', status: 'revoked', revoke_reason: 'ভুল' })],
  } })
  const all = await call({ action: 'list-codes' })
  assert.equal(all.status, 200); assert.equal(all.body.codes.length, 3)
  const raw = JSON.stringify(all.body)
  assert.ok(!raw.includes('SECRETHASH') && !raw.includes('SECRETCIPHER') && !raw.includes('code_hash') && !raw.includes('code_encrypted'))
  const first = all.body.codes.find((c) => c.code_hint === 'ABC1')
  assert.equal(first.download_requests.request_ref, 'SF-RAAAAAAAA'); assert.equal(first.products.name, 'Glitch Pack')
  assert.equal(first.download_requests.whatsapp_sent_at, '2026-10-02T00:00:00Z')
  const orphan = all.body.codes.find((c) => c.code_hint === 'ABC3')
  assert.equal(orphan.download_requests, null); assert.equal(orphan.products, null) // পেজ ক্র্যাশ করে না
  assert.equal((await call({ action: 'list-codes', status: 'redeemed' })).body.codes.length, 1)
  assert.equal((await call({ action: 'list-codes', status: 'active' })).body.codes.length, 1)
  assert.equal((await call({ action: 'list-codes', status: 'bogus' })).body.codes.length, 3, 'অবৈধ ফিল্টার উপেক্ষিত')
})

test('list-codes: a REAL database failure is an error response (so the UI can show retry, not an empty table)', async () => {
  const origErr = console.error; console.error = () => {}
  try {
    setup({ fail: { download_codes: { select: { code: '', message: 'fetch failed' } } } })
    const r = await call({ action: 'list-codes' })
    assert.equal(r.status, 503); assert.equal(r.body.error, 'db_unreachable'); assert.ok(r.body.message)
  } finally { console.error = origErr }
})

// ============================== ৫. Frontend সংযোগ-যাচাই (Static) ==============================
test('frontend: Download Codes page uses the required empty-state text and separates errors from empty', () => {
  const src = readFileSync('src/pages/admin/AdminCodes.jsx', 'utf8')
  assert.ok(src.includes('এখনো কোনো ডাউনলোড কোড তৈরি হয়নি।'))
  assert.match(src, /\{err &&/); assert.match(src, /!err &&/)
  assert.ok(!/setCodes\(\[\]\)[^}]*empty/.test(src))
})

test('frontend: admin pages no longer swallow query errors silently', () => {
  for (const f of ['AdminRequirements', 'AdminProducts', 'AdminSettings', 'AdminLegacyOrders']) {
    const src = readFileSync(`src/pages/admin/${f}.jsx`, 'utf8')
    assert.match(src, /describeError/, `${f} uses describeError`)
    assert.match(src, /আবার চেষ্টা করুন/, `${f} offers retry`)
  }
  // Settings: লোড ব্যর্থ হলে ডিফল্ট ফর্ম দেখানো যাবে না (আসল সেটিংস ডিফল্ট দিয়ে ওভাররাইটের ঝুঁকি)
  const st = readFileSync('src/pages/admin/AdminSettings.jsx', 'utf8')
  assert.ok(st.indexOf('if (loadErr)') < st.indexOf('if (!vals)'))
})
