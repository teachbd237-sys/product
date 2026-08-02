import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient.js'
import ProductCard from '../components/ProductCard.jsx'

export default function Home() {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    const { data } = await supabase
      .from('products')
      .select('*')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
    setProducts(data || [])
    setLoading(false)
  }

  return (
    <main>
      <section className="hero">
        <div className="container">
          <div className="eyebrow">Premium Plugin Marketplace</div>
          <h1>আপনার Website-এর জন্য সেরা Plugin, নিরাপদ bKash Payment-এ।</h1>
          <p className="lead">
            Plugin কিনুন সহজে — bKash-এ Send Money করুন, Payment Proof জমা দিন,
            Verify হওয়ার পর সাথে সাথে Download করুন।
          </p>
        </div>
      </section>

      <section className="section container">
        <h2 className="section-title">সব Product</h2>
        <p className="section-sub">নিচ থেকে আপনার প্রয়োজনীয় Plugin বেছে নিন।</p>

        {loading && <p className="muted">লোড হচ্ছে...</p>}
        {!loading && products.length === 0 && (
          <p className="muted">এখনো কোনো Product যোগ করা হয়নি। Admin Panel থেকে যোগ করুন।</p>
        )}

        <div className="features-grid">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </section>
    </main>
  )
}
