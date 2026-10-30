import { db } from './supabase.js'
import { HttpError } from './http.js'

// Frontend-এর "আমি Admin" দাবি বিশ্বাস করা হয় না। প্রতিটি Request-এ:
//   ১) Bearer Token Supabase দিয়ে যাচাই   ২) admins টেবিলে user_id আছে কিনা Server থেকে যাচাই
export async function requireAdmin(event) {
  const header = event.headers?.authorization || event.headers?.Authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : ''
  if (!token) throw new HttpError(401, 'unauthorized', 'লগইন প্রয়োজন।')

  const sb = db()
  let userData, error
  try {
    ;({ data: userData, error } = await sb.auth.getUser(token))
  } catch (e) {
    throw new HttpError(503, 'auth_unavailable', 'লগইন যাচাই করা যাচ্ছে না। কিছুক্ষণ পরে আবার চেষ্টা করুন।')
  }
  if (error) {
    // 4xx = টোকেন অবৈধ/মেয়াদোত্তীর্ণ (আবার লগইন)। অন্য সব (নেটওয়ার্ক/5xx) = Supabase সাময়িক অনুপলব্ধ — লগআউট নয়।
    const st = Number(error.status || 0)
    if (st >= 400 && st < 500) throw new HttpError(401, 'unauthorized', 'লগইন সেশন শেষ। আবার লগইন করুন।')
    throw new HttpError(503, 'auth_unavailable', 'লগইন যাচাই করা যাচ্ছে না। কিছুক্ষণ পরে আবার চেষ্টা করুন।')
  }
  if (!userData?.user) throw new HttpError(401, 'unauthorized', 'লগইন সেশন শেষ। আবার লগইন করুন।')

  const { data: adminRow, error: adminErr } = await sb.from('admins').select('user_id').eq('user_id', userData.user.id).maybeSingle()
  if (adminErr) throw adminErr
  if (!adminRow) throw new HttpError(403, 'forbidden', 'আপনি Admin নন।')
  return userData.user
}
