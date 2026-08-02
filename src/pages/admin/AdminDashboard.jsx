import { useEffect, useState } from 'react'
import { supabase } from '../../supabaseClient.js'

export default function AdminDashboard() {
  const [stats, setStats] = useState({ total: 0, pending: 0, approved: 0, rejected: 0, products: 0 })

  useEffect(() => {
    load()
  }, [])

  async function load() {
    const { data: orders } = await supabase.from('orders').select('status')
    const { count: productCount } = await supabase.from('products').select('*', { count: 'exact', head: true })

    const total = orders?.length || 0
    const pending = orders?.filter((o) => o.status === 'pending').length || 0
    const approved = orders?.filter((o) => o.status === 'approved').length || 0
    const rejected = orders?.filter((o) => o.status === 'rejected').length || 0

    setStats({ total, pending, approved, rejected, products: productCount || 0 })
  }

  return (
    <div>
      <h1>Dashboard</h1>
      <div className="stat-grid mt-24">
        <div className="stat-card"><div className="num">{stats.total}</div><div className="label">Total Orders</div></div>
        <div className="stat-card"><div className="num" style={{ color: 'var(--warn)' }}>{stats.pending}</div><div className="label">Pending Orders</div></div>
        <div className="stat-card"><div className="num" style={{ color: 'var(--success)' }}>{stats.approved}</div><div className="label">Approved Orders</div></div>
        <div className="stat-card"><div className="num" style={{ color: 'var(--danger)' }}>{stats.rejected}</div><div className="label">Rejected Orders</div></div>
        <div className="stat-card"><div className="num">{stats.products}</div><div className="label">Total Products</div></div>
      </div>
    </div>
  )
}
