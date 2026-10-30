// POST /.netlify/functions/download-file
// শুধু বৈধ Download Authorization (token) থাকলে ২ মিনিটের একটি Signed URL দেয়।
// Product ফাইল Private Bucket-এ; স্থায়ী Public লিংক কোথাও নেই।
import { db } from './_lib/supabase.js'
import { json, parseJson, wrap, HttpError, clientIp } from './_lib/http.js'
import { rateLimit } from './_lib/ratelimit.js'
import { hashIp, hashToken } from './_lib/crypto.js'
import { isValidClientToken } from '../../shared/codes.js'

const MAX_ISSUES = 3
const SIGNED_URL_SECONDS = 120

export const handler = wrap(async (event) => {
  const body = parseJson(event)
  const ipHash = hashIp(clientIp(event))
  await rateLimit(`dl:ip:${ipHash}`, 30, 600)

  if (!isValidClientToken(body.token)) throw new HttpError(400, 'bad_request', 'অনুরোধটি সঠিক নয়।')
  const tokenHash = hashToken(body.token)
  const sb = db()

  const { data, error } = await sb.rpc('consume_download_authorization', { p_token_hash: tokenHash, p_max_issues: MAX_ISSUES })
  if (error) throw error
  if (data.result !== 'ok') return json(200, { result: data.result })

  const ext = (String(data.file_path).split('.').pop() || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 8)
  const filename = ext ? `${data.product_slug}.${ext}` : data.product_slug

  const { data: signed, error: signErr } = await sb.storage.from('product-files')
    .createSignedUrl(data.file_path, SIGNED_URL_SECONDS, { download: filename })

  if (signErr || !signed?.signedUrl) {
    console.error('[download-sign]', signErr?.message)
    await sb.rpc('refund_download_authorization', { p_token_hash: tokenHash }) // Customer-এর সুযোগ নষ্ট হবে না
    throw new HttpError(500, 'sign_failed', 'ডাউনলোড লিংক তৈরি করা যায়নি। আবার চেষ্টা করুন।')
  }

  return json(200, {
    result: 'ok',
    url: signed.signedUrl,
    productName: data.product_name,
    remaining: data.remaining,
    expiresAt: data.expires_at,
  })
})
