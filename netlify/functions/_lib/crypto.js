import { createHmac, createCipheriv, createDecipheriv, randomBytes, randomInt, hkdfSync, timingSafeEqual } from 'node:crypto'
import { CODE_ALPHABET, CODE_BODY_LENGTH, formatCode } from '../../../shared/codes.js'
import { ConfigError } from './supabase.js'

function secret() {
  const s = process.env.CODE_SECRET
  if (!s || s.length < 32) throw new ConfigError('CODE_SECRET সেট করা নেই বা ৩২ অক্ষরের কম')
  return s
}

// একটি মাত্র CODE_SECRET থেকে আলাদা কাজের জন্য আলাদা Key (HKDF)
function key(label) {
  return Buffer.from(hkdfSync('sha256', secret(), 'story-frame-v1', label, 32))
}

function hmacHex(label, value) {
  return createHmac('sha256', key(label)).update(String(value)).digest('hex')
}

export const hashCode = (body) => hmacHex('download-code', body)
export const hashToken = (token) => hmacHex('client-token', token)
export const hashLookup = (secretBody) => hmacHex('lookup-secret', secretBody)
export const hashIp = (ip) => hmacHex('ip', ip || 'unknown')

// crypto.randomInt Unbiased এবং Cryptographically Secure। সাধারণ (অনিরাপদ) Random Function কোথাও ব্যবহার হয়নি।
export function randomBase32(n) {
  let out = ''
  for (let i = 0; i < n; i++) out += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]
  return out
}

export function generateCode() {
  const body = randomBase32(CODE_BODY_LENGTH)
  return { body, display: formatCode(body), hint: body.slice(-4) }
}

// AES-256-GCM: "iv.tag.ciphertext" (base64url)
export function encryptCode(body) {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key('code-encryption'), iv)
  const ct = Buffer.concat([cipher.update(body, 'utf8'), cipher.final()])
  return [iv, cipher.getAuthTag(), ct].map((b) => b.toString('base64url')).join('.')
}

export function decryptCode(blob) {
  const [iv, tag, ct] = String(blob).split('.').map((p) => Buffer.from(p, 'base64url'))
  const decipher = createDecipheriv('aes-256-gcm', key('code-encryption'), iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8')
}

export function safeEqualHex(a, b) {
  const x = Buffer.from(String(a), 'hex')
  const y = Buffer.from(String(b), 'hex')
  return x.length === y.length && x.length > 0 && timingSafeEqual(x, y)
}
