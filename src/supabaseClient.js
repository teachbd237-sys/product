import { createClient } from '@supabase/supabase-js'

// এই দুইটা Value Netlify Environment Variables থেকে আসে (শুধু anon/public key — গোপন নয়)।
// Local এ কাজ করার জন্য .env ফাইলে বসান (.env.example দেখুন)।
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY সেট করা নেই। Netlify Environment Variables দেখুন।')
}

export const supabase = createClient(supabaseUrl || 'http://localhost', supabaseAnonKey || 'missing-anon-key')
