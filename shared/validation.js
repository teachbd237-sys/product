// Shared Validation — Frontend এবং Netlify Function দুই জায়গাতেই ব্যবহার হয়।
// Frontend validation শুধু সুবিধার জন্য; আসল নিরাপত্তা Server-এর validation।

export const LIMITS = {
  nameMin: 2,
  nameMax: 80,
  emailMax: 254,
  noteMax: 1000,
  reasonMax: 500,
}

export function cleanText(v, max = 200) {
  if (typeof v !== 'string') return ''
  // কন্ট্রোল ক্যারেক্টার বাদ, অতিরিক্ত স্পেস কমানো
  return v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').replace(/\s+/g, ' ').trim().slice(0, max)
}

export function cleanMultiline(v, max = 2000) {
  if (typeof v !== 'string') return ''
  return v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').replace(/\r\n/g, '\n').trim().slice(0, max)
}

export function validateName(v) {
  const s = cleanText(v, LIMITS.nameMax + 20)
  if (s.length < LIMITS.nameMin) return { ok: false, reason: 'short' }
  if (s.length > LIMITS.nameMax) return { ok: false, reason: 'long' }
  if (/[<>]/.test(s)) return { ok: false, reason: 'invalid' }
  return { ok: true, value: s }
}

const EMAIL_RE = /^[A-Za-z0-9._%+\-]+@[A-Za-z0-9](?:[A-Za-z0-9\-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9\-]*[A-Za-z0-9])?)*\.[A-Za-z]{2,}$/

export function validateEmail(v) {
  if (typeof v !== 'string') return { ok: false, reason: 'invalid' }
  const s = v.trim().toLowerCase()
  if (!s || s.length > LIMITS.emailMax || !EMAIL_RE.test(s)) return { ok: false, reason: 'invalid' }
  return { ok: true, value: s }
}

export function isHttpUrl(v) {
  if (typeof v !== 'string') return false
  try {
    const u = new URL(v.trim())
    return u.protocol === 'https:' || u.protocol === 'http:'
  } catch {
    return false
  }
}

export function isUuid(v) {
  return typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)
}

export function slugify(v) {
  return String(v || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

// ছবির প্রথম কয়েক Byte দেখে আসল ফাইল-টাইপ যাচাই (Content-Type বিশ্বাস করা হয় না)
export function detectImageType(bytes) {
  if (!bytes || bytes.length < 12) return null
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg'
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
      bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) return 'image/png'
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
      bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return 'image/webp'
  return null
}
