// Browser-এর সব Error (Netlify Function ও সরাসরি Supabase Query/Storage) এক জায়গা থেকে বাংলা বার্তায়।
// কখনো Stack Trace / SQL / Token দেখানো হয় না। Server-এর "errorId" থাকলে সাথে দেখানো হয় (Log খুঁজতে)।

const NET = 'ইন্টারনেট সংযোগ পাওয়া যায়নি। সংযোগ দেখে আবার চেষ্টা করুন।'

export function errorKind(e) {
  if (!e) return 'server'
  if (e.kind) return e.kind
  if (e.status === 0) return 'network'
  const st = Number(e.status || 0)
  if (st === 401) return 'auth'
  if (st === 403) return 'permission'
  if (st === 429) return 'rate'
  if (st === 400 || st === 409 || st === 422) return 'validation'
  if (st >= 500) return 'server'
  return 'server'
}

// ApiError (Netlify Function) ছাড়া বাকি সব — supabase-js এর PostgrestError / StorageError / fetch Error
export function describeError(e, fallback = 'কাজটি সম্পন্ন করা যায়নি। আবার চেষ্টা করুন।') {
  if (!e) return fallback
  if (e.name === 'ApiError') return e.errorId ? `${e.message} (রেফারেন্স: ${e.errorId})` : e.message

  const code = String(e.code || '')
  const msg = String(e.message || '')
  const status = Number(e.status || e.statusCode || 0)

  if (/failed to fetch|networkerror|load failed|network request failed/i.test(msg)) return NET
  if (code === 'PGRST204' || code === 'PGRST205' || code === '42703' || code === '42P01' || /schema cache|could not find the .* column/i.test(msg)) {
    return 'ডাটাবেসের গঠন কোডের সাথে মিলছে না। Supabase-এ supabase/migrations-এর SQL চালানো হয়েছে কিনা দেখুন (DEPLOYMENT_GUIDE_BANGLA.md)।'
  }
  if (code === '42501' || /row-level security|permission denied|not authorized|unauthorized/i.test(msg) || status === 401 || status === 403) {
    return 'এই কাজের অনুমতি নেই। আবার লগইন করুন; সমস্যা থাকলে নিশ্চিত করুন আপনার অ্যাকাউন্ট admins টেবিলে আছে।'
  }
  if (code === '23505' || /duplicate key|already exists/i.test(msg)) return 'এই তথ্য (বা ফাইলের নাম) আগে থেকেই আছে। অন্য একটি দিন।'
  if (code === '23503') return 'অন্য রেকর্ডের সাথে যুক্ত থাকায় কাজটি করা যায়নি।'
  if (code === '23514' || code === '23502' || code === '22P02') return 'দেওয়া তথ্য সঠিক নয়। ফর্মটি আবার দেখে নিন।'
  if (/bucket not found/i.test(msg)) return 'Storage Bucket পাওয়া যায়নি। Migration চালানো হয়েছে কিনা দেখুন।'
  if (status === 413 || /payload too large|exceeded the maximum allowed size|too large/i.test(msg)) return 'ফাইলটি অনেক বড়। Supabase Free Plan-এ প্রতি ফাইল সর্বোচ্চ ৫০ MB।'
  if (/mime type|not supported|invalid.*type/i.test(msg)) return 'এই ধরনের ফাইল অনুমোদিত নয়।'
  if (status >= 500) return 'সার্ভারে সমস্যা হয়েছে। কিছুক্ষণ পরে আবার চেষ্টা করুন।'
  return fallback
}

// সরাসরি supabase-js Query-র ফলাফল যাচাই: Error থাকলে ছোড়ে (যাতে Page "খালি" দেখানোর বদলে Error + Retry দেখায়)
export function unwrap({ data, error }) {
  if (error) throw error
  return data
}
