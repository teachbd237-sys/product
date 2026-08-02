import { useState } from 'react'
import { useParams } from 'react-router-dom'

export default function PurchaseStatus() {
  const { orderCode } = useParams()
  const [email, setEmail] = useState('')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')

  async function handleCheck(e) {
    e.preventDefault()
    setErr('')
    setLoading(true)
    setResult(null)
    try {
      const res = await fetch('/.netlify/functions/order-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderCode, email }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Order খুঁজে পাওয়া যায়নি।')
      setResult(data)
    } catch (e2) {
      setErr(e2.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="container section" style={{ maxWidth: 520 }}>
      <h1>Order: {orderCode}</h1>

      {!result && (
        <>
          <p className="section-sub">Order Status দেখতে আপনার Email Address দিন।</p>
          <form onSubmit={handleCheck} className="form-grid">
            <div>
              <label>Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
            </div>
            {err && <p className="error-text">{err}</p>}
            <button className="btn btn-primary" disabled={loading}>{loading ? 'খুঁজছি...' : 'Check Status'}</button>
          </form>
        </>
      )}

      {result && (
        <div className="status-page" style={{ padding: '40px 0' }}>
          {result.status === 'pending' && (
            <>
              <div className="status-icon" style={{ background: 'rgba(242,184,92,0.15)', color: 'var(--warn)' }}>⏳</div>
              <h2>Your Payment is Under Verification</h2>
              <p className="muted">আমরা আপনার Transaction যাচাই করছি। শীঘ্রই Update পাবেন।</p>
            </>
          )}
          {result.status === 'approved' && (
            <>
              <div className="status-icon" style={{ background: 'rgba(110,231,160,0.15)', color: 'var(--success)' }}>✓</div>
              <h2>Payment Verified Successfully</h2>
              <p className="muted mt-8">{result.productName} — Version {result.productVersion}</p>
              <a href={result.downloadUrl} className="btn btn-primary mt-24">Download Product</a>
            </>
          )}
          {result.status === 'rejected' && (
            <>
              <div className="status-icon" style={{ background: 'rgba(242,109,109,0.15)', color: 'var(--danger)' }}>✕</div>
              <h2>Payment Verification Failed</h2>
              <p className="muted">Transaction ID অথবা Screenshot সঠিক ছিল না। বিস্তারিত জানতে যোগাযোগ করুন।</p>
            </>
          )}
        </div>
      )}
    </main>
  )
}
