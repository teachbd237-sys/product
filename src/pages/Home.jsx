import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabaseClient.js'
import ProductCard from '../components/ProductCard.jsx'
import { useSettings } from '../lib/settings.jsx'

export default function Home() {
  const { s, ready } = useSettings()
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [cat, setCat] = useState('all')

  useEffect(() => {
    supabase.from('products').select('*').eq('status', 'active')
      .order('is_featured', { ascending: false }).order('sort_order').order('created_at', { ascending: false })
      .then(({ data }) => { setProducts(data || []); setLoading(false) })
  }, [])

  const cats = [...new Set(products.map((p) => p.category).filter(Boolean))]
  const shown = cat === 'all' ? products : products.filter((p) => p.category === cat)
  const featured = products.filter((p) => p.is_featured)

  return (
    <main>
      <section className="hero">
        <div className="container hero-grid">
          <div style={{ minHeight: 240 }}>
            {ready && (<>
              <h1>{s.hero_title}</h1>
              <p className="lead">{s.hero_subtitle}</p>
              <div className="row">
                <a href="#products" className="btn primary lg">{s.cta_label}</a>
                <a href="#how" className="btn lg">কীভাবে কাজ করে</a>
              </div>
            </>)}
          </div>
          <div className="glass timeline" aria-hidden="true">
            <div className="ruler"><span>00:00</span><span>00:05</span><span>00:10</span><span>00:15</span></div>
            <div className="tracks">
              <div className="track"><b>V2</b><div className="lane"><span className="clip b" style={{ left: '30%', width: '48%' }}>Follow / Subscribe</span></div></div>
              <div className="track"><b>V1</b><div className="lane"><span className="clip a" style={{ left: '4%', width: '38%' }}>Request</span><span className="clip c" style={{ left: '46%', width: '44%' }}>Download code</span></div></div>
              <div className="track"><b>A1</b><div className="lane"><span className="clip b" style={{ left: '12%', width: '62%', opacity: 0.7 }}>Admin verification</span></div></div>
              <div className="playhead" />
            </div>
          </div>
        </div>
      </section>

      <section className="section container" id="products" style={{ paddingTop: 24 }}>
        <div className="section-head">
          <h2>{featured.length ? 'প্রোডাক্টসমূহ' : 'সব প্রোডাক্ট'}</h2>
          <p>{s.home_description}</p>
        </div>
        {cats.length > 0 && (
          <div className="filters" role="tablist" aria-label="ক্যাটাগরি">
            <button className={cat === 'all' ? 'on' : ''} onClick={() => setCat('all')}>সব</button>
            {cats.map((c) => <button key={c} className={cat === c ? 'on' : ''} onClick={() => setCat(c)}>{c}</button>)}
          </div>
        )}
        {loading && <div className="product-grid">{[1, 2, 3].map((i) => <div key={i} className="skeleton" style={{ height: 360 }} />)}</div>}
        {!loading && shown.length === 0 && <div className="glass empty">এখনো কোনো প্রোডাক্ট যোগ করা হয়নি।</div>}
        <div className="product-grid">{shown.map((p) => <ProductCard key={p.id} product={p} />)}</div>
      </section>

      <section className="section container" id="how">
        <div className="section-head"><h2>কীভাবে ফ্রিতে ডাউনলোড করবেন</h2><p>চারটি সহজ ধাপে আপনার প্রোডাক্ট পেয়ে যান।</p></div>
        <div className="how">{s.how_steps.map((st, i) => (
          <div className="glass item" key={i}><h3>{st.title}</h3><p>{st.text}</p></div>
        ))}</div>
        <p className="muted small mt-16">দ্রষ্টব্য: কোড WhatsApp-এ অ্যাডমিন নিজে পাঠান, তাই যাচাইয়ে কিছুটা সময় লাগতে পারে। <Link className="link" to="/request-status">রিকোয়েস্টের স্ট্যাটাস দেখুন</Link></p>
      </section>

      {s.faq.length > 0 && (
        <section className="section container narrow" id="faq">
          <div className="section-head"><h2>সাধারণ প্রশ্নোত্তর</h2></div>
          <div className="faq">{s.faq.map((f, i) => (
            <details key={i}><summary>{f.q}</summary><p style={{ whiteSpace: 'pre-line' }}>{f.a}</p></details>
          ))}</div>
        </section>
      )}
    </main>
  )
}
