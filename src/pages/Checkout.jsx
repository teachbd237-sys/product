import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient.js'

function generateOrderCode() {
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase()
  return `ORD-${rand}`
}

export default function Checkout() {
  const { slug } = useParams()
  const navigate = useNavigate()

  const [product, setProduct] = useState(null)
  const [bkashNumber, setBkashNumber] = useState('')
  const [form, setForm] = useState({ name: '', email: '', phone: '', transactionId: '' })
  const [file, setFile] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    load()
  }, [slug])

  async function load() {
    const { data: p } = await supabase.from('products').select('*').eq('slug', slug).eq('status', 'active').maybeSingle()
    setProduct(p)

    const { data: setting } = await supabase.from('settings').select('value').eq('key', 'bkash_number').maybeSingle()
    setBkashNumber(setting?.value || 'YOUR_BKASH_NUMBER')
  }

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setErr('')

    if (!form.name || !form.email || !form.phone || !form.transactionId) {
      setErr('সব Field পূরণ করুন।')
      return
    }
    if (!file) {
      setErr('Payment Screenshot Upload করুন।')
      return
    }

    setSubmitting(true)
    try {
      const orderCode = generateOrderCode()
      const fileExt = file.name.split('.').pop()
      const filePath = `${orderCode}-${Date.now()}.${fileExt}`

      const { error: uploadError } = await supabase.storage
        .from('payment-proofs')
        .upload(filePath, file)

      if (uploadError) throw uploadError

      const { error: insertError } = await supabase.from('orders').insert({
        order_code: orderCode,
        product_id: product.id,
        customer_name: form.name,
        customer_email: form.email,
        customer_phone: form.phone,
        transaction_id: form.transactionId,
        screenshot_path: filePath,
        price_at_purchase: product.price,
        status: 'pending',
      })

      if (insertError) throw insertError

      navigate(`/order/${orderCode}`)
    } catch (e) {
      setErr('কিছু একটা সমস্যা হয়েছে: ' + e.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (!product) return <main className="container section">লোড হচ্ছে...</main>

  return (
    <main className="container section" style={{ maxWidth: 640 }}>
      <h1>Checkout</h1>
      <div className="card mt-16">
        <div className="flex-between">
          <span>Product</span>
          <strong>{product.name}</strong>
        </div>
        <div className="flex-between mt-8">
          <span>Price</span>
          <strong>৳{product.price}</strong>
        </div>
      </div>

      <div className="bkash-box mt-24">
        <div className="muted" style={{ fontSize: 13 }}>bKash Payment Number (Send Money)</div>
        <div className="bkash-number mt-8">{bkashNumber}</div>
        <p className="mt-16" style={{ fontSize: 14 }}>
          উপরের bKash নম্বরে <strong>৳{product.price}</strong> Send Money করুন। Payment সম্পন্ন
          করার পর নিচের Form পূরণ করুন।
        </p>
      </div>

      <form className="form-grid mt-24" onSubmit={handleSubmit}>
        <div>
          <label>Name</label>
          <input name="name" value={form.name} onChange={handleChange} placeholder="আপনার নাম" />
        </div>
        <div>
          <label>Email</label>
          <input type="email" name="email" value={form.email} onChange={handleChange} placeholder="you@example.com" />
        </div>
        <div>
          <label>Phone Number</label>
          <input name="phone" value={form.phone} onChange={handleChange} placeholder="01XXXXXXXXX" />
        </div>
        <div>
          <label>bKash Transaction ID</label>
          <input name="transactionId" value={form.transactionId} onChange={handleChange} placeholder="যেমন: 8N7A5X9K2P" />
        </div>
        <div>
          <label>Payment Screenshot</label>
          <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files[0])} />
        </div>

        {err && <p className="error-text">{err}</p>}

        <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
          {submitting ? 'জমা হচ্ছে...' : 'Submit Payment Proof'}
        </button>
      </form>
    </main>
  )
}
