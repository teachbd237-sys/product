import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../supabaseClient.js'

export default function AdminOrderDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [order, setOrder] = useState(null)
  const [screenshotUrl, setScreenshotUrl] = useState('')
  const [updating, setUpdating] = useState(false)

  useEffect(() => {
    load()
  }, [id])

  async function load() {
    const { data } = await supabase
      .from('orders')
      .select('*, products ( name, price, version )')
      .eq('id', id)
      .maybeSingle()
    setOrder(data)

    if (data?.screenshot_path) {
      // Admin Authenticated হওয়ায় Signed URL তৈরি করা যায় (RLS দ্বারা সুরক্ষিত)
      const { data: signed } = await supabase.storage
        .from('payment-proofs')
        .createSignedUrl(data.screenshot_path, 60 * 15)
      setScreenshotUrl(signed?.signedUrl || '')
    }
  }

  async function updateStatus(status) {
    setUpdating(true)
    await supabase.from('orders').update({ status }).eq('id', id)
    setUpdating(false)
    load()
  }

  if (!order) return <div>লোড হচ্ছে...</div>

  return (
    <div>
      <button className="btn btn-outline" onClick={() => navigate('/admin/orders')}>← Orders-এ ফিরে যান</button>
      <h1 className="mt-16">Order {order.order_code}</h1>
      <span className={`badge badge-${order.status}`}>{order.status}</span>

      <div className="card mt-24" style={{ maxWidth: 600 }}>
        <div className="flex-between"><span className="muted">Customer Name</span><strong>{order.customer_name}</strong></div>
        <div className="flex-between mt-8"><span className="muted">Email</span><strong>{order.customer_email}</strong></div>
        <div className="flex-between mt-8"><span className="muted">Phone</span><strong>{order.customer_phone}</strong></div>
        <div className="flex-between mt-8"><span className="muted">Product</span><strong>{order.products?.name}</strong></div>
        <div className="flex-between mt-8"><span className="muted">Price</span><strong>৳{order.price_at_purchase}</strong></div>
        <div className="flex-between mt-8"><span className="muted">Transaction ID</span><strong>{order.transaction_id}</strong></div>
        <div className="flex-between mt-8"><span className="muted">Order Date</span><strong>{new Date(order.created_at).toLocaleString('bn-BD')}</strong></div>
      </div>

      {screenshotUrl && (
        <div className="mt-24">
          <label>Payment Screenshot</label>
          <img src={screenshotUrl} alt="proof" className="img-preview" />
        </div>
      )}

      {order.status === 'pending' && (
        <div className="mt-24" style={{ display: 'flex', gap: 12 }}>
          <button className="btn btn-primary" disabled={updating} onClick={() => updateStatus('approved')}>Approve Payment</button>
          <button className="btn btn-danger" disabled={updating} onClick={() => updateStatus('rejected')}>Reject Payment</button>
        </div>
      )}
    </div>
  )
}
