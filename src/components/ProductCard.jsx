import { Link } from 'react-router-dom'
import { useSettings } from '../lib/settings.jsx'

export default function ProductCard({ product }) {
  const { s } = useSettings()
  return (
    <article className="glass pcard">
      <Link to={`/product/${product.slug}`} className="thumb" aria-label={product.name}>
        {product.image_url && <img src={product.image_url} alt={product.name} loading="lazy" />}
        <span className="badge free">FREE</span>
      </Link>
      <div className="body">
        <h3><Link to={`/product/${product.slug}`}>{product.name}</Link></h3>
        <p>{product.short_description}</p>
        <div className="meta">
          {product.compatible_software && <span className="chip">{product.compatible_software}</span>}
          {product.version && <span className="chip">v{product.version}</span>}
        </div>
        <Link to={`/request/${product.slug}`} className="btn primary block">{product.cta_label || s.cta_label}</Link>
      </div>
    </article>
  )
}
