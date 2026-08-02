import { Link } from 'react-router-dom'

export default function Navbar() {
  return (
    <header className="navbar">
      <div className="container">
        <Link to="/" className="brand">
          <span className="brand-mark">P</span>
          PluginHub
        </Link>
        <nav style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
          <Link to="/track-order" className="muted" style={{ fontSize: 14 }}>Order Status Check</Link>
        </nav>
      </div>
    </header>
  )
}
