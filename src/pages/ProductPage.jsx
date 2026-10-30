import { useEffect, useState, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../supabaseClient.js'
import { useSettings } from '../lib/settings.jsx'
import RedeemCard from '../components/RedeemCard.jsx'
import { describeError } from '../lib/errors.js'
import { PageLoading } from '../components/ui.jsx'

export default function ProductPage() {
  const { slug } = useParams()
  const { s } = useSettings()
  const [product, setProduct] = useState(null)
  const [loading, setLoading] = useState(true)

  const [loadErr, setLoadErr] = useState('')
  const load = useCallback(async () => {
    setLoading(true); setLoadErr('')
    const { data, error } = await supabase.from('products').select('*').eq('slug', slug).eq('status', 'active').maybeSingle()
    if (error) setLoadErr(describeError(error, 'প্রোডাক্ট লোড করা যায়নি।'))
    setProduct(error ? null : data || null); setLoading(false)
  }, [slug])
  useEffect(() => { load() }, [load])

  if (loading) return <main><PageLoading /></main>
  if (loadErr) return <main className="container section center"><div className="alert error" role="alert">{loadErr}</div><button className="btn mt-16" onClick={load}>আবার চেষ্টা করুন</button></main>
  if (!product) return <main className="container section center"><h2>প্রোডাক্টটি খুঁজে পাওয়া যায়নি</h2><Link to="/" className="btn mt-16">হোমে ফিরে যান</Link></main>
  const features = (product.features || '').split('\n').map((x) => x.trim()).filter(Boolean)

  return (
    <main className="container section" style={{ paddingTop: 36 }}>
      <div className="product-layout">
        <div>
          <div className="preview">{product.image_url && <img src={product.image_url} alt={product.name} />}</div>
          <div className="row mt-24"><span className="badge free">FREE</span>{product.category && <span className="chip">{product.category}</span>}</div>
          <h1 className="mt-8">{product.name}</h1>
          {product.full_description && <p className="muted" style={{ whiteSpace: 'pre-line', fontSize: 17 }}>{product.full_description}</p>}
          {features.length > 0 && (<><h2 className="mt-32">ফিচারসমূহ</h2><div className="feature-list">{features.map((f, i) => <div key={i}>{f}</div>)}</div></>)}

          <h2 className="mt-48">কীভাবে পাবেন</h2>
          <div className="how">{s.how_steps.map((st, i) => <div className="glass item" key={i}><h3>{st.title}</h3><p>{st.text}</p></div>)}</div>
        </div>

        <aside className="sticky-col">
          <div className="glass pad-lg">
            <div className="row between"><strong style={{ fontSize: 22 }}>ফ্রি ডাউনলোড</strong><span className="badge free">FREE</span></div>
            <div className="kv mt-16">
              <div><span>ভার্সন</span><span>{product.version ? `v${product.version}` : '—'}</span></div>
              <div><span>সামঞ্জস্যপূর্ণ সফটওয়্যার</span><span>{product.compatible_software || '—'}</span></div>
            </div>
            <Link to={`/request/${product.slug}`} className="btn primary lg block mt-24">{product.cta_label || s.cta_label}</Link>
            <p className="muted small mt-16 mb-0">ধাপগুলো সম্পন্ন করে রিকোয়েস্ট পাঠান। অ্যাডমিন যাচাই করে WhatsApp-এ কোড দেবেন।</p>
          </div>
          <RedeemCard product={product} />
        </aside>
      </div>
    </main>
  )
}
