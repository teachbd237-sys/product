import { db } from './supabase.js'
import { HttpError } from './http.js'

// Database-ভিত্তিক Fixed-window Rate Limit (Netlify Function Stateless বলে Memory-তে রাখা যায় না)।
// সমস্যা হলে "বন্ধ" (fail closed) — অর্থাৎ অনুরোধ আটকে যায়, খোলা থাকে না।
export async function rateLimit(key, limit, windowSeconds, message = 'অনেকবার চেষ্টা করা হয়েছে। কিছুক্ষণ পরে আবার চেষ্টা করুন।') {
  const { data, error } = await db().rpc('check_rate_limit', { p_key: key, p_limit: limit, p_window_seconds: windowSeconds })
  if (error) {
    console.error('[ratelimit]', error.message)
    throw new HttpError(503, 'unavailable', 'সার্ভার এখন ব্যস্ত। কিছুক্ষণ পরে আবার চেষ্টা করুন।')
  }
  if (!data) throw new HttpError(429, 'rate_limited', message)
}
