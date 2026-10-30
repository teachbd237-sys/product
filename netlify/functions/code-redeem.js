// POST /.netlify/functions/code-redeem
// কোড যাচাই + একবারের জন্য ব্যবহার (Atomic, Database ফাংশনে)। সফল হলে ৩০ মিনিটের Download Authorization তৈরি হয়।
//
// Failed Download নীতি:
//   * Customer-এর Browser একটি গোপন "token" (nonce) তৈরি করে এবং নিজের কাছে রাখে।
//   * একই কোড + একই token দিয়ে ৩০ মিনিটের মধ্যে আবার চেষ্টা করলে সফল হয় (Refresh / Network ব্যর্থতা / Double-click)।
//   * অন্য কোনো token দিয়ে একই কোড "ব্যবহৃত" — কোড অন্য কারো কাছে গেলে কাজ করে না।
//   * ৩০ মিনিটের ভিতরে সর্বোচ্চ ৩টি Download Link নেওয়া যায় (download-file)। এরপর কোড স্থায়ীভাবে ব্যবহৃত।
//   * তারপরও সমস্যা হলে Admin "নতুন কোড দিন" করতে পারেন (Audit Log-সহ)।
import { db } from './_lib/supabase.js'
import { json, parseJson, wrap, HttpError, clientIp } from './_lib/http.js'
import { rateLimit } from './_lib/ratelimit.js'
import { hashIp, hashCode, hashToken } from './_lib/crypto.js'
import { normalizeCode, isValidClientToken } from '../../shared/codes.js'
import { isUuid } from '../../shared/validation.js'

export const WINDOW_MINUTES = 30

export const handler = wrap(async (event) => {
  const body = parseJson(event)
  const ipHash = hashIp(clientIp(event))

  await rateLimit(`redeem:ip:${ipHash}`, 10, 600, 'অনেকবার ভুল চেষ্টা হয়েছে। ১০ মিনিট পরে আবার চেষ্টা করুন।')
  await rateLimit(`redeem:ip-day:${ipHash}`, 60, 86400, 'আজকের জন্য চেষ্টার সীমা শেষ। আগামীকাল আবার চেষ্টা করুন।')

  if (!isUuid(body.productId) || !isValidClientToken(body.token)) {
    throw new HttpError(400, 'bad_request', 'অনুরোধটি সঠিক নয়।')
  }
  const code = normalizeCode(body.code)
  if (!code) return json(200, { result: 'invalid' })

  const { data, error } = await db().rpc('redeem_download_code', {
    p_code_hash: hashCode(code),
    p_product_id: body.productId,
    p_token_hash: hashToken(body.token),
    p_ip_hash: ipHash,
    p_window_minutes: WINDOW_MINUTES,
  })
  if (error) throw error

  if (data.result !== 'ok') return json(200, { result: data.result })
  return json(200, {
    result: 'ok',
    resumed: !!data.resumed,
    productName: data.product_name,
    productVersion: data.product_version,
    expiresAt: data.expires_at,
    remaining: data.remaining,
  })
})
