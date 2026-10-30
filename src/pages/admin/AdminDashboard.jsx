import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../supabaseClient.js'
import { PageLoading, StatusBadge } from '../../components/ui.jsx'
import { fmtDateTime } from '../../lib/format.js'

export default function AdminDashboard() {
  const [stats, setStats] = useState(null)
  const [recent, setRecent] = useState([])
  const [err, setErr] = useState('')

  useEffect(() => {
    (async () => {
      // সব সংখ্যা Database থেকে আসল; Admin ছাড়া অন্য কেউ এই ফাংশন চালাতে পারে না
      const { data, error } = await supabase.rpc('admin_dashboard_stats')
      if (error) { setErr('পরিসংখ্যান লোড করা যায়নি। নতুন Migration চালিয়েছেন কিনা দেখুন (supabase/MIGRATION_GUIDE.md)।'); return }
      setStats(data)
      const { data: r } = await supabase.from('download_requests')
        .select('id, request_ref, customer_name, product_name, status, created_at').order('created_at', { ascending: false }).limit(8)
      setRecent(r || [])
    })()
  }, [])

  if (err) return <div className="alert error">{err}</div>
  if (!stats) return <PageLoading />
  const max = Math.max(1, ...stats.popular_products.map((p) => p.requests))
  const cards = [
    ['মোট প্রোডাক্ট', stats.total_products, ''], ['মোট রিকোয়েস্ট', stats.total_requests, ''],
    ['Pending রিকোয়েস্ট', stats.pending_requests, 'warn'], ['Approved রিকোয়েস্ট', stats.approved_requests, 'good'],
    ['Rejected রিকোয়েস্ট', stats.rejected_requests, 'bad'], ['Redeemed কোড', stats.redeemed_codes, 'blue'],
    ['অব্যবহৃত Approved কোড', stats.unused_codes, 'good'],
  ]
  return (
    <div>
      <div className="page-head"><h1>ওভারভিউ</h1>{stats.pending_requests > 0 && <Link to="/admin/requests?status=pending" className="btn primary">{stats.pending_requests}টি Pending দেখুন</Link>}</div>
      <div className="stat-grid">{cards.map(([l, n, k]) => <div key={l} className={`glass stat ${k}`}><div className="n">{n}</div><div className="l">{l}</div></div>)}</div>
      <div className="detail-grid">
        <section className="glass">
          <div className="row between" style={{ padding: '18px 20px 0' }}><h3 className="mb-0">সাম্প্রতিক রিকোয়েস্ট</h3><Link className="link small" to="/admin/requests">সব দেখুন</Link></div>
          <div className="table-wrap"><table className="data" style={{ minWidth: 520 }}><tbody>
            {recent.map((r) => (
              <tr key={r.id}><td><Link to={`/admin/requests/${r.id}`} className="link">{r.request_ref}</Link><span className="sub">{fmtDateTime(r.created_at)}</span></td>
                <td>{r.customer_name}<span className="sub">{r.product_name}</span></td><td><StatusBadge status={r.status} /></td></tr>
            ))}
            {recent.length === 0 && <tr><td className="empty">এখনো কোনো রিকোয়েস্ট আসেনি।</td></tr>}
          </tbody></table></div>
        </section>
        <section className="glass pad">
          <h3>জনপ্রিয় প্রোডাক্ট</h3>
          {stats.popular_products.length === 0 && <p className="muted">এখনো কোনো ডাটা নেই।</p>}
          {stats.popular_products.map((p) => (
            <div key={p.name} style={{ marginBottom: 14 }}>
              <div className="row between small"><span>{p.name}</span><strong>{p.requests}</strong></div>
              <div className="progress mt-8"><i style={{ width: `${(p.requests / max) * 100}%` }} /></div>
            </div>
          ))}
        </section>
      </div>
    </div>
  )
}
