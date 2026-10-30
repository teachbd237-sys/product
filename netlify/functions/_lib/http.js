import { classify, newErrorId, logError } from './errors.js'

export class HttpError extends Error {
  constructor(status, code, message) {
    super(message || code)
    this.status = status
    this.code = code
  }
}

export function json(status, body) {
  return {
    statusCode: status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
    body: JSON.stringify(body),
  }
}

// একই Origin থেকে আসা Browser Request ছাড়া অন্য Website-এর Browser Request আটকানো হয়
export function checkOrigin(event) {
  const origin = event.headers?.origin
  if (!origin) return
  const host = event.headers['x-forwarded-host'] || event.headers.host
  let originHost
  try { originHost = new URL(origin).host } catch { throw new HttpError(403, 'forbidden', 'অনুমতি নেই।') }
  if (host && originHost !== host) throw new HttpError(403, 'forbidden', 'অনুমতি নেই।')
}

export function clientIp(event) {
  const h = event.headers || {}
  return h['x-nf-client-connection-ip'] || (h['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown'
}

export function parseJson(event, maxBytes = 64 * 1024) {
  if (event.httpMethod !== 'POST') throw new HttpError(405, 'method_not_allowed', 'Method not allowed')
  checkOrigin(event)
  let raw = event.body || ''
  if (event.isBase64Encoded) raw = Buffer.from(raw, 'base64').toString('utf8')
  if (raw.length > maxBytes) throw new HttpError(413, 'too_large', 'ডাটা অনেক বড়।')
  try {
    const v = JSON.parse(raw || '{}')
    if (v === null || typeof v !== 'object' || Array.isArray(v)) throw new Error('shape')
    return v
  } catch {
    throw new HttpError(400, 'bad_json', 'অনুরোধটি সঠিক নয়।')
  }
}

// সব Function এই Wrapper-এর ভিতরে চলে: Stack Trace বা ভিতরের Error কখনো Customer-কে দেখানো হয় না।
// সব উত্তরের আকার একই: { error: "কোড", message: "বাংলা বার্তা", errorId?, fieldErrors? }
export function wrap(fn) {
  return async (event) => {
    try {
      return await fn(event)
    } catch (e) {
      if (e instanceof HttpError) {
        const out = { error: e.code, message: e.message }
        if (e.fieldErrors) out.fieldErrors = e.fieldErrors
        if (e.requirementId) out.requirementId = e.requirementId
        if (e.status >= 500) { out.errorId = newErrorId(); logError(out.errorId, 'http', e) }
        return json(e.status, out)
      }
      const c = classify(e)
      const errorId = newErrorId()
      logError(errorId, c.kind, e)
      return json(c.status, { error: c.error, message: c.message, errorId })
    }
  }
}
