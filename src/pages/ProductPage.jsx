import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../supabaseClient.js'

export default function ProductPage() {
  const { slug } = useParams()
  const [product, setProduct] = useState(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    load()
  }, [slug])

  async function load() {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('slug', slug)
      .eq('status', 'active')
      .maybeSingle()

    if (error || !data) {
      setNotFound(true)
    } else {
      setProduct(data)
    }
    setLoading(false)
  }

  if (loading) return <main className="container section">লোড হচ্ছে...</main>
  if (notFound) return <main className="container section"><h2>Product খুঁজে পাওয়া যায়নি</h2></main>

  const features = (product.features || '').split('\n').filter(Boolean)

  return (
    <main className="container section">
      <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: 40 }}>
        <div>
          {product.image_url && (
            <img src={product.image_url} alt={product.name} style={{ width: '100%', borderRadius: 12, marginBottom: 24 }} />
          )}
          <h1>{product.name}</h1>
          <p className="muted">{product.compatible_software}</p>
          <p style={{ marginTop: 16, whiteSpace: 'pre-line' }}>{product.full_description}</p>

          {features.length > 0 && (
            <>
              <h3 className="mt-32">Features</h3>
              <div className="features-grid">
                {features.map((f, i) => (
                  <div className="feature-item" key={i}><span className="dot"></span>{f}</div>
                ))}
              </div>
            </>
          )}
        </div>

        <div>
          <div className="card" style={{ position: 'sticky', top: 84 }}>
            <div className="price-tag">৳{product.price} <small>/ Lifetime</small></div>
            <p className="muted mt-8">Version: {product.version || '1.0'}</p>
            <Link to={`/checkout/${product.slug}`} className="btn btn-primary btn-block mt-16">Buy Now</Link>
            <p className="muted mt-16" style={{ fontSize: 13 }}>
              Payment করার পর Transaction ID ও Screenshot জমা দিতে হবে। Admin Verify করার পর
              Download Link পাবেন।
            </p>
          </div>
        </div>
      </div>
    </main>
  )
}
