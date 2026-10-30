// অপ্রত্যাশিত Error (Database / Storage / Network / Config) → নিরাপদ HTTP উত্তর।
// Customer বা Browser-কে কখনো Stack Trace, SQL, Key বা ভিতরের বার্তা দেখানো হয় না;
// শুধু একটি ছোট "errorId" দেখানো হয়, যা দিয়ে Netlify Function Log-এ আসল কারণ খুঁজে পাওয়া যায়।
import { randomBytes } from 'node:crypto'

export function newErrorId() {
  return 'E-' + randomBytes(4).toString('hex').toUpperCase()
}

const NETWORK_RE = /fetch failed|ECONNREFUSED|ENOTFOUND|ETIMEDOUT|ECONNRESET|EAI_AGAIN|socket hang up|network/i

// PostgREST / Postgres কোড অনুযায়ী ভাগ
const SCHEMA_CODES = new Set(['PGRST200', 'PGRST201', 'PGRST202', 'PGRST204', 'PGRST205', '42703', '42P01', '42883'])
const VALIDATION_CODES = new Set(['23502', '23514', '22P02', '22001', '22003', '22007', '22023'])

export function classify(e) {
  const code = String(e?.code || '')
  const msg = String(e?.message || '')

  if (e?.name === 'ConfigError') {
    return { status: 500, error: 'server_not_configured', kind: 'config', message: 'সার্ভারের সেটআপ সম্পূর্ণ নয়। অ্যাডমিনকে জানান (Netlify Environment Variables দেখতে হবে)।' }
  }
  if (NETWORK_RE.test(msg) && !code.startsWith('PGRST')) {
    return { status: 503, error: 'db_unreachable', kind: 'network', message: 'ডাটাবেসের সাথে সংযোগ করা যায়নি। কিছুক্ষণ পরে আবার চেষ্টা করুন।' }
  }
  if (SCHEMA_CODES.has(code)) {
    return { status: 500, error: 'schema_mismatch', kind: 'database', message: 'ডাটাবেসের গঠন কোডের সাথে মিলছে না। অ্যাডমিনকে জানান (SQL migration চালাতে হতে পারে)।' }
  }
  if (code === '42501' || /permission denied|row-level security/i.test(msg)) {
    return { status: 403, error: 'db_permission', kind: 'permission', message: 'ডাটাবেসে এই কাজের অনুমতি নেই। অ্যাডমিনকে জানান।' }
  }
  if (code === '23505') {
    return { status: 409, error: 'duplicate', kind: 'validation', message: 'এই তথ্য আগে থেকেই আছে।' }
  }
  if (code === '23503') {
    return { status: 409, error: 'in_use', kind: 'validation', message: 'অন্য রেকর্ডের সাথে যুক্ত থাকায় এই কাজটি করা যায়নি।' }
  }
  if (VALIDATION_CODES.has(code)) {
    return { status: 400, error: 'validation', kind: 'validation', message: 'দেওয়া তথ্য সঠিক নয়। ফর্মটি আবার দেখে নিন।' }
  }
  if (e?.__isStorageError || /^Storage/.test(String(e?.name || ''))) {
    return { status: 502, error: 'storage_error', kind: 'storage', message: 'ফাইল স্টোরেজে সমস্যা হয়েছে। কিছুক্ষণ পরে আবার চেষ্টা করুন।' }
  }
  if (e?.__isAuthError) {
    return { status: 401, error: 'unauthorized', kind: 'auth', message: 'লগইন সেশন শেষ। আবার লগইন করুন।' }
  }
  return { status: 500, error: 'server_error', kind: 'server', message: 'সার্ভারে একটি সমস্যা হয়েছে। কিছুক্ষণ পরে আবার চেষ্টা করুন।' }
}

// Log-এ আসল কারণ; Response-এ শুধু নিরাপদ তথ্য। Key/Token কখনো Log হয় না (শুধু message ও কোড)।
export function logError(id, tag, e) {
  console.error(`[${tag}] ${id}`, JSON.stringify({
    name: e?.name, code: e?.code, status: e?.status, message: String(e?.message || e).slice(0, 400),
    details: typeof e?.details === 'string' ? e.details.slice(0, 200) : undefined,
    hint: typeof e?.hint === 'string' ? e.hint.slice(0, 200) : undefined,
  }))
}
