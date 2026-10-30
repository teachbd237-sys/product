import { Link } from 'react-router-dom'
import { useSettings } from '../lib/settings.jsx'

export default function Footer() {
  const { s } = useSettings()
  const socials = [['Facebook', s.social_facebook], ['YouTube', s.social_youtube], ['Instagram', s.social_instagram], ['Facebook Group', s.social_group]].filter(([, u]) => u)
  return (
    <footer className="footer">
      <div className="container">
        <div className="cols">
          <div style={{ maxWidth: 420 }}>
            <div className="brand mb-8">{s.site_name}</div>
            <p className="mb-0">{s.footer_description}</p>
            {s.contact_email && <p className="mt-8 mb-0">যোগাযোগ: <a className="link" href={`mailto:${s.contact_email}`}>{s.contact_email}</a></p>}
          </div>
          <div>
            {socials.length > 0 && <div className="socials">{socials.map(([n, u]) => <a key={n} href={u} target="_blank" rel="noopener noreferrer">{n}</a>)}</div>}
            <p className="mt-16 mb-0"><Link className="link" to="/request-status">আপনার রিকোয়েস্টের স্ট্যাটাস দেখুন</Link></p>
          </div>
        </div>
        <div className="copy">© {new Date().getFullYear()} {s.site_name}। সকল অধিকার সংরক্ষিত।</div>
      </div>
    </footer>
  )
}
