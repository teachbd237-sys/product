import { Link, NavLink } from 'react-router-dom'
import { useSettings } from '../lib/settings.jsx'

export function BrandMark() {
  const { s } = useSettings()
  return (
    <span className="brand-mark">
      {s.logo_url ? <img src={s.logo_url} alt="" /> : (
        <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round"><path d="M5 7h14M5 12h14M5 17h8" /></svg>
      )}
    </span>
  )
}

export default function Navbar() {
  const { s } = useSettings()
  return (
    <header className="navbar">
      <div className="container">
        <Link to="/" className="brand"><BrandMark />{s.site_name}</Link>
        <nav className="nav-links" aria-label="প্রধান মেনু">
          <NavLink to="/" end>হোম</NavLink>
          <NavLink to="/request-status">রিকোয়েস্ট স্ট্যাটাস</NavLink>
        </nav>
      </div>
    </header>
  )
}
