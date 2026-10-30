import { useEffect, useState, useCallback, useRef } from 'react'
import { Link } from 'react-router-dom'
import { adminCall } from '../../lib/api.js'
import { describeError } from '../../lib/errors.js'
import { fmtDateTime } from '../../lib/format.js'
import { ConfirmDialog, PageLoading, StatusBadge, useToast, Field } from '../../components/ui.jsx'

const EMPTY_ALL = 'এখনো কোনো ডাউনলোড কোড তৈরি হয়নি।'
const EMPTY_FILTER = 'এই ফিল্টারে কোনো কোড পাওয়া যায়নি।'

export default function AdminCodes() {
  const toast = useToast()
  const [codes, setCodes] = useState(null)   // null = লোড হচ্ছে
  const [status, setStatus] = useState('')
  const [err, setErr] = useState('')         // আসল Request ব্যর্থ হলেই শুধু
  const [target, setTarget] = useState(null)
  const [busy, setBusy] = useState(false)
  const seq = useRef(0)

  const load = useCallback(async () => {
    const my = ++seq.current                   // দ্রুত ফিল্টার বদলালে পুরনো উত্তর নতুনটিকে ঢেকে দেয় না
    setErr(''); setCodes(null)
    try {
      const r = await adminCall('list-codes', { status })
      if (my === seq.current) setCodes(Array.isArray(r?.codes) ? r.codes : [])
    } catch (e) {
      if (my === seq.current) { setErr(describeError(e, 'ডাউনলোড কোড লোড করা যায়নি।')); setCodes([]) }
    }
  }, [status])
  useEffect(() => { load() }, [load])

  async function revoke() {
    if (busy) return
    setBusy(true)
    try { await adminCall('revoke', { codeId: target.id }); toast('কোড Revoke করা হয়েছে।'); setTarget(null); load() }
    catch (e) { toast(describeError(e), 'bad') } finally { setBusy(false) }
  }

  return (
    <div>
      <div className="page-head"><h1>ডাউনলোড কোড</h1>{codes && !err && <span className="muted">দেখানো হচ্ছে {codes.length}টি</span>}</div>
      <div className="glass pad mb-16"><div className="toolbar" style={{ marginBottom: 0 }}>
        <Field label="স্ট্যাটাস"><select value={status} onChange={(e) => setStatus(e.target.value)}><option value="">সব</option><option value="active">Active (অব্যবহৃত)</option><option value="redeemed">Redeemed (ব্যবহৃত)</option><option value="revoked">Revoked (বাতিল)</option></select></Field>
      </div><p className="hint mt-16 mb-0">নিরাপত্তার জন্য এখানে পুরো কোড দেখানো হয় না। কোড দেখতে ও WhatsApp-এ পাঠাতে রিকোয়েস্টের পেজে যান।</p></div>

      {err && (
        <div className="alert error mb-16" role="alert">
          <div>{err}</div>
          <button className="btn sm mt-8" onClick={load}>আবার চেষ্টা করুন</button>
        </div>
      )}

      {/* Error হলে খালি টেবিল দেখানো হয় না — "কোড নেই" ভুল ধারণা দেবে */}
      {!err && (
        <div className="glass">{!codes ? <PageLoading /> : codes.length === 0 ? (
          <div className="empty" style={{ padding: 32 }}>{status ? EMPTY_FILTER : EMPTY_ALL}</div>
        ) : (
          <div className="table-wrap"><table className="data">
            <thead><tr><th>কোড</th><th>প্রোডাক্ট</th><th>রিকোয়েস্ট</th><th>স্ট্যাটাস</th><th>তৈরি</th><th>ব্যবহৃত</th><th>WhatsApp</th><th /></tr></thead>
            <tbody>
              {codes.map((c) => (
                <tr key={c.id}>
                  <td className="nowrap" style={{ fontFamily: 'ui-monospace, Menlo, monospace' }}>SF-••••-••••-••••-{c.code_hint || '••••'}</td>
                  <td>{c.products?.name || <span className="muted">প্রোডাক্ট পাওয়া যায়নি</span>}</td>
                  <td>
                    {c.download_requests
                      ? <><Link className="link" to={`/admin/requests/${c.request_id}`}>{c.download_requests.request_ref}</Link><span className="sub">{c.download_requests.customer_name}</span></>
                      : <span className="muted">রিকোয়েস্ট পাওয়া যায়নি</span>}
                  </td>
                  <td><StatusBadge status={c.status} />{c.revoke_reason && <span className="sub">{c.revoke_reason}</span>}</td>
                  <td className="nowrap">{fmtDateTime(c.created_at)}</td>
                  <td className="nowrap">{c.redeemed_at ? fmtDateTime(c.redeemed_at) : '—'}</td>
                  <td>{c.download_requests ? (c.download_requests.whatsapp_sent_at ? <span className="badge approved">Sent ✓</span> : <span className="badge pending">পাঠানো হয়নি</span>) : '—'}</td>
                  <td>{c.status === 'active' && <button className="btn danger sm" onClick={() => setTarget(c)}>Revoke</button>}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}</div>
      )}

      <ConfirmDialog open={!!target} title="কোড Revoke করবেন?" danger confirmLabel="Revoke করুন" busy={busy} onConfirm={revoke} onCancel={() => setTarget(null)}>
        {target && <>{target.download_requests?.customer_name || 'এই গ্রাহকের'}-এর (…{target.code_hint}) কোডটি আর কাজ করবে না।</>}
      </ConfirmDialog>
    </div>
  )
}
