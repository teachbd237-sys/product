// POST /.netlify/functions/request-status
// রিকোয়েস্ট Reference + গোপন Lookup Key দুটোই লাগে; শুধু Reference দিয়ে কিছু জানা যায় না।
// ফলাফলে নাম, ইমেইল, ফোন, কোড, স্ক্রিনশট — কিছুই থাকে না।
import { db } from './_lib/supabase.js'
import { json, parseJson, wrap, HttpError, clientIp } from './_lib/http.js'
import { rateLimit } from './_lib/ratelimit.js'
import { hashIp, hashLookup, safeEqualHex } from './_lib/crypto.js'
import { normalizeRequestRef, normalizeLookupSecret } from '../../shared/codes.js'

const NOT_FOUND = new HttpError(404, 'not_found', 'এই তথ্যে কোনো রিকোয়েস্ট পাওয়া যায়নি। রেফারেন্স ও Status Key আবার দেখে লিখুন।')

export const handler = wrap(async (event) => {
  const body = parseJson(event)
  const ipHash = hashIp(clientIp(event))
  await rateLimit(`status:ip:${ipHash}`, 15, 600)

  const ref = normalizeRequestRef(body.requestRef)
  const secret = normalizeLookupSecret(body.lookupSecret)
  if (!ref || !secret) throw NOT_FOUND
  await rateLimit(`status:ref:${ref}`, 10, 600)

  const { data: r, error } = await db().from('download_requests')
    .select('request_ref, status, product_name, product_id, lookup_secret_hash, rejection_reason, whatsapp_sent_at, created_at, products ( slug )')
    .eq('request_ref', ref).maybeSingle()
  if (error) throw error
  // Reference ভুল আর Key ভুল — দুই ক্ষেত্রেই একই উত্তর (কোন রিকোয়েস্ট আছে তা বোঝা যায় না)
  if (!r || !safeEqualHex(r.lookup_secret_hash, hashLookup(secret))) throw NOT_FOUND

  return json(200, {
    requestRef: r.request_ref,
    status: r.status,
    productName: r.product_name,
    productSlug: r.products?.slug || null,
    createdAt: r.created_at,
    codeMarkedSent: !!r.whatsapp_sent_at,
    rejectionReason: r.status === 'rejected' ? r.rejection_reason : null,
  })
})
