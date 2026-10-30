import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { postJson } from '../lib/api.js'
import { listMine } from '../lib/myRequests.js'
import { useSettings } from '../lib/settings.jsx'
import { Field, Spinner } from '../components/ui.jsx'

const ICON = { pending: '⏳', approved: '✓', redeemed: '✓', rejected: '✕', revoked: '✕', cancelled: '✕' }

export default function RequestStatus() {
  const { ref: refParam } = useParams()
  const { s } = useSettings()
  const [ref, setRef] = useState(refParam || '')
  const [key, setKey] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [result, setResult] = useState(null)
  const mine = listMine()

  async function check(r = ref, k = key) {
    setErr(''); setResult(null); setBusy(true)
    try { setResult(await postJson('request-status', { requestRef: r, lookupSecret: k })) }
    catch (e) { setErr(e.message) } finally { setBusy(false) }
  }
  useEffect(() => {
    if (refParam) { const m = mine.find((x) => x.ref === refParam); if (m) { setKey(m.key); check(m.ref, m.key) } }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const text = result && ({
    pending: s.msg_pending,
    approved: result.codeMarkedSent ? s.msg_approved_sent : s.msg_approved,
    rejected: s.msg_rejected,
    redeemed: 'আপনার কোডটি ব্যবহার করা হয়েছে। ডাউনলোডে সমস্যা হলে অ্যাডমিনের সাথে যোগাযোগ করুন।',
    revoked: 'আপনার কোডটি বাতিল করা হয়েছে। অ্যাডমিনের সাথে যোগাযোগ করুন।',
    cancelled: 'রিকোয়েস্টটি বাতিল করা হয়েছে।',
  }[result.status])
  const title = result && ({ pending: 'যাচাই চলছে', approved: 'অনুমোদিত', rejected: 'অনুমোদন হয়নি', redeemed: 'কোড ব্যবহৃত', revoked: 'কোড বাতিল', cancelled: 'বাতিল' }[result.status])

  return (
    <main className="container narrow section" style={{ paddingTop: 36 }}>
      <h1 style={{ fontSize: 32 }}>রিকোয়েস্ট স্ট্যাটাস</h1>
      <p className="muted">রিকোয়েস্ট জমা দেওয়ার সময় পাওয়া রেফারেন্স ও Status Key দিন। এই তথ্য ছাড়া কিছু দেখা যায় না।</p>

      {result ? (
        <div className="glass pad-lg status-card mt-24">
          <div className={`status-icon ${result.status}`}>{ICON[result.status]}</div>
          <h2>{title}</h2>
          <p className="muted mb-8">{result.productName} · {result.requestRef}</p>
          <p style={{ fontSize: 17 }}>{text}</p>
          {result.status === 'rejected' && result.rejectionReason && <div className="alert warn" style={{ textAlign: 'left' }}>কারণ: {result.rejectionReason}</div>}
          <div className="row mt-16" style={{ justifyContent: 'center' }}>
            {result.status === 'approved' && result.productSlug && <Link className="btn primary" to={`/product/${result.productSlug}#redeem`}>কোড ব্যবহার করুন</Link>}
            <button className="btn" onClick={() => check()} disabled={busy}>{busy && <Spinner />} আবার দেখুন</button>
            <button className="btn ghost" onClick={() => { setResult(null); setKey(''); setRef('') }}>অন্য রিকোয়েস্ট</button>
          </div>
        </div>
      ) : (
        <form className="glass pad-lg mt-24 form-grid" onSubmit={(e) => { e.preventDefault(); check() }} noValidate>
          <Field label="রিকোয়েস্ট রেফারেন্স" htmlFor="s-ref" hint="যেমন: SF-RXXXXXXXX"><input id="s-ref" type="text" value={ref} onChange={(e) => setRef(e.target.value.toUpperCase())} placeholder="SF-R…" autoComplete="off" /></Field>
          <Field label="Status Key" htmlFor="s-key" hint="যেমন: ABCD-2345-EFGH-6789"><input id="s-key" type="text" value={key} onChange={(e) => setKey(e.target.value.toUpperCase())} placeholder="XXXX-XXXX-XXXX-XXXX" autoComplete="off" /></Field>
          {err && <div className="alert error" role="alert">{err}</div>}
          <button className="btn primary" disabled={busy || !ref || !key}>{busy && <Spinner />} স্ট্যাটাস দেখুন</button>
        </form>
      )}

      {!result && mine.length > 0 && (
        <div className="mt-32">
          <h3>এই ডিভাইসে জমা দেওয়া রিকোয়েস্ট</h3>
          <div className="grid" style={{ display: 'grid', gap: 10 }}>
            {mine.map((m) => (
              <button key={m.ref} className="glass pad" style={{ textAlign: 'left', color: 'inherit', cursor: 'pointer' }} onClick={() => { setRef(m.ref); setKey(m.key); check(m.ref, m.key) }}>
                <strong>{m.product}</strong><div className="muted small">{m.ref}</div>
              </button>
            ))}
          </div>
        </div>
      )}
    </main>
  )
}
