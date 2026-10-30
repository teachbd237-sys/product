import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { adminCall } from '../../lib/api.js'
import { fmtDateTime } from '../../lib/format.js'
import { ConfirmDialog, PageLoading, StatusBadge, useToast, Field } from '../../components/ui.jsx'

export default function AdminCodes() {
  const toast = useToast()
  const [codes, setCodes] = useState(null)
  const [status, setStatus] = useState('')
  const [err, setErr] = useState('')
  const [target, setTarget] = useState(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setErr('')
    try { setCodes((await adminCall('list-codes', { status })).codes) } catch (e) { setErr(e.message); setCodes([]) }
  }, [status])
  useEffect(() => { load() }, [load])

  async function revoke() {
    setBusy(true)
    try { await adminCall('revoke', { codeId: target.id }); toast('কোড Revoke করা হয়েছে।'); setTarget(null); load() }
    catch (e) { toast(e.message, 'bad') } finally { setBusy(false) }
  }

  return (
    <div>
      <div className="page-head"><h1>ডাউনলোড কোড</h1></div>
      <div className="glass pad mb-16"><div className="toolbar" style={{ marginBottom: 0 }}>
        <Field label="স্ট্যাটাস"><select value={status} onChange={(e) => setStatus(e.target.value)}><option value="">সব</option><option value="active">Active (অব্যবহৃত)</option><option value="redeemed">Redeemed</option><option value="revoked">Revoked</option></select></Field>
      </div><p className="hint mt-16 mb-0">নিরাপত্তার জন্য এখানে পুরো কোড দেখানো হয় না। কোড দেখতে ও WhatsApp-এ পাঠাতে রিকোয়েস্টের পেজে যান।</p></div>
      {err && <div className="alert error mb-16">{err}</div>}
      <div className="glass">{!codes ? <PageLoading /> : (
        <div className="table-wrap"><table className="data">
          <thead><tr><th>কোড</th><th>প্রোডাক্ট</th><th>রিকোয়েস্ট</th><th>স্ট্যাটাস</th><th>তৈরি</th><th>ব্যবহৃত</th><th>WhatsApp</th><th /></tr></thead>
          <tbody>
            {codes.map((c) => (
              <tr key={c.id}>
                <td className="nowrap" style={{ fontFamily: 'ui-monospace, Menlo, monospace' }}>SF-••••-••••-••••-{c.code_hint}</td>
                <td>{c.products?.name || '—'}</td>
                <td><Link className="link" to={`/admin/requests/${c.request_id}`}>{c.download_requests?.request_ref}</Link><span className="sub">{c.download_requests?.customer_name}</span></td>
                <td><StatusBadge status={c.status} />{c.revoke_reason && <span className="sub">{c.revoke_reason}</span>}</td>
                <td className="nowrap">{fmtDateTime(c.created_at)}</td>
                <td className="nowrap">{c.redeemed_at ? fmtDateTime(c.redeemed_at) : '—'}</td>
                <td>{c.download_requests?.whatsapp_sent_at ? 'Sent ✓' : '—'}</td>
                <td>{c.status === 'active' && <button className="btn danger sm" onClick={() => setTarget(c)}>Revoke</button>}</td>
              </tr>
            ))}
            {codes.length === 0 && <tr><td colSpan="8" className="empty">কোনো কোড নেই।</td></tr>}
          </tbody>
        </table></div>
      )}</div>
      <ConfirmDialog open={!!target} title="কোড Revoke করবেন?" danger confirmLabel="Revoke করুন" busy={busy} onConfirm={revoke} onCancel={() => setTarget(null)}>
        {target && <>{target.download_requests?.customer_name}-এর (…{target.code_hint}) কোডটি আর কাজ করবে না।</>}
      </ConfirmDialog>
    </div>
  )
}
