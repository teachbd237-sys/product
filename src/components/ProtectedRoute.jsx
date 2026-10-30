import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '../supabaseClient.js'
import { PageLoading } from './ui.jsx'

// এটি শুধু UI-র সুবিধার জন্য। আসল নিরাপত্তা: Supabase RLS + Netlify Function-এর Server-side Admin যাচাই।
export default function ProtectedRoute({ children }) {
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    checkAdmin()
    const { data: listener } = supabase.auth.onAuthStateChange(() => { checkAdmin() })
    return () => listener.subscription.unsubscribe()
  }, [])

  async function checkAdmin() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setIsAdmin(false); setLoading(false); return }
    const { data, error } = await supabase.from('admins').select('user_id').eq('user_id', session.user.id).maybeSingle()
    setIsAdmin(!!data && !error)
    setLoading(false)
  }

  if (loading) return <PageLoading />
  if (!isAdmin) return <Navigate to="/admin/login" replace />
  return children
}
