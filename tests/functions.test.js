import test from 'node:test'
import assert from 'node:assert/strict'

process.env.CODE_SECRET = 'test-secret-test-secret-test-secret-1234'
process.env.SUPABASE_URL = 'http://localhost'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'x'

const { __setDbForTests } = await import('../netlify/functions/_lib/supabase.js')
const crypto = await import('../netlify/functions/_lib/crypto.js')
const submit = (await import('../netlify/functions/request-submit.js')).handler
const status = (await import('../netlify/functions/request-status.js')).handler
const redeem = (await import('../netlify/functions/code-redeem.js')).handler
const download = (await import('../netlify/functions/download-file.js')).handler
const admin = (await import('../netlify/functions/admin-api.js')).handler
const { normalizeCode, CODE_ALPHABET } = await import('../shared/codes.js')

const PRODUCT = { id: '11111111-1111-4111-8111-111111111111', name: 'Glitch Pack', slug: 'glitch-pack', status: 'active', verification_mode: 'global', file_path: 'g.zip' }
const REQ_YT = { id: '22222222-2222-4222-8222-222222222222', title: 'YouTube', platform: 'youtube', target_url: 'https://y.t', is_enabled: true, product_id: null, sort_order: 1, requires_screenshot: true, is_mandatory: true }
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1]), Buffer.alloc(200, 1)])

// ছোট্ট নকল Supabase Client: Query Builder + rpc + storage + auth
function fakeDb(cfg = {}) {
  const log = { inserts: [], rpcs: [], uploads: [], removed: [], deletes: [], upserts: [] }
  const tables = {
    products: () => ({ data: PRODUCT, error: null }),
    verification_requirements: () => ({ data: [REQ_YT], error: null }),
    download_requests: (st) => (st.op === 'select' ? { data: cfg.requestRow ?? [], error: null } : { data: null, error: null }),
    ...(cfg.tables || {}),
  }
  const from = (t) => {
    const st = { t, op: 'select', payload: null }
    const b = new Proxy({}, {
      get(_, prop) {
        if (prop === 'then') return (res, rej) => Promise.resolve(run()).then(res, rej)
        if (prop === 'maybeSingle' || prop === 'single') return () => Promise.resolve(run(true))
        if (prop === 'insert') return (p) => { st.op = 'insert'; st.payload = p; log.inserts.push([t, p]); return b }
        if (prop === 'upsert') return (p) => { st.op = 'upsert'; log.upserts.push([t, p]); return b }
        if (prop === 'delete') return () => { st.op = 'delete'; log.deletes.push(t); return b }
        if (prop === 'update') return (p) => { st.op = 'update'; st.payload = p; return b }
        return () => b
      },
    })
    function run(single) {
      const r = (tables[t] || (() => ({ data: [], error: null })))(st)
      if (single && Array.isArray(r.data)) return { data: r.data[0] ?? null, error: r.error }
      return r
    }
    return b
  }
  return {
    log,
    from,
    rpc: async (name, args) => {
      log.rpcs.push([name, args])
      if (cfg.rpc?.[name]) return cfg.rpc[name](args)
      if (name === 'check_rate_limit') return { data: true, error: null }
      return { data: null, error: null }
    },
    storage: {
      from: () => ({
        upload: async (path) => { if (cfg.uploadFails) return { error: { message: 'fail' } }; log.uploads.push(path); return { error: null } },
        remove: async (p) => { log.removed.push(p); return {} },
        createSignedUrl: async () => (cfg.signFails ? { data: null, error: { message: 'x' } } : { data: { signedUrl: 'https://signed.example/file' }, error: null }),
      }),
    },
    auth: { getUser: async (tok) => cfg.users?.[tok] ? { data: { user: cfg.users[tok] }, error: null } : { data: null, error: { message: 'bad' } } },
  }
}

const ev = (body, extra = {}) => ({ httpMethod: 'POST', headers: { host: 'site.test', origin: 'https://site.test', 'x-nf-client-connection-ip': '1.2.3.4', ...(extra.headers || {}) }, body: JSON.stringify(body) })
const parse = (r) => JSON.parse(r.body)
const validBody = () => ({
  productId: PRODUCT.id, name: 'রহিম উদ্দিন', email: 'Rahim@Example.com', whatsapp: '01712345678', confirmed: true,
  evidence: [{ requirementId: REQ_YT.id, mime: 'image/jpeg', data: JPEG.toString('base64') }],
})

test('crypto: codes are unique, well-formed, hashed and encrypt/decrypt round-trips', () => {
  const seen = new Set()
  for (let i = 0; i < 2000; i++) {
    const c = crypto.generateCode()
    assert.match(c.display, /^SF-[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}$/)
    assert.ok([...c.body].every((ch) => CODE_ALPHABET.includes(ch)))
    assert.equal(normalizeCode(c.display), c.body)
    seen.add(c.body)
  }
  assert.equal(seen.size, 2000)
  const c = crypto.generateCode()
  const enc = crypto.encryptCode(c.body)
  assert.ok(!enc.includes(c.body))
  assert.equal(crypto.decryptCode(enc), c.body)
  assert.notEqual(crypto.encryptCode(c.body), enc) // প্রতিবার আলাদা IV
  assert.throws(() => crypto.decryptCode(enc.slice(0, -2) + 'AA'))
  assert.equal(crypto.hashCode(c.body), crypto.hashCode(c.body))
  assert.notEqual(crypto.hashCode(c.body), c.body)
  assert.notEqual(crypto.hashCode(c.body), crypto.hashToken(c.body)) // আলাদা Key-Domain
})

test('crypto: Math.random is never used in server code', async () => {
  const { readFileSync, readdirSync } = await import('node:fs')
  for (const dir of ['netlify/functions', 'netlify/functions/_lib', 'shared']) {
    for (const f of readdirSync(dir).filter((x) => x.endsWith('.js'))) {
      assert.ok(!readFileSync(`${dir}/${f}`, 'utf8').includes('Math.random'), `${dir}/${f} uses Math.random`)
    }
  }
})

test('submit: rejects wrong method and cross-origin browser requests', async () => {
  __setDbForTests(fakeDb())
  assert.equal((await submit({ httpMethod: 'GET', headers: {}, body: '' })).statusCode, 405)
  assert.equal((await submit(ev(validBody(), { headers: { origin: 'https://evil.test' } }))).statusCode, 403)
})

test('submit: validation errors are field-specific and nothing is stored', async () => {
  const db = fakeDb(); __setDbForTests(db)
  const r = await submit(ev({ ...validBody(), name: 'A', email: 'bad', whatsapp: '123', confirmed: false }))
  assert.equal(r.statusCode, 400)
  const b = parse(r)
  assert.ok(b.fieldErrors.name && b.fieldErrors.email && b.fieldErrors.whatsapp && b.fieldErrors.confirmed)
  assert.equal(db.log.inserts.length, 0)
})

test('submit: honeypot, bad product id, missing / fake screenshots are rejected', async () => {
  __setDbForTests(fakeDb())
  assert.equal((await submit(ev({ ...validBody(), website: 'http://spam' }))).statusCode, 400)
  assert.equal(parse(await submit(ev({ ...validBody(), productId: "1' or 1=1" }))).fieldErrors.productId !== undefined, true)
  const noShot = await submit(ev({ ...validBody(), evidence: [] }))
  assert.equal(parse(noShot).error, 'missing_screenshot')
  const exe = Buffer.concat([Buffer.from([0x4d, 0x5a, 0x90, 0, 3, 0, 0, 0, 4, 0, 0, 0]), Buffer.alloc(100)])
  const fake = await submit(ev({ ...validBody(), evidence: [{ requirementId: REQ_YT.id, mime: 'image/jpeg', data: exe.toString('base64') }] }))
  assert.equal(parse(fake).error, 'bad_image_type') // Content-Type মিথ্যা বললেও ধরা পড়ে
  const extra = await submit(ev({ ...validBody(), evidence: [...validBody().evidence, { requirementId: '33333333-3333-4333-8333-333333333333', data: JPEG.toString('base64') }] }))
  assert.equal(parse(extra).error, 'bad_evidence')
})

test('submit: success stores normalized data, hashed secret, evidence; returns reference + key', async () => {
  const db = fakeDb(); __setDbForTests(db)
  const r = await submit(ev(validBody()))
  assert.equal(r.statusCode, 200)
  const b = parse(r)
  assert.match(b.requestRef, /^SF-R[0-9A-Z]{8}$/)
  assert.match(b.lookupSecret, /^[0-9A-Z]{4}(-[0-9A-Z]{4}){3}$/)
  const row = db.log.inserts.find(([t]) => t === 'download_requests')[1]
  assert.equal(row.whatsapp_number, '+8801712345678')
  assert.equal(row.customer_email, 'rahim@example.com')
  assert.equal(row.status, 'pending')
  assert.notEqual(row.lookup_secret_hash, b.lookupSecret.replace(/-/g, ''))
  assert.ok(!JSON.stringify(row).includes(b.lookupSecret.replace(/-/g, '')))
  assert.equal(db.log.uploads.length, 1)
  assert.match(db.log.uploads[0], /^[0-9a-f-]{36}\/1-[0-9a-z]{8}\.jpg$/)
  assert.ok(db.log.inserts.some(([t]) => t === 'request_verification_evidence'))
})

test('submit: duplicate and rate-limit and upload failure paths', async () => {
  __setDbForTests(fakeDb({ tables: { download_requests: () => ({ data: [{ id: 'x' }], error: null }) } }))
  assert.equal(parse(await submit(ev(validBody()))).error, 'duplicate')

  __setDbForTests(fakeDb({ rpc: { check_rate_limit: () => ({ data: false, error: null }) } }))
  assert.equal((await submit(ev(validBody()))).statusCode, 429)

  __setDbForTests(fakeDb({ rpc: { check_rate_limit: () => ({ data: null, error: { message: 'down' } }) } }))
  assert.equal((await submit(ev(validBody()))).statusCode, 503) // Rate limit ব্যর্থ => বন্ধ (fail closed)

  const db = fakeDb({ uploadFails: true }); __setDbForTests(db)
  const r = await submit(ev(validBody()))
  assert.equal(r.statusCode, 500)
  assert.equal(parse(r).error, 'upload_failed')
  assert.ok(db.log.deletes.includes('download_requests')) // অর্ধেক-তৈরি রিকোয়েস্ট মুছে যায়
  assert.ok(!r.body.includes('"fail"') && !r.body.includes('message":"fail')) // ভিতরের Error বাইরে যায় না
})

test('status: needs reference AND secret; wrong secret and unknown ref look identical; no PII', async () => {
  const lookup = 'ABCD2345EFGH6789'
  const row = { request_ref: 'SF-RAAAAAAAA', status: 'approved', product_name: 'Glitch Pack', lookup_secret_hash: crypto.hashLookup(lookup),
    rejection_reason: null, whatsapp_sent_at: null, created_at: '2026-01-01', products: { slug: 'glitch-pack' },
    customer_email: 'secret@x.com', whatsapp_number: '+8801712345678', customer_name: 'Secret Name' }
  __setDbForTests(fakeDb({ requestRow: [row] }))
  const ok = parse(await status(ev({ requestRef: 'SF-RAAAAAAAA', lookupSecret: 'abcd-2345-efgh-6789' })))
  assert.equal(ok.status, 'approved')
  const text = JSON.stringify(ok)
  for (const leak of ['secret@x.com', '+8801712345678', 'Secret Name', 'lookup_secret_hash']) assert.ok(!text.includes(leak), leak)
  const wrong = await status(ev({ requestRef: 'SF-RAAAAAAAA', lookupSecret: 'ZZZZ2345EFGH6789' }))
  __setDbForTests(fakeDb({ requestRow: [] }))
  const unknown = await status(ev({ requestRef: 'SF-RBBBBBBBB', lookupSecret: 'ABCD2345EFGH6789' }))
  assert.equal(wrong.statusCode, 404); assert.equal(unknown.statusCode, 404)
  assert.equal(wrong.body, unknown.body)
  assert.equal((await status(ev({ requestRef: 'SF-RAAAAAAAA' }))).statusCode, 404)
})

test('redeem: raw code never reaches the database; only HMAC hash does', async () => {
  const db = fakeDb({ rpc: { redeem_download_code: () => ({ data: { result: 'ok', product_name: 'G', product_version: '1', expires_at: 'x', remaining: 3 }, error: null }) } })
  __setDbForTests(db)
  const token = 'a'.repeat(43)
  const r = await redeem(ev({ productId: PRODUCT.id, code: 'sf-abcd-2345-efgh-6789', token }))
  assert.equal(parse(r).result, 'ok')
  const args = db.log.rpcs.find(([n]) => n === 'redeem_download_code')[1]
  assert.equal(args.p_code_hash, crypto.hashCode('ABCD2345EFGH6789'))
  assert.ok(!JSON.stringify(args).includes('ABCD2345EFGH6789'))
  assert.equal(args.p_token_hash, crypto.hashToken(token))
  assert.ok(!JSON.stringify(args).includes(token))
  assert.equal(args.p_product_id, PRODUCT.id)
})

test('redeem: malformed code => invalid without DB redeem call; bad token/product => 400; results pass through', async () => {
  const db = fakeDb(); __setDbForTests(db)
  assert.equal(parse(await redeem(ev({ productId: PRODUCT.id, code: 'nonsense', token: 'a'.repeat(43) }))).result, 'invalid')
  assert.ok(!db.log.rpcs.some(([n]) => n === 'redeem_download_code'))
  assert.equal((await redeem(ev({ productId: PRODUCT.id, code: 'x', token: 'short' }))).statusCode, 400)
  assert.equal((await redeem(ev({ productId: 'nope', code: 'x', token: 'a'.repeat(43) }))).statusCode, 400)
  for (const res of ['used', 'revoked', 'invalid', 'unavailable']) {
    __setDbForTests(fakeDb({ rpc: { redeem_download_code: () => ({ data: { result: res }, error: null }) } }))
    assert.equal(parse(await redeem(ev({ productId: PRODUCT.id, code: 'SF-ABCD-2345-EFGH-6789', token: 'a'.repeat(43) }))).result, res)
  }
  // Redeem-এর Rate limit
  __setDbForTests(fakeDb({ rpc: { check_rate_limit: () => ({ data: false, error: null }) } }))
  assert.equal((await redeem(ev({ productId: PRODUCT.id, code: 'SF-ABCD-2345-EFGH-6789', token: 'a'.repeat(43) }))).statusCode, 429)
})

test('download-file: signed URL on ok; refunds the attempt if signing fails; no URL otherwise', async () => {
  const consume = () => ({ data: { result: 'ok', file_path: 'g.zip', product_slug: 'glitch-pack', product_name: 'G', remaining: 2, expires_at: 'x' }, error: null })
  __setDbForTests(fakeDb({ rpc: { consume_download_authorization: consume } }))
  const ok = parse(await download(ev({ token: 'b'.repeat(43) })))
  assert.equal(ok.result, 'ok'); assert.ok(ok.url.startsWith('https://signed'))

  const db = fakeDb({ rpc: { consume_download_authorization: consume }, signFails: true }); __setDbForTests(db)
  const bad = await download(ev({ token: 'b'.repeat(43) }))
  assert.equal(bad.statusCode, 500)
  assert.ok(db.log.rpcs.some(([n]) => n === 'refund_download_authorization'))

  for (const res of ['exhausted', 'expired', 'invalid']) {
    __setDbForTests(fakeDb({ rpc: { consume_download_authorization: () => ({ data: { result: res }, error: null }) } }))
    const r = parse(await download(ev({ token: 'b'.repeat(43) })))
    assert.equal(r.result, res); assert.equal(r.url, undefined)
  }
  assert.equal((await download(ev({ token: 'x' }))).statusCode, 400)
})

test('admin-api: requires a real admin session on every call', async () => {
  const adminUser = { id: 'aaaaaaaa-0000-4000-8000-000000000001' }
  const base = { users: { 'good-token': adminUser, 'user-token': { id: 'bbbbbbbb-0000-4000-8000-000000000002' } },
    tables: { admins: (st) => ({ data: [], error: null }) } }
  __setDbForTests(fakeDb(base))
  const call = (body, token) => admin(ev(body, { headers: token ? { authorization: `Bearer ${token}` } : {} }))
  assert.equal((await call({ action: 'approve', requestId: PRODUCT.id })).statusCode, 401)
  assert.equal((await call({ action: 'approve', requestId: PRODUCT.id }, 'bogus')).statusCode, 401)
  assert.equal((await call({ action: 'approve', requestId: PRODUCT.id }, 'user-token')).statusCode, 403) // লগইন আছে, Admin নয়
  assert.equal((await call({ action: 'list-codes' }, 'user-token')).statusCode, 403)
  assert.equal((await call({ action: 'save-settings', settings: { site_name: 'Hacked' } }, 'user-token')).statusCode, 403)
})

test('admin-api: approve stores only hash + ciphertext, returns display code that decrypts consistently', async () => {
  const adminUser = { id: 'aaaaaaaa-0000-4000-8000-000000000001' }
  const db = fakeDb({
    users: { t: adminUser },
    tables: { admins: () => ({ data: [{ user_id: adminUser.id }], error: null }) },
    rpc: { approve_download_request: () => ({ data: 'code-id-1', error: null }) },
  })
  __setDbForTests(db)
  const r = await admin(ev({ action: 'approve', requestId: PRODUCT.id }, { headers: { authorization: 'Bearer t' } }))
  assert.equal(r.statusCode, 200)
  const { code } = parse(r)
  const body = normalizeCode(code)
  const args = db.log.rpcs.find(([n]) => n === 'approve_download_request')[1]
  assert.equal(args.p_code_hash, crypto.hashCode(body))
  assert.equal(crypto.decryptCode(args.p_code_encrypted), body)
  assert.ok(!JSON.stringify(args).includes(body))
  assert.equal(args.p_code_hint, body.slice(-4))
  assert.equal(args.p_admin, adminUser.id)
})

test('admin-api: DB status conflicts become friendly 409s; settings validated server-side; unknown action 400', async () => {
  const adminUser = { id: 'aaaaaaaa-0000-4000-8000-000000000001' }
  const mk = (rpc) => fakeDb({ users: { t: adminUser }, tables: { admins: () => ({ data: [{ user_id: adminUser.id }], error: null }) }, rpc })
  const h = { headers: { authorization: 'Bearer t' } }
  __setDbForTests(mk({ approve_download_request: () => ({ data: null, error: { message: 'invalid_status:rejected' } }) }))
  const r = await admin(ev({ action: 'approve', requestId: PRODUCT.id }, h))
  assert.equal(r.statusCode, 409); assert.ok(!r.body.includes('invalid_status:rejected'))
  __setDbForTests(mk({}))
  assert.equal((await admin(ev({ action: 'reject', requestId: PRODUCT.id, reason: '' }, h))).statusCode, 400)
  assert.equal((await admin(ev({ action: 'save-settings', settings: { social_youtube: 'javascript:alert(1)' } }, h))).statusCode, 400)
  assert.equal((await admin(ev({ action: 'save-settings', settings: { evil_key: 'x' } }, h))).statusCode, 400)
  assert.equal((await admin(ev({ action: 'save-settings', settings: { whatsapp_template: 'no code here' } }, h))).statusCode, 400)
  assert.equal((await admin(ev({ action: 'constructor' }, h))).statusCode, 400)
  assert.equal((await admin(ev({ action: '__proto__' }, h))).statusCode, 400)
  const db = mk({}); __setDbForTests(db)
  assert.equal((await admin(ev({ action: 'save-settings', settings: { site_name: 'My Store', whatsapp_template: 'কোড {code}' } }, h))).statusCode, 200)
  const rows = db.log.upserts.find(([t]) => t === 'website_settings')[1]
  assert.equal(rows.find((x) => x.key === 'whatsapp_template').is_public, false) // টেমপ্লেট কখনো Public নয়
  assert.equal(rows.find((x) => x.key === 'site_name').is_public, true)
})

test('server not configured => generic 500, no secrets in response', async () => {
  const saved = process.env.CODE_SECRET
  delete process.env.CODE_SECRET
  __setDbForTests(fakeDb({ rpc: { redeem_download_code: () => ({ data: { result: 'ok' }, error: null }) } }))
  const r = await redeem(ev({ productId: PRODUCT.id, code: 'SF-ABCD-2345-EFGH-6789', token: 'a'.repeat(43) }))
  process.env.CODE_SECRET = saved
  assert.equal(r.statusCode, 500)
  assert.ok(!r.body.includes('CODE_SECRET'))
})
