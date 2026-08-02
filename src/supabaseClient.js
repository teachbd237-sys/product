import { createClient } from '@supabase/supabase-js'

// এই দুইটা Value Netlify Environment Variables থেকে আসবে।
// Local এ কাজ করার জন্য .env ফাইলে বসাও (নিচে .env.example দেখো)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
