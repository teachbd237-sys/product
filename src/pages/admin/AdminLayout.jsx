import { useState } from 'react'
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import { supabase } from '../../supabaseClient.js'
import { useSettings } from '../../lib/settings.jsx'
import { BrandMark } from '../../components/Navbar.jsx'
import { ToastProvider } from '../../components/ui.jsx'

const NAV = [
  ['/admin', 'ওভারভিউ', '▦', true],
  ['/admin/requests', 'রিকোয়েস্ট', '✉'],
  ['/admin/codes', 'ডাউনলোড কোড', '⌗'],
  ['/admin/products', 'প্রোডাক্ট', '◧'],
  ['/admin/requirements', 'ভেরিফিকেশন ধাপ', '☑'],
  ['/admin/settings', 'ওয়েবসাইট সেটিংস', '⚙'],
]

export default function AdminLayout() {
  const navigate = useNavigate()
  const loc = useLocation()
  const { s } = useSettings()
  const [open, setOpen] = useState(false)
  useEffect(() => { setOpen(false) }, [loc.pathname])

  async function handleLogout() { await supabase.auth.signOut(); navigate('/admin/login') }
  const cls = ({ isActive }) => `nav${isActive ? ' active' : ''}`

  return (
    <ToastProvider>
      <div className="admin-top">
        <div className="brand"><BrandMark />Admin</div>
        <button className="btn sm" onClick={() => setOpen(true)} aria-label="মেনু খুলুন">☰ মেনু</button>
      </div>
      {open && <div className="scrim" onClick={() => setOpen(false)} />}
      <div className="admin-shell">
        <aside className={`admin-sidebar${open ? ' open' : ''}`} aria-label="Admin মেনু">
          <div className="brand"><BrandMark />{s.site_name}</div>
          {NAV.map(([to, label, icon, end]) => <NavLink key={to} to={to} end={end} className={cls}><span aria-hidden="true">{icon}</span>{label}</NavLink>)}
          <div className="sep" />
          <NavLink to="/admin/legacy-orders" className={cls}><span aria-hidden="true">🗂</span>পুরনো অর্ডার (আর্কাইভ)</NavLink>
          <a className="nav" href="/" target="_blank" rel="noopener noreferrer"><span aria-hidden="true">↗</span>ওয়েবসাইট দেখুন</a>
          <div className="grow" />
          <button onClick={handleLogout} className="btn block">লগআউট</button>
        </aside>
        <div className="admin-main"><Outlet /></div>
      </div>
    </ToastProvider>
  )
}
