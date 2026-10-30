// Download Code-এর Format ও Normalize (Random তৈরি Server-এ হয়, netlify/functions/_lib/crypto.js-এ)।
// Alphabet: Crockford Base32 (0 O, 1 I L গুলিয়ে যায় বলে বাদ)। ১৬ অক্ষর × ৫ বিট = ৮০ বিট Entropy।

export const CODE_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
export const CODE_PREFIX = 'SF'
export const CODE_BODY_LENGTH = 16

// "sf-abcd efgh..." -> "ABCDEFGH..." (শুধু Body, Prefix ছাড়া); অবৈধ হলে null
export function normalizeCode(input) {
  if (typeof input !== 'string') return null
  let s = input.toUpperCase().replace(/[\s\-_.]/g, '')
  if (s.startsWith(CODE_PREFIX)) s = s.slice(CODE_PREFIX.length)
  // Crockford সংশোধন: O->0, I/L->1
  s = s.replace(/O/g, '0').replace(/[IL]/g, '1')
  if (s.length !== CODE_BODY_LENGTH) return null
  for (const ch of s) if (!CODE_ALPHABET.includes(ch)) return null
  return s
}

// "ABCDEFGH23456789" -> "SF-ABCD-EFGH-2345-6789"
export function formatCode(body) {
  return `${CODE_PREFIX}-${body.match(/.{1,4}/g).join('-')}`
}

// Request Reference (Public ID) ও Lookup Secret-এর জন্যও একই Alphabet
export function formatGroups(body, size = 4) {
  return body.match(new RegExp(`.{1,${size}}`, 'g')).join('-')
}

export function normalizeLookupSecret(input) {
  if (typeof input !== 'string') return null
  let s = input.toUpperCase().replace(/[\s\-_.]/g, '').replace(/O/g, '0').replace(/[IL]/g, '1')
  if (s.length !== 16) return null
  for (const ch of s) if (!CODE_ALPHABET.includes(ch)) return null
  return s
}

export function normalizeRequestRef(input) {
  if (typeof input !== 'string') return null
  const s = input.toUpperCase().replace(/\s/g, '')
  return /^SF-R[0-9A-HJKMNP-TV-Z]{8}$/.test(s) ? s : null
}

export function isValidClientToken(t) {
  return typeof t === 'string' && /^[A-Za-z0-9_-]{32,128}$/.test(t)
}
