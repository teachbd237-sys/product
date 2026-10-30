import { useEffect, useState, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../../supabaseClient.js'
import { adminCall } from '../../lib/api.js'
import { copyText, fmtDateTime } from '../../lib/format.js'
import { useSettings } from '../../lib/settings.jsx'
import { renderTemplate, buildWhatsAppLink } from '../../../shared/whatsapp.js'
import { DEFAULT_WHATSAPP_TEMPLATE } from '../../../shared/defaults.js'
import { PLATFORMS } from '../../../shared/requirements.js'
import { ConfirmDialog, PageLoading, StatusBadge, useToast, Spinner } from '../../components/ui.jsx'

const COLS = 'id, request_ref, product_id, product_name, customer_name, customer_email, whatsapp_number, status, admin_notes, rejection_reason, requirements_snapshot, reviewed_at, whatsapp_sent_at, created_at'
const ACTION_LABEL = {
  request_submitted: 'রিকোয়েস্ট জমা', request_approved: 'অনুমোদিত (কোড তৈরি)', request_rejected: 'বাতিল (Rejected)', code_revealed: 'অ্যাডমিন কোড দেখেছেন',
  code_revoked: 'কোড Revoke', code_regenerated: 'নতুন কোড দেওয়া হয়েছে', code_redeemed: 'গ্রাহক কোড Redeem করেছেন',
  whatsapp_marked_sent: 'WhatsApp Sent হিসেবে চিহ্নিত', whatsapp_unmarked: 'Sent চিহ্ন তুলে নেওয়া',
}

export default function AdminRequestDetail() {
  const { id } = useParams()
  const { s } = useSettings()
  const toast = useToast()
  const [req, setReq] = useState(null)
  const [slug, setSlug] = useState('')
  const [template, setTemplate] = useState(DEFAULT_WHATSAPP_TEMPLATE)
  const [shots, setShots] = useState(null)
  const [logs, setLogs] = useState([])
  const [code, setCode] = useState(null)
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState('')
  const [dialog, setDialog] = useState(null)
  const [reason, setReason] = useState('')
  const [err, setErr] = useState('')

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('download_requests').select(COLS).eq('id', id).maybeSingle()
    if (error || !data) { setErr('রিকোয়েস্টটি পাওয়া যায়নি।'); return }
    setReq(data); setNotes(data.admin_notes || '')
    if (data.product_id) supabase.from('products').select('slug').eq('id', data.product_id).maybeSingle().then(({ data: p }) => setSlug(p?.slug || ''))
    supabase.from('website_settings').select('value').eq('key', 'whatsapp_template').maybeSingle().then(({ data: t }) => { if (typeof t?.value === 'string' && t.value) setTemplate(t.value) })
    supabase.from('download_audit_logs').select('action, created_at, meta').eq('request_id', id).order('created_at', { ascending: false }).limit(30).then(({ data: l }) => setLogs(l || []))
    adminCall('evidence-urls', { requestId: id }).then((r) => setShots(r.items)).catch(() => setShots([]))
  }, [id])
  useEffect(() => { load() }, [load])

  async function run(name, fn, okMsg) {
    setBusy(name); setErr('')
    try { const r = await fn(); if (okMsg) toast(okMsg); return r } catch (e) { setErr(e.message); toast(e.message, 'bad'); return null } finally { setBusy('') }
  }

  const approve = async () => {
    const r = await run('approve', () => adminCall('approve', { requestId: id }), 'অনুমোদিত হয়েছে। কোড তৈরি হয়েছে।')
    setDialog(null); if (r) { setCode(r.code); load() }
  }
  const reject = async () => {
    const r = await run('reject', () => adminCall('reject', { requestId: id, reason }), 'রিকোয়েস্ট বাতিল করা হয়েছে।')
    setDialog(null); setReason(''); if (r) load()
  }
  const revoke = async () => {
    const r = await run('revoke', () => adminCall('revoke', { requestId: id, reason }), 'কোড Revoke করা হয়েছে।')
    setDialog(null); setReason(''); if (r) { setCode(null); load() }
  }
  const regenerate = async () => {
    const r = await run('regen', () => adminCall('regenerate', { requestId: id, reason }), 'নতুন কোড তৈরি হয়েছে।')
    setDialog(null); setReason(''); if (r) { setCode(r.code); load() }
  }
  const reveal = async () => { const r = await run('reveal', () => adminCall('reveal-code', { requestId: id })); if (r) setCode(r.code) }
  const markSent = async (sent) => { const r = await run('sent', () => adminCall('mark-sent', { requestId: id, sent }), sent ? 'Sent হিসেবে চিহ্নিত হয়েছে।' : 'চিহ্ন তুলে নেওয়া হয়েছে।'); if (r) load() }
  const saveNotes = async () => { await run('notes', () => adminCall('save-notes', { requestId: id, notes }), 'নোট সংরক্ষিত।') }

  if (err && !req) return <div className="alert error">{err} <Link to="/admin/requests" className="link">← তালিকায় ফিরুন</Link></div>
  if (!req) return <PageLoading />

  const message = renderTemplate(template, {
    customer_name: req.customer_name, product_name: req.product_name, code: code || '[কোড দেখতে "কোড দেখান" বাটনে ক্লিক করুন]',
    product_url: slug ? `${window.location.origin}/product/${slug}` : window.location.origin, website_name: s.site_name,
  })
  const waLink = buildWhatsAppLink(req.whatsapp_number, message)
  const hasCodeLifecycle = ['approved', 'redeemed', 'revoked'].includes(req.status)
  const redeemedLog = logs.find((l) => l.action === 'code_redeemed')

  return (
    <div>
      <Link to="/admin/requests" className="muted small">← সব রিকোয়েস্ট</Link>
      <div className="page-head mt-8"><div className="row"><h1>{req.request_ref}</h1><StatusBadge status={req.status} /></div></div>
      {err && <div className="alert error mb-16" role="alert">{err}</div>}

      <div className="detail-grid">
        <div style={{ display: 'grid', gap: 20 }}>
          <section className="glass pad">
            <h3>গ্রাহকের তথ্য</h3>
            <div className="kv">
              <div><span>নাম</span><strong>{req.customer_name}</strong></div>
              <div><span>ইমেইল</span><span>{req.customer_email}</span></div>
              <div><span>WhatsApp</span><strong>{req.whatsapp_number}</strong></div>
              <div><span>প্রোডাক্ট</span><strong>{req.product_name}</strong></div>
              <div><span>জমার সময়</span><span>{fmtDateTime(req.created_at)}</span></div>
              {req.reviewed_at && <div><span>যাচাইয়ের সময়</span><span>{fmtDateTime(req.reviewed_at)}</span></div>}
              {req.rejection_reason && <div><span>বাতিলের কারণ</span><span>{req.rejection_reason}</span></div>}
            </div>
          </section>

          <section className="glass pad">
            <h3>জমার সময় প্রযোজ্য ধাপসমূহ</h3>
            {req.requirements_snapshot.length === 0 && <p className="muted mb-0">এই রিকোয়েস্টে কোনো সোশ্যাল ধাপ ছিল না।</p>}
            {req.requirements_snapshot.map((r) => (
              <div key={r.id} className="row between" style={{ padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
                <span><strong>{r.title}</strong> <span className="chip">{PLATFORMS[r.platform] || r.platform}</span>{!r.is_mandatory && <span className="chip">ঐচ্ছিক</span>}</span>
                <a className="link small" href={r.target_url} target="_blank" rel="noopener noreferrer">লিংক</a>
              </div>
            ))}
          </section>

          <section className="glass pad">
            <h3>ভেরিফিকেশন স্ক্রিনশট</h3>
            {!shots && <PageLoading />}
            {shots && shots.length === 0 && <p className="muted mb-0">কোনো স্ক্রিনশট জমা হয়নি।</p>}
            <div style={{ display: 'grid', gap: 14 }}>
              {shots?.map((x) => (
                <figure className="shot" key={x.id}><figcaption>{x.title}</figcaption>
                  {x.url ? <a href={x.url} target="_blank" rel="noopener noreferrer"><img src={x.url} alt={x.title} /></a> : <div className="empty">ছবি লোড করা যায়নি</div>}
                </figure>
              ))}
            </div>
            {shots?.length > 0 && <p className="hint mt-16 mb-0">লিংকগুলো ১০ মিনিট সচল থাকে। ছবিতে ক্লিক করলে বড় আকারে খুলবে।</p>}
          </section>

          <section className="glass pad">
            <h3>অ্যাডমিন নোট (গ্রাহক দেখবে না)</h3>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} placeholder="নিজের জন্য নোট লিখুন…" />
            <button className="btn mt-16" onClick={saveNotes} disabled={busy === 'notes' || notes === (req.admin_notes || '')}>{busy === 'notes' && <Spinner />} নোট সংরক্ষণ</button>
          </section>
        </div>

        <div style={{ display: 'grid', gap: 20 }}>
          {req.status === 'pending' && (
            <section className="glass pad">
              <h3>সিদ্ধান্ত নিন</h3>
              <p className="muted small">স্ক্রিনশট দেখে যাচাই করুন। অনুমোদন করলে একটি ইউনিক এককালীন কোড তৈরি হবে।</p>
              <div className="row"><button className="btn primary" onClick={() => setDialog('approve')}>অনুমোদন করুন</button><button className="btn danger" onClick={() => setDialog('reject')}>বাতিল করুন</button></div>
            </section>
          )}

          {hasCodeLifecycle && (
            <section className="glass pad">
              <h3>ডাউনলোড কোড ও WhatsApp</h3>
              {req.status === 'redeemed' && <div className="alert info mb-16">গ্রাহক কোডটি ব্যবহার করেছেন{redeemedLog ? ` (${fmtDateTime(redeemedLog.created_at)})` : ''}। কোডটি আর ব্যবহারযোগ্য নয়।</div>}
              {req.status === 'revoked' && <div className="alert warn mb-16">কোডটি বাতিল (Revoked) করা হয়েছে।</div>}

              {req.status === 'approved' && (<>
                {code ? <div className="codebox">{code}</div> : <button className="btn block" onClick={reveal} disabled={busy === 'reveal'}>{busy === 'reveal' && <Spinner />} কোড দেখান</button>}
                <p className="hint mt-8">একই কোড বারবার পাঠানো যায়; নতুন কোড তৈরি হয় না।</p>

                <h4 className="mt-16" style={{ fontSize: 15 }}>WhatsApp মেসেজ</h4>
                <div className="msg-preview">{message}</div>
                <div className="row mt-16">
                  <a className={`btn success${code ? '' : ''}`} href={code ? waLink : undefined} aria-disabled={!code} onClick={(e) => { if (!code) { e.preventDefault(); toast('আগে "কোড দেখান" চাপুন।', 'bad') } }} target="_blank" rel="noopener noreferrer">WhatsApp-এ পাঠান</a>
                  <button className="btn" disabled={!code} onClick={async () => toast((await copyText(message)) ? 'মেসেজ কপি হয়েছে।' : 'কপি করা যায়নি।')}>মেসেজ কপি</button>
                </div>
                <div className="alert info small mt-16 mb-0">WhatsApp খুললে মেসেজ লেখা অবস্থায় থাকবে; আপনাকে নিজে Send চাপতে হবে। WhatsApp খোলা মানেই পাঠানো হয়েছে এমন নয়, তাই পাঠানোর পর নিচের বাটনে নিজে চিহ্নিত করুন।</div>
                <div className="row between mt-16">
                  <span>{req.whatsapp_sent_at ? <span className="badge approved">Sent চিহ্নিত — {fmtDateTime(req.whatsapp_sent_at)}</span> : <span className="badge pending">এখনো Sent চিহ্নিত নয়</span>}</span>
                  {req.whatsapp_sent_at ? <button className="btn sm ghost" onClick={() => markSent(false)} disabled={busy === 'sent'}>চিহ্ন তুলুন</button>
                    : <button className="btn sm" onClick={() => markSent(true)} disabled={busy === 'sent'}>Sent হিসেবে চিহ্নিত করুন</button>}
                </div>
              </>)}

              <div className="row mt-24">
                {req.status === 'approved' && <button className="btn danger sm" onClick={() => setDialog('revoke')}>কোড Revoke করুন</button>}
                <button className="btn sm" onClick={() => setDialog('regen')}>নতুন কোড দিন</button>
              </div>
              {code && req.status !== 'approved' && <div className="codebox mt-16">{code}</div>}
            </section>
          )}

          <section className="glass pad">
            <h3>কার্যকলাপের লগ</h3>
            {logs.length === 0 ? <p className="muted mb-0">কোনো লগ নেই।</p> : <div className="log">{logs.map((l, i) => <div key={i}><span>{ACTION_LABEL[l.action] || l.action}{l.meta?.reason ? ` — ${l.meta.reason}` : ''}</span><span>{fmtDateTime(l.created_at)}</span></div>)}</div>}
          </section>
        </div>
      </div>

      <ConfirmDialog open={dialog === 'approve'} title="রিকোয়েস্ট অনুমোদন করবেন?" confirmLabel="হ্যাঁ, অনুমোদন করুন" busy={busy === 'approve'} onConfirm={approve} onCancel={() => setDialog(null)}>
        অনুমোদন করলে {req.customer_name}-এর জন্য {req.product_name}-এর একটি ইউনিক এককালীন কোড তৈরি হবে। স্ক্রিনশট দেখে নিশ্চিত হয়েছেন তো?
      </ConfirmDialog>
      <ConfirmDialog open={dialog === 'reject'} title="রিকোয়েস্ট বাতিল করবেন?" danger confirmLabel="বাতিল করুন" busy={busy === 'reject'} disabled={!reason.trim()} onConfirm={reject} onCancel={() => setDialog(null)}>
        <p>কারণ লিখুন। <strong>এই কারণ গ্রাহক স্ট্যাটাস পেজে দেখতে পাবেন।</strong></p>
        <textarea value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} placeholder="যেমন: স্ক্রিনশটে Subscribe দেখা যাচ্ছে না।" />
      </ConfirmDialog>
      <ConfirmDialog open={dialog === 'revoke'} title="কোড Revoke করবেন?" danger confirmLabel="Revoke করুন" busy={busy === 'revoke'} onConfirm={revoke} onCancel={() => setDialog(null)}>
        <p>এই কোড আর কাজ করবে না। (পরে চাইলে "নতুন কোড দিন" করতে পারবেন।)</p>
        <textarea value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} placeholder="কারণ (ঐচ্ছিক)" />
      </ConfirmDialog>
      <ConfirmDialog open={dialog === 'regen'} title="নতুন কোড তৈরি করবেন?" confirmLabel="নতুন কোড তৈরি করুন" busy={busy === 'regen'} onConfirm={regenerate} onCancel={() => setDialog(null)}>
        <p>পুরনো সক্রিয় কোড (থাকলে) বাতিল হবে এবং একটি নতুন এককালীন কোড তৈরি হবে। এটি লগে সংরক্ষিত থাকবে।</p>
        <textarea value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} placeholder="কারণ (যেমন: ডাউনলোড ব্যর্থ হয়েছিল)" />
      </ConfirmDialog>
    </div>
  )
}
