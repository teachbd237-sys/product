import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../supabaseClient.js'

export default function AdminLogin() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    setErr('')
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) {
      setErr('Login ব্যর্থ হয়েছে। Email অথবা Password ভুল।')
      return
    }
    navigate('/admin')
  }

  return (
    <main className="container section" style={{ maxWidth: 380, minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
      <h1>Admin Login</h1>
      <form onSubmit={handleSubmit} className="form-grid mt-16">
        <div>
          <label>Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@example.com" />
        </div>
        <div>
          <label>Password</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
        </div>
        {err && <p className="error-text">{err}</p>}
        <button className="btn btn-primary btn-block" disabled={loading}>{loading ? 'Login হচ্ছে...' : 'Login'}</button>
      </form>
    </main>
  )
}
