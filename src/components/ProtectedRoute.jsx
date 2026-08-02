import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '../supabaseClient.js'

export default function ProtectedRoute({ children }) {
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    checkAdmin()
    const { data: listener } = supabase.auth.onAuthStateChange(() => {
      checkAdmin()
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  async function checkAdmin() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      setIsAdmin(false)
      setLoading(false)
      return
    }
    // admins টেবিলে user_id আছে কিনা যাচাই করা হচ্ছে (RLS দিয়ে সুরক্ষিত)
    const { data, error } = await supabase
      .from('admins')
      .select('user_id')
      .eq('user_id', session.user.id)
      .maybeSingle()

    setIsAdmin(!!data && !error)
    setLoading(false)
  }

  if (loading) return <div className="container section">লোড হচ্ছে...</div>
  if (!isAdmin) return <Navigate to="/admin/login" replace />
  return children
}
