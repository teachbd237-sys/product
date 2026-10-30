import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../supabaseClient.js'
import { ConfirmDialog, PageLoading, StatusBadge, useToast } from '../../components/ui.jsx'

const MODE = { global: 'Global ধাপ', custom: 'শুধু নিজস্ব ধাপ', combined: 'Global + নিজস্ব', none: 'কোনো ধাপ নেই' }

export default function AdminProducts() {
  const toast = useToast()
  const [products, setProducts] = useState(null)
  const [filter, setFilter] = useState('visible')
  const [del, setDel] = useState(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const { data } = await supabase.from('products').select('*').order('created_at', { ascending: false })
    setProducts(data || [])
  }, [])
  useEffect(() => { load() }, [load])

  async function setStatus(p, status) {
    const { error } = await supabase.from('products').update({ status }).eq('id', p.id)
    if (error) toast(error.message, 'bad'); else { toast(status === 'archived' ? 'আর্কাইভ করা হয়েছে।' : 'আপডেট হয়েছে।'); load() }
  }
  async function remove() {
    setBusy(true)
    const { error } = await supabase.from('products').delete().eq('id', del.id)
    setBusy(false)
    if (error) {
      toast(error.code === '23503' ? 'এই প্রোডাক্টের সাথে কোড/রিকোয়েস্টের রেকর্ড যুক্ত আছে, তাই মোছা যাবে না। বদলে "আর্কাইভ" করুন।' : error.message, 'bad')
    } else { toast('প্রোডাক্ট মোছা হয়েছে।'); load() }
    setDel(null)
  }

  const list = (products || []).filter((p) => (filter === 'visible' ? p.status !== 'archived' : filter === 'all' ? true : p.status === filter))
  return (
    <div>
      <div className="page-head"><h1>প্রোডাক্ট</h1><Link to="/admin/products/new" className="btn primary">+ নতুন প্রোডাক্ট</Link></div>
      <div className="filters">{[['visible', 'সক্রিয় ও নিষ্ক্রিয়'], ['active', 'Active'], ['inactive', 'Inactive'], ['archived', 'Archived'], ['all', 'সব']].map(([k, l]) => <button key={k} className={filter === k ? 'on' : ''} onClick={() => setFilter(k)}>{l}</button>)}</div>
      <div className="glass">{!products ? <PageLoading /> : (
        <div className="table-wrap"><table className="data">
          <thead><tr><th>প্রোডাক্ট</th><th>ভার্সন</th><th>ভেরিফিকেশন ধাপ</th><th>ফাইল</th><th>স্ট্যাটাস</th><th /></tr></thead>
          <tbody>
            {list.map((p) => (
              <tr key={p.id}>
                <td><div className="row" style={{ flexWrap: 'nowrap' }}>{p.image_url ? <img src={p.image_url} alt="" style={{ width: 56, height: 36, objectFit: 'cover', borderRadius: 6 }} /> : <span style={{ width: 56, height: 36 }} className="skeleton" />}<div><strong>{p.name}</strong>{p.is_featured && <span className="chip" style={{ marginLeft: 8 }}>Featured</span>}<span className="sub">/{p.slug}</span></div></div></td>
                <td>{p.version || '—'}</td><td>{MODE[p.verification_mode]}</td>
                <td>{p.file_path ? <span className="badge approved">আপলোড আছে</span> : <span className="badge rejected">ফাইল নেই</span>}</td>
                <td><StatusBadge status={p.status} /></td>
                <td><div className="row" style={{ flexWrap: 'nowrap' }}>
                  <Link to={`/admin/products/${p.id}/edit`} className="btn sm">Edit</Link>
                  {p.status === 'archived' ? <button className="btn sm" onClick={() => setStatus(p, 'inactive')}>পুনরুদ্ধার</button> : <button className="btn sm" onClick={() => setStatus(p, 'archived')}>Archive</button>}
                  <button className="btn danger sm" onClick={() => setDel(p)}>Delete</button>
                </div></td>
              </tr>
            ))}
            {list.length === 0 && <tr><td colSpan="6" className="empty">কোনো প্রোডাক্ট নেই।</td></tr>}
          </tbody>
        </table></div>
      )}</div>
      <ConfirmDialog open={!!del} title="প্রোডাক্ট মুছবেন?" danger confirmLabel="মুছে ফেলুন" busy={busy} onConfirm={remove} onCancel={() => setDel(null)}>
        <strong>{del?.name}</strong> স্থায়ীভাবে মুছে যাবে। রিকোয়েস্ট বা কোডের রেকর্ড থাকলে মোছা যাবে না — তখন Archive করুন (ইতিহাস অক্ষত থাকে)।
      </ConfirmDialog>
    </div>
  )
}
