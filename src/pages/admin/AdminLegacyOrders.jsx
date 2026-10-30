import { useEffect, useState } from 'react'
import { supabase } from '../../supabaseClient.js'
import { fmtDateTime } from '../../lib/format.js'
import { PageLoading, StatusBadge, useToast } from '../../components/ui.jsx'

// আগের পেমেন্ট সিস্টেমের অর্ডারের শুধু-পড়ার আর্কাইভ। নতুন সিস্টেম এগুলো ব্যবহার করে না।
export default function AdminLegacyOrders() {
  const toast = useToast()
  const [rows, setRows] = useState(null)
  useEffect(() => {
    supabase.from('orders').select('*, products ( name )').order('created_at', { ascending: false }).limit(500).then(({ data }) => setRows(data || []))
  }, [])

  async function proof(path) {
    const { data, error } = await supabase.storage.from('payment-proofs').createSignedUrl(path, 300)
    if (error) toast('ছবি খোলা যায়নি।', 'bad'); else window.open(data.signedUrl, '_blank', 'noopener')
  }
  return (
    <div>
      <div className="page-head"><h1>পুরনো অর্ডার (আর্কাইভ)</h1></div>
      <div className="alert info mb-16">এগুলো আগের পেমেন্ট-ভিত্তিক সিস্টেমের ঐতিহাসিক রেকর্ড। সংরক্ষণের জন্য রাখা হয়েছে; নতুন সিস্টেমে এগুলো আর কোনো কাজে লাগে না এবং পরিবর্তন করা যায় না।</div>
      <div className="glass">{!rows ? <PageLoading /> : (
        <div className="table-wrap"><table className="data">
          <thead><tr><th>অর্ডার</th><th>গ্রাহক</th><th>প্রোডাক্ট</th><th>মূল্য</th><th>Transaction ID</th><th>স্ট্যাটাস</th><th>তারিখ</th><th /></tr></thead>
          <tbody>
            {rows.map((o) => (
              <tr key={o.id}><td>{o.order_code}</td><td>{o.customer_name}<span className="sub">{o.customer_email} · {o.customer_phone}</span></td><td>{o.products?.name || '—'}</td>
                <td>৳{o.price_at_purchase}</td><td>{o.transaction_id}</td><td><StatusBadge status={o.status} /></td><td className="nowrap">{fmtDateTime(o.created_at)}</td>
                <td>{o.screenshot_path && <button className="btn sm" onClick={() => proof(o.screenshot_path)}>স্ক্রিনশট</button>}</td></tr>
            ))}
            {rows.length === 0 && <tr><td colSpan="8" className="empty">কোনো পুরনো অর্ডার নেই।</td></tr>}
          </tbody>
        </table></div>
      )}</div>
    </div>
  )
}
