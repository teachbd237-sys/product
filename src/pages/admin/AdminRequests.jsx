import { useEffect, useState, useCallback } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../../supabaseClient.js'
import { StatusBadge, PageLoading, Field } from '../../components/ui.jsx'
import { fmtDateTime } from '../../lib/format.js'

const PAGE = 25
const STATUSES = ['pending', 'approved', 'rejected', 'redeemed', 'revoked', 'cancelled']

export default function AdminRequests() {
  const [sp, setSp] = useSearchParams()
  const [rows, setRows] = useState(null)
  const [count, setCount] = useState(0)
  const [products, setProducts] = useState([])
  const [page, setPage] = useState(0)
  const [q, setQ] = useState(sp.get('q') || '')
  const [status, setStatus] = useState(sp.get('status') || '')
  const [product, setProduct] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [err, setErr] = useState('')

  useEffect(() => { supabase.from('products').select('id, name').order('name').then(({ data }) => setProducts(data || [])) }, [])

  const load = useCallback(async () => {
    setErr('')
    let query = supabase.from('download_requests')
      .select('id, request_ref, customer_name, customer_email, whatsapp_number, product_name, status, created_at, whatsapp_sent_at', { count: 'exact' })
      .order('created_at', { ascending: false }).range(page * PAGE, page * PAGE + PAGE - 1)
    const term = q.trim().replace(/[,()*%"\\]/g, ' ').trim()
    if (term) query = query.or(`customer_name.ilike.%${term}%,customer_email.ilike.%${term}%,whatsapp_number.ilike.%${term}%,request_ref.ilike.%${term}%`)
    if (status) query = query.eq('status', status)
    if (product) query = query.eq('product_id', product)
    if (from) query = query.gte('created_at', new Date(from + 'T00:00:00').toISOString())
    if (to) query = query.lte('created_at', new Date(to + 'T23:59:59').toISOString())
    const { data, count: c, error } = await query
    if (error) { setErr('রিকোয়েস্ট লোড করা যায়নি: ' + error.message); setRows([]); return }
    setRows(data || []); setCount(c || 0)
  }, [q, status, product, from, to, page])

  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t) }, [load])
  useEffect(() => { setPage(0) }, [q, status, product, from, to])
  useEffect(() => { const n = new URLSearchParams(); if (status) n.set('status', status); if (q) n.set('q', q); setSp(n, { replace: true }) }, [status, q, setSp])

  const pages = Math.max(1, Math.ceil(count / PAGE))
  return (
    <div>
      <div className="page-head"><h1>ডাউনলোড রিকোয়েস্ট</h1><span className="muted">মোট {count}টি</span></div>
      <div className="glass pad mb-16"><div className="toolbar" style={{ marginBottom: 0 }}>
        <Field label="খুঁজুন (নাম / ইমেইল / WhatsApp / রেফারেন্স)"><input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="খুঁজুন…" /></Field>
        <Field label="স্ট্যাটাস"><select value={status} onChange={(e) => setStatus(e.target.value)}><option value="">সব</option>{STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</select></Field>
        <Field label="প্রোডাক্ট"><select value={product} onChange={(e) => setProduct(e.target.value)}><option value="">সব</option>{products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
        <Field label="তারিখ থেকে"><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
        <Field label="তারিখ পর্যন্ত"><input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
      </div></div>
      {err && <div className="alert error mb-16">{err}</div>}
      <div className="glass">
        {!rows ? <PageLoading /> : (<>
          <div className="table-wrap"><table className="data">
            <thead><tr><th>রেফারেন্স</th><th>গ্রাহক</th><th>WhatsApp</th><th>প্রোডাক্ট</th><th>তারিখ</th><th>স্ট্যাটাস</th><th /></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td><Link className="link" to={`/admin/requests/${r.id}`}>{r.request_ref}</Link></td>
                  <td>{r.customer_name}<span className="sub">{r.customer_email}</span></td>
                  <td className="nowrap">{r.whatsapp_number}{r.whatsapp_sent_at && <span className="sub">কোড Sent ✓</span>}</td>
                  <td>{r.product_name}</td><td className="nowrap">{fmtDateTime(r.created_at)}</td>
                  <td><StatusBadge status={r.status} /></td>
                  <td><Link className="btn sm" to={`/admin/requests/${r.id}`}>খুলুন</Link></td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan="7" className="empty">কোনো রিকোয়েস্ট পাওয়া যায়নি।</td></tr>}
            </tbody>
          </table></div>
          <div className="pager"><span>পৃষ্ঠা {page + 1} / {pages}</span>
            <span className="row"><button className="btn sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>← আগের</button><button className="btn sm" disabled={page + 1 >= pages} onClick={() => setPage((p) => p + 1)}>পরের →</button></span></div>
        </>)}
      </div>
    </div>
  )
}
