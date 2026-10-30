import { createClient } from '@supabase/supabase-js'

export class ConfigError extends Error {
  constructor(message) { super(message); this.name = 'ConfigError' }
}

// ---------------------------------------------------------------------------------------------------
// কেন এই ফাইলে "RealtimeOff" আছে (Production Crash-এর আসল কারণ):
//
//   supabase-js প্রতিটি createClient() কলে ভিতরে একটি Realtime (WebSocket) Client তৈরি করে — আমরা
//   Realtime কখনো ব্যবহার করি না। কিন্তু Node 22-এর আগের ভার্সনে "native WebSocket" না থাকায় সেই
//   তৈরির ধাপেই createClient() নিজে Exception ছোঁড়ে:
//       "Node.js detected but native WebSocket not found."
//   ফলে প্রতিটি Function Invocation-ই (Query চালানোর আগেই) 500 দিয়ে ক্র্যাশ করত।
//
//   সমাধান: Supabase-এর নথিভুক্ত `realtime.transport` অপশনে একটি "বন্ধ" Transport দেওয়া। এতে
//   Netlify Function-এর Node ভার্সন যা-ই হোক, ক্লায়েন্ট তৈরি হবে। Realtime কেউ ব্যবহার করতে গেলে
//   স্পষ্ট Error পাবে (নীরবে ব্যর্থ হবে না)। কোনো Global Monkey-patch বা অতিরিক্ত ws প্যাকেজ লাগে না।
//   (তবুও Node 22 ব্যবহার করুন — netlify.toml, .nvmrc, package.json engines দেখুন।)
// ---------------------------------------------------------------------------------------------------
export class RealtimeOff {
  constructor() {
    throw new Error('Realtime/WebSocket এই Server-এ বন্ধ (Netlify Function-এ প্রয়োজন নেই)।')
  }
}

let client
// Service Role Key শুধু এখানেই ব্যবহার হয় (Netlify Function)। এটি কখনো Frontend-এ যায় না।
export function db() {
  if (client) return client
  const url = (process.env.SUPABASE_URL || '').trim()
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()
  if (!url || !key) throw new ConfigError('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY সেট করা নেই')
  let parsed
  try { parsed = new URL(url) } catch { throw new ConfigError('SUPABASE_URL সঠিক URL নয়') }
  if (parsed.protocol !== 'https:' && parsed.hostname !== 'localhost' && parsed.hostname !== '127.0.0.1') {
    throw new ConfigError('SUPABASE_URL অবশ্যই https:// দিয়ে শুরু হতে হবে')
  }
  client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    realtime: { transport: RealtimeOff },
    global: { headers: { 'x-application-name': 'story-frame-functions' } },
  })
  return client
}

// শুধু Automated Test-এর জন্য (tests/functions.test.js)। Production কোডে কোথাও ব্যবহৃত হয় না।
export function __setDbForTests(c) { client = c }
