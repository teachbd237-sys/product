import { useEffect, useMemo, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../supabaseClient.js'
import { postJson } from '../lib/api.js'
import { prepareScreenshot } from '../lib/image.js'
import { saveMine } from '../lib/myRequests.js'
import { copyText } from '../lib/format.js'
import { useSettings } from '../lib/settings.jsx'
import { normalizePhone } from '../../shared/phone.js'
import { validateName, validateEmail } from '../../shared/validation.js'
import { applicableRequirements, PLATFORMS } from '../../shared/requirements.js'
import { Field, PageLoading, Spinner } from '../components/ui.jsx'

export default function RequestPage() {
  const { slug } = useParams()
  const { s } = useSettings()
  const [product, setProduct] = useState(null)
  const [reqs, setReqs] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ name: '', email: '', whatsapp: '', confirmed: false, website: '' })
  const [shots, setShots] = useState({})
  const [shotErr, setShotErr] = useState({})
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [progress, setProgress] = useState(null)
  const [topError, setTopError] = useState('')
  const [result, setResult] = useState(null)
  const [copied, setCopied] = useState('')

  useEffect(() => {
    (async () => {
      const { data: p } = await supabase.from('products').select('*').eq('slug', slug).eq('status', 'active').maybeSingle()
      setProduct(p || null)
      if (p) {
        const { data: r } = await supabase.from('verification_requirements').select('*').eq('is_enabled', true)
        setReqs(applicableRequirements(p, r || []))
      }
      setLoading(false)
    })()
  }, [slug])

  const shotReqs = reqs.filter((r) => r.requires_screenshot)
  const phone = useMemo(() => (form.whatsapp.trim() ? normalizePhone(form.whatsapp) : null), [form.whatsapp])

  function set(k, v) { setForm((f) => ({ ...f, [k]: v })); setErrors((e) => ({ ...e, [k]: undefined })) }

  async function pickFile(req, file) {
    setShotErr((e) => ({ ...e, [req.id]: '' }))
    if (!file) return
    try {
      const out = await prepareScreenshot(file)
      setShots((x) => ({ ...x, [req.id]: out }))
    } catch (err) { setShotErr((e) => ({ ...e, [req.id]: err.message })) }
  }

  function validate() {
    const e = {}
    if (!validateName(form.name).ok) e.name = 'আপনার সম্পূর্ণ নাম লিখুন (কমপক্ষে ২ অক্ষর)।'
    if (!validateEmail(form.email).ok) e.email = 'সঠিক ইমেইল অ্যাড্রেস দিন (যেমন name@gmail.com)।'
    if (!phone || !phone.ok) e.whatsapp = 'সঠিক WhatsApp নম্বর দিন। বাংলাদেশি নম্বর হলে 01XXXXXXXXX, অন্য দেশের হলে + ও কান্ট্রি কোডসহ লিখুন।'
    if (!form.confirmed) e.confirmed = 'এগিয়ে যেতে নিশ্চিতকরণে টিক দিন।'
    const se = {}
    for (const r of shotReqs) if (r.is_mandatory && !shots[r.id]) se[r.id] = `"${r.title}" ধাপের স্ক্রিনশট আপলোড করুন।`
    setShotErr((x) => ({ ...x, ...se }))
    setErrors(e)
    return Object.keys(e).length === 0 && Object.keys(se).length === 0
  }

  async function submit(ev) {
    ev.preventDefault()
    setTopError('')
    if (!validate()) {
      setTopError('ফর্মে কিছু তথ্য ঠিক নেই। লাল চিহ্নিত অংশগুলো দেখে সংশোধন করুন।')
      document.querySelector('.invalid, .upload.bad')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }
    setSubmitting(true); setProgress(0)
    try {
      const evidence = shotReqs.filter((r) => shots[r.id]).map((r) => ({ requirementId: r.id, mime: 'image/jpeg', data: shots[r.id].data }))
      const r = await postJson('request-submit', {
        productId: product.id, name: form.name, email: form.email, whatsapp: form.whatsapp,
        confirmed: form.confirmed, website: form.website, evidence,
      }, { onProgress: setProgress })
      saveMine({ ref: r.requestRef, key: r.lookupSecret, product: product.name, at: new Date().toISOString() })
      setResult(r)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (err) {
      if (err.fieldErrors && !Array.isArray(err.fieldErrors)) setErrors(err.fieldErrors)
      if (err.requirementId) setShotErr((x) => ({ ...x, [err.requirementId]: err.message }))
      setTopError(err.message)
    } finally { setSubmitting(false); setProgress(null) }
  }

  async function copy(label, text) { if (await copyText(text)) { setCopied(label); setTimeout(() => setCopied(''), 1800) } }

  if (loading) return <main><PageLoading /></main>
  if (!product) return <main className="container section center"><h2>প্রোডাক্টটি খুঁজে পাওয়া যায়নি</h2><Link to="/" className="btn mt-16">হোমে ফিরে যান</Link></main>

  if (result) {
    return (
      <main className="container narrow section">
        <div className="glass pad-lg success-panel">
          <div className="tick">✓</div>
          <h1 style={{ fontSize: 28 }}>রিকোয়েস্ট জমা হয়েছে</h1>
          <p className="muted">{s.msg_submitted}</p>
          <div className="alert warn mt-16" style={{ textAlign: 'left' }}>
            <strong>নিচের রেফারেন্স ও Status Key সংরক্ষণ করুন।</strong> এগুলো দিয়ে পরে রিকোয়েস্টের অবস্থা দেখতে পারবেন। Status Key আর দ্বিতীয়বার দেখানো হবে না।
          </div>
          <div className="grid-2 mt-16">
            <div className="keybox"><span>রিকোয়েস্ট রেফারেন্স</span><b>{result.requestRef}</b><button className="btn sm mt-8" onClick={() => copy('ref', result.requestRef)}>{copied === 'ref' ? 'কপি হয়েছে ✓' : 'কপি করুন'}</button></div>
            <div className="keybox"><span>Status Key (গোপন রাখুন)</span><b>{result.lookupSecret}</b><button className="btn sm mt-8" onClick={() => copy('key', result.lookupSecret)}>{copied === 'key' ? 'কপি হয়েছে ✓' : 'কপি করুন'}</button></div>
          </div>
          <p className="muted small mt-16">এই ডিভাইসের ব্রাউজারেও এগুলো সংরক্ষিত হয়েছে। আপনার WhatsApp নম্বর: <strong>{phone?.e164}</strong></p>
          <div className="row mt-16" style={{ justifyContent: 'center' }}>
            <Link to="/request-status" className="btn primary">স্ট্যাটাস দেখুন</Link>
            <Link to="/" className="btn">হোমে ফিরুন</Link>
          </div>
        </div>
      </main>
    )
  }

  // ধাপের নম্বর গতিশীল: যে ধাপ প্রযোজ্য নয় তা বাদ যায়
  const steps = []
  if (reqs.length) steps.push('follow')
  if (shotReqs.length) steps.push('shots')
  steps.push('info', 'submit')
  const n = (k) => steps.indexOf(k) + 1
  const shotsDone = shotReqs.every((r) => !r.is_mandatory || shots[r.id])
  const infoDone = validateName(form.name).ok && validateEmail(form.email).ok && phone?.ok

  return (
    <main className="container narrow section" style={{ paddingTop: 36 }}>
      <Link to={`/product/${product.slug}`} className="muted small">← {product.name}</Link>
      <div className="row mt-16" style={{ alignItems: 'flex-start' }}>
        {product.image_url && <img src={product.image_url} alt="" style={{ width: 96, height: 60, objectFit: 'cover', borderRadius: 10, border: '1px solid var(--line)' }} />}
        <div><h1 style={{ fontSize: 30, marginBottom: 4 }}>{s.form_heading}</h1><p className="muted mb-0">{product.name} — <span className="badge free">FREE</span></p></div>
      </div>
      <p className="muted mt-16">{s.form_instructions}</p>

      <form className="wizard mt-24" onSubmit={submit} noValidate>
        {reqs.length > 0 && (
          <section className="glass wstep">
            <header><span className="num">{n('follow')}</span><div><h2>ফলো / সাবস্ক্রাইব করুন</h2><p>নিচের প্রতিটি লিংক নতুন ট্যাবে খুলবে।</p></div></header>
            {reqs.map((r) => (
              <div className="task" key={r.id}>
                <div className="t"><b>{r.title}</b>{r.instruction && <span>{r.instruction}</span>}<span className="tag">{PLATFORMS[r.platform]}{r.is_mandatory ? '' : ' · ঐচ্ছিক'}</span></div>
                <a className="btn primary" href={r.target_url} target="_blank" rel="noopener noreferrer">{r.button_label}</a>
              </div>
            ))}
            <p className="alert info small mt-16 mb-0">লিংকে ক্লিক করলেই ফলো বা সাবস্ক্রাইব হয়ে যায় না। আপনাকে নিজে ফলো/সাবস্ক্রাইব করতে হবে এবং তার স্ক্রিনশট নিতে হবে। অ্যাডমিন স্ক্রিনশট দেখে যাচাই করবেন।</p>
          </section>
        )}

        {shotReqs.length > 0 && (
          <section className={`glass wstep${shotsDone ? ' done' : ''}`}>
            <header><span className="num">{shotsDone ? '✓' : n('shots')}</span><div><h2>স্ক্রিনশট আপলোড করুন</h2><p>ফলো বা সাবস্ক্রাইব করার প্রমাণ হিসেবে স্ক্রিনশট আপলোড করুন।</p></div></header>
            {shotReqs.map((r) => (
              <div key={r.id} className={`upload${shots[r.id] ? ' filled' : ''}${shotErr[r.id] ? ' bad' : ''}`}>
                <div className="top"><strong>{r.title}{r.is_mandatory ? <span className="err"> *</span> : <span className="muted small"> (ঐচ্ছিক)</span>}</strong>
                  {shots[r.id] && <button type="button" className="btn sm ghost" onClick={() => setShots((x) => { const c = { ...x }; delete c[r.id]; return c })}>সরিয়ে দিন</button>}</div>
                {shots[r.id] ? <img className="thumb" src={shots[r.id].preview} alt={`${r.title} স্ক্রিনশট`} /> : (
                  <input type="file" accept="image/png,image/jpeg,image/webp" aria-label={`${r.title} স্ক্রিনশট`} onChange={(e) => pickFile(r, e.target.files[0])} />
                )}
                <div className="hint">JPG, PNG বা WEBP। স্ক্রিনশটে আপনার প্রোফাইল/অ্যাকাউন্ট নাম ও "Following / Subscribed" দেখা যেতে হবে।</div>
                {shotErr[r.id] && <div className="err" role="alert">{shotErr[r.id]}</div>}
              </div>
            ))}
          </section>
        )}

        <section className={`glass wstep${infoDone ? ' done' : ''}`}>
          <header><span className="num">{infoDone ? '✓' : n('info')}</span><div><h2>আপনার তথ্য দিন</h2><p>এই তথ্য শুধু অ্যাডমিন দেখতে পাবেন।</p></div></header>
          <div className="form-grid">
            <Field label="পূর্ণ নাম" required error={errors.name} hint="আপনার সম্পূর্ণ নাম লিখুন।" htmlFor="f-name">
              <input id="f-name" type="text" autoComplete="name" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="যেমন: রহিম উদ্দিন" maxLength={80} />
            </Field>
            <Field label="ইমেইল" required error={errors.email} hint="সঠিক ইমেইল অ্যাড্রেস দিন।" htmlFor="f-email">
              <input id="f-email" type="email" autoComplete="email" inputMode="email" value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="name@gmail.com" maxLength={254} />
            </Field>
            <Field label="WhatsApp নম্বর" required error={errors.whatsapp} hint="যে WhatsApp নম্বরে কোড নিতে চান সেটি লিখুন। বাংলাদেশি নম্বরে +880 স্বয়ংক্রিয়ভাবে যুক্ত হবে; অন্য দেশের নম্বর + সহ লিখুন।" htmlFor="f-wa">
              <div className="input-prefix"><span className="prefix">🇧🇩 +880</span>
                <input id="f-wa" type="tel" autoComplete="tel" inputMode="tel" value={form.whatsapp} onChange={(e) => set('whatsapp', e.target.value)} placeholder="01XXXXXXXXX" maxLength={20} /></div>
              {phone && <div className={phone.ok ? 'hint' : 'err'}>{phone.ok ? <>আপনার নম্বর: <strong>{phone.e164}</strong></> : 'নম্বরটি সঠিক মনে হচ্ছে না।'}</div>}
            </Field>
            {/* লুকানো ফাঁদ: মানুষ এটি দেখে না, Bot পূরণ করে */}
            <div style={{ position: 'absolute', left: '-9999px' }} aria-hidden="true"><label>Website<input tabIndex={-1} autoComplete="off" value={form.website} onChange={(e) => set('website', e.target.value)} /></label></div>
            <Field label="নির্বাচিত প্রোডাক্ট"><input type="text" value={product.name} readOnly aria-readonly="true" /></Field>
          </div>
        </section>

        <section className="glass wstep">
          <header><span className="num">{n('submit')}</span><div><h2>রিকোয়েস্ট জমা দিন</h2><p>অ্যাডমিন যাচাই করে WhatsApp-এ কোড পাঠাবেন।</p></div></header>
          <div className={`field${errors.confirmed ? ' invalid' : ''}`}>
            <label className="checkbox"><input type="checkbox" checked={form.confirmed} onChange={(e) => set('confirmed', e.target.checked)} /><span>আমি নির্দেশনাগুলো সম্পন্ন করেছি এবং সঠিক তথ্য দিয়েছি।</span></label>
            {errors.confirmed && <div className="err" role="alert">{errors.confirmed}</div>}
          </div>
          <p className="muted small mt-16">আমরা কখনো আপনার পাসওয়ার্ড, OTP বা সোশ্যাল মিডিয়া অ্যাকাউন্টের অ্যাক্সেস চাই না।</p>
          {topError && <div className="alert error mt-16" role="alert">{topError}</div>}
          {submitting && progress !== null && <div className="mt-16"><div className="progress" aria-label="আপলোড"><i style={{ width: `${progress}%` }} /></div><div className="hint mt-8">আপলোড হচ্ছে… {progress}%</div></div>}
          <button className="btn primary lg block mt-24" disabled={submitting}>{submitting && <Spinner />} {submitting ? 'জমা হচ্ছে…' : 'ডাউনলোড রিকোয়েস্ট পাঠান'}</button>
        </section>
      </form>
    </main>
  )
}
