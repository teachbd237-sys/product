import { useEffect, useState } from 'react'
import { postJson } from '../lib/api.js'
import { newToken, loadSession, saveSession, clearSession } from '../lib/clientToken.js'
import { useSettings } from '../lib/settings.jsx'
import { Spinner } from './ui.jsx'

// কোড Redeem কার্ড (প্রোডাক্ট পেজে)। কোড শুধু একবার ব্যবহারযোগ্য; সফল হলে ৩০ মিনিটের Download Authorization পাওয়া যায়।
export default function RedeemCard({ product }) {
  const { s } = useSettings()
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [dlBusy, setDlBusy] = useState(false)
  const [error, setError] = useState('')
  const [session, setSession] = useState(() => loadSession(product.id))
  const [notice, setNotice] = useState('')

  useEffect(() => { setSession(loadSession(product.id)) }, [product.id])

  function formatTyped(v) {
    const raw = v.toUpperCase().replace(/[^A-Z0-9]/g, '')
    const body = raw.startsWith('SF') ? raw.slice(2) : raw
    const parts = body.slice(0, 16).match(/.{1,4}/g) || []
    return (body.length || raw.startsWith('SF') ? 'SF-' : '') + parts.join('-')
  }

  async function redeem(e) {
    e.preventDefault()
    setError(''); setNotice('')
    if (code.replace(/[^A-Za-z0-9]/g, '').length < 18) { setError(s.msg_invalid_code); return }
    setBusy(true)
    // একই token আবার ব্যবহার হয় (Refresh / নেটওয়ার্ক ব্যর্থতা / Double-click-এ কোড নষ্ট হয় না)
    const existing = loadSession(product.id)
    const token = existing?.token || newToken()
    saveSession(product.id, { token, expiresAt: existing?.expiresAt || null, pending: true })
    try {
      const r = await postJson('code-redeem', { productId: product.id, code, token })
      if (r.result === 'ok') {
        const sess = { token, expiresAt: r.expiresAt, remaining: r.remaining }
        saveSession(product.id, sess); setSession(sess); setCode('')
      } else {
        clearSession(product.id)
        setError({ used: s.msg_used_code, revoked: s.msg_revoked_code, unavailable: 'এই প্রোডাক্টের ফাইল এখন ডাউনলোডের জন্য প্রস্তুত নেই। অনুগ্রহ করে পরে চেষ্টা করুন বা অ্যাডমিনকে জানান।' }[r.result] || s.msg_invalid_code)
      }
    } catch (err) {
      if (err.status === 0) setError(err.message + ' (আপনার কোড নষ্ট হয়নি, আবার চেষ্টা করুন।)')
      else { if (err.status && err.status < 500 && err.status !== 429) clearSession(product.id); setError(err.message) }
    } finally { setBusy(false) }
  }

  async function download() {
    setDlBusy(true); setError(''); setNotice('')
    try {
      const r = await postJson('download-file', { token: session.token })
      if (r.result === 'ok') {
        const next = { ...session, remaining: r.remaining }
        saveSession(product.id, next); setSession(next)
        setNotice(`ডাউনলোড শুরু হচ্ছে। শুরু না হলে নিচের বাটনে আবার ক্লিক করুন (আরও ${r.remaining} বার সুযোগ আছে)।`)
        window.location.assign(r.url)
      } else {
        clearSession(product.id); setSession(null)
        setError(r.result === 'exhausted' ? 'ডাউনলোড লিংক নেওয়ার সীমা শেষ। সমস্যা হলে অ্যাডমিনের সাথে যোগাযোগ করুন।'
          : r.result === 'expired' ? 'ডাউনলোডের সময় (৩০ মিনিট) শেষ হয়েছে। সমস্যা হলে অ্যাডমিনের সাথে যোগাযোগ করুন।'
          : 'ডাউনলোড সেশন পাওয়া যায়নি।')
      }
    } catch (err) { setError(err.message) } finally { setDlBusy(false) }
  }

  if (session && !session.pending) {
    return (
      <div className="glass pad-lg" id="redeem">
        <div className="download-ready">
          <div className="tick">✓</div>
          <h3>{s.msg_download_success}</h3>
          <p className="muted small">{product.name}{product.version ? ` · v${product.version}` : ''}</p>
          <button className="btn primary lg block mt-16" onClick={download} disabled={dlBusy}>{dlBusy ? <Spinner /> : null} ডাউনলোড শুরু করুন</button>
          {notice && <p className="alert info mt-16 small">{notice}</p>}
          {error && <p className="alert error mt-16 small">{error}</p>}
          <p className="muted small mt-16 mb-0">এই ব্রাউজারে ৩০ মিনিটের মধ্যে সর্বোচ্চ ৩ বার ডাউনলোড লিংক নেওয়া যাবে। কোডটি আর ব্যবহার করা যাবে না।</p>
        </div>
      </div>
    )
  }

  return (
    <form className="glass pad-lg" id="redeem" onSubmit={redeem} noValidate>
      <h3>আপনার ডাউনলোড কোড লিখুন</h3>
      <p className="muted small">অ্যাডমিন WhatsApp-এ যে কোড পাঠিয়েছেন সেটি এখানে দিন। কোডটি শুধু <strong>{product.name}</strong>-এর জন্য কাজ করবে।</p>
      <div className="field">
        <label htmlFor="code" className="sr-only">ডাউনলোড কোড</label>
        <input id="code" className="code-input" type="text" inputMode="text" autoComplete="off" autoCapitalize="characters" spellCheck="false"
          placeholder="SF-XXXX-XXXX-XXXX-XXXX" value={code} onChange={(e) => setCode(formatTyped(e.target.value))} />
      </div>
      {error && <div className="alert error mt-16" role="alert">{error}</div>}
      <button className="btn primary block mt-16" disabled={busy}>{busy && <Spinner />} কোড যাচাই করুন</button>
      <div className="warn-line mt-16"><span aria-hidden="true">⚠</span><span>কোডটি শুধুমাত্র একবার ব্যবহার করা যাবে। যাচাই সফল হলে ৩০ মিনিটের মধ্যে ডাউনলোড করে নিন।</span></div>
      <p className="muted small mt-16 mb-0">কোড এখনো পাননি? <a className="link" href="/request-status">রিকোয়েস্টের স্ট্যাটাস দেখুন</a></p>
    </form>
  )
}
