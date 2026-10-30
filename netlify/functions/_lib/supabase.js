import { createClient } from '@supabase/supabase-js'

export class ConfigError extends Error {}

let client
// Service Role Key শুধু এখানেই ব্যবহার হয় (Netlify Function)। এটি কখনো Frontend-এ যায় না।
export function db() {
  if (client) return client
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new ConfigError('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY সেট করা নেই')
  client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
  return client
}

// শুধু Automated Test-এর জন্য (tests/functions.test.js)। Production কোডে কোথাও ব্যবহৃত হয় না।
export function __setDbForTests(c) { client = c }
