import { Link } from 'react-router-dom'

export default function ProductCard({ product }) {
  return (
    <div className="card">
      {product.image_url && (
        <img
          src={product.image_url}
          alt={product.name}
          style={{ width: '100%', borderRadius: 8, marginBottom: 16, aspectRatio: '16/9', objectFit: 'cover' }}
        />
      )}
      <h3 style={{ fontSize: 20 }}>{product.name}</h3>
      <p className="muted" style={{ fontSize: 14, minHeight: 42 }}>{product.short_description}</p>
      <div className="flex-between mt-16">
        <span className="price-tag" style={{ fontSize: 24 }}>৳{product.price}</span>
        <Link to={`/product/${product.slug}`} className="btn btn-primary">Details দেখুন</Link>
      </div>
    </div>
  )
}
