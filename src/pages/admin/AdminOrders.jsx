import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../supabaseClient.js'

export default function AdminOrders() {
  const [orders, setOrders] = useState([])
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    load()
  }, [])

  async function load() {
    const { data } = await supabase
      .from('orders')
      .select('*, products ( name )')
      .order('created_at', { ascending: false })
    setOrders(data || [])
  }

  const filtered = filter === 'all' ? orders : orders.filter((o) => o.status === filter)

  return (
    <div>
      <div className="flex-between">
        <h1>Orders</h1>
        <select value={filter} onChange={(e) => setFilter(e.target.value)} style={{ width: 180 }}>
          <option value="all">সব Order</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      <table className="admin-table mt-24">
        <thead>
          <tr>
            <th>Order ID</th>
            <th>Customer</th>
            <th>Product</th>
            <th>Price</th>
            <th>Status</th>
            <th>Date</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((o) => (
            <tr key={o.id}>
              <td>{o.order_code}</td>
              <td>{o.customer_name}</td>
              <td>{o.products?.name}</td>
              <td>৳{o.price_at_purchase}</td>
              <td><span className={`badge badge-${o.status}`}>{o.status}</span></td>
              <td>{new Date(o.created_at).toLocaleDateString('bn-BD')}</td>
              <td><Link to={`/admin/orders/${o.id}`} className="btn btn-outline" style={{ padding: '6px 12px' }}>View</Link></td>
            </tr>
          ))}
        </tbody>
      </table>
      {filtered.length === 0 && <p className="muted mt-16">কোনো Order নেই।</p>}
    </div>
  )
}
