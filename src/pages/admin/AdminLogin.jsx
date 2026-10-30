import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../supabaseClient.js'
import { Field, Spinner } from '../../components/ui.jsx'
import { BrandMark } from '../../components/Navbar.jsx'

export default function AdminLogin() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    setErr(''); setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) { setErr('লগইন ব্যর্থ হয়েছে। ইমেইল অথবা পাসওয়ার্ড ভুল।'); return }
    navigate('/admin')
  }

  return (
    <div className="login-wrap">
      <form className="glass pad-lg login-card form-grid" onSubmit={handleSubmit}>
        <div className="row"><BrandMark /><strong style={{ fontSize: 20 }}>Admin Login</strong></div>
        <Field label="ইমেইল" htmlFor="a-email"><input id="a-email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@example.com" required /></Field>
        <Field label="পাসওয়ার্ড" htmlFor="a-pass"><input id="a-pass" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required /></Field>
        {err && <div className="alert error" role="alert">{err}</div>}
        <button className="btn primary block" disabled={loading}>{loading && <Spinner />} লগইন</button>
      </form>
    </div>
  )
}
