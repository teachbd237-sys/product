import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../supabaseClient.js'

export default function AdminProducts() {
  const [products, setProducts] = useState([])

  useEffect(() => {
    load()
  }, [])

  async function load() {
    const { data } = await supabase.from('products').select('*').order('created_at', { ascending: false })
    setProducts(data || [])
  }

  async function handleDelete(id) {
    if (!confirm('আপনি কি নিশ্চিত এই Product Delete করতে চান?')) return
    await supabase.from('products').delete().eq('id', id)
    load()
  }

  return (
    <div>
      <div className="flex-between">
        <h1>Products</h1>
        <Link to="/admin/products/new" className="btn btn-primary">+ New Product</Link>
      </div>

      <table className="admin-table mt-24">
        <thead>
          <tr>
            <th>Name</th>
            <th>Price</th>
            <th>Version</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {products.map((p) => (
            <tr key={p.id}>
              <td>{p.name}</td>
              <td>৳{p.price}</td>
              <td>{p.version}</td>
              <td><span className={`badge ${p.status === 'active' ? 'badge-approved' : 'badge-rejected'}`}>{p.status}</span></td>
              <td style={{ display: 'flex', gap: 8 }}>
                <Link to={`/admin/products/${p.id}/edit`} className="btn btn-outline" style={{ padding: '6px 12px' }}>Edit</Link>
                <button onClick={() => handleDelete(p.id)} className="btn btn-danger" style={{ padding: '6px 12px' }}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {products.length === 0 && <p className="muted mt-16">এখনো কোনো Product নেই।</p>}
    </div>
  )
}
