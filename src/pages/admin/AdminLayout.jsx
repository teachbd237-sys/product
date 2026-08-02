import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { supabase } from '../../supabaseClient.js'

export default function AdminLayout() {
  const navigate = useNavigate()

  async function handleLogout() {
    await supabase.auth.signOut()
    navigate('/admin/login')
  }

  const linkClass = ({ isActive }) => (isActive ? 'active' : '')

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="brand" style={{ marginBottom: 24, padding: '0 12px' }}>
          <span className="brand-mark">P</span> Admin
        </div>
        <NavLink to="/admin" end className={linkClass}>Dashboard</NavLink>
        <NavLink to="/admin/products" className={linkClass}>Products</NavLink>
        <NavLink to="/admin/orders" className={linkClass}>Orders</NavLink>
        <NavLink to="/admin/settings" className={linkClass}>Settings</NavLink>
        <button onClick={handleLogout} className="btn btn-outline btn-block mt-24">Logout</button>
      </aside>
      <div className="admin-main">
        <Outlet />
      </div>
    </div>
  )
}
