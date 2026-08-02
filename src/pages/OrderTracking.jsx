import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

export default function OrderTracking() {
  const [orderCode, setOrderCode] = useState('')
  const navigate = useNavigate()

  function handleSubmit(e) {
    e.preventDefault()
    if (!orderCode.trim()) return
    navigate(`/order/${orderCode.trim().toUpperCase()}`)
  }

  return (
    <main className="container section" style={{ maxWidth: 480 }}>
      <h1>Order Status Check</h1>
      <p className="section-sub">Checkout করার পর যে Order ID পেয়েছিলেন সেটি দিন।</p>
      <form onSubmit={handleSubmit} className="form-grid">
        <div>
          <label>Order ID</label>
          <input
            value={orderCode}
            onChange={(e) => setOrderCode(e.target.value)}
            placeholder="ORD-XXXXXX"
          />
        </div>
        <button className="btn btn-primary" type="submit">Check Status</button>
      </form>
    </main>
  )
}
