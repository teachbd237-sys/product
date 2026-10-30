import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../../supabaseClient.js'
import { adminCall } from '../../lib/api.js'
import { describeError } from '../../lib/errors.js'
import { SETTING_GROUPS, SETTINGS_SCHEMA, TEMPLATE_PLACEHOLDERS } from '../../../shared/settingsSchema.js'
import { DEFAULT_SETTINGS, mergeSettings } from '../../../shared/defaults.js'
import { renderTemplate } from '../../../shared/whatsapp.js'
import { Field, PageLoading, Spinner, useToast } from '../../components/ui.jsx'
import { useSettings } from '../../lib/settings.jsx'

export default function AdminSettings() {
  const toast = useToast()
  const { reload } = useSettings()
  const [vals, setVals] = useState(null)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const [uploading, setUploading] = useState('')
  const [dirty, setDirty] = useState(false)

  const [loadErr, setLoadErr] = useState('')
  const load = useCallback(async () => {
    setLoadErr('')
    // Admin হিসেবে Private (whatsapp_template) সহ সব সেটিং পড়া যায় (RLS)।
    // লোড ব্যর্থ হলে ফর্ম দেখানো হয় না: নইলে ডিফল্ট মান আসল সেটিংসের উপর Save হয়ে ডাটা হারাত।
    const { data, error } = await supabase.from('website_settings').select('key, value')
    if (error) { setLoadErr(describeError(error, 'সেটিংস লোড করা যায়নি।')); return }
    setVals(mergeSettings(data || []))
  }, [])
  useEffect(() => { load() }, [load])

  const set = (k, v) => { setVals((x) => ({ ...x, [k]: v })); setDirty(true) }

  async function upload(key, file) {
    if (!file) return
    setUploading(key); setErr('')
    try {
      const ext = ((file.name.includes('.') ? file.name.split('.').pop() : '') || 'png').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8) || 'png'
      const path = `site/${key}-${Date.now()}.${ext}`
      const { error } = await supabase.storage.from('product-images').upload(path, file, { upsert: true })
      if (error) throw error
      set(key, supabase.storage.from('product-images').getPublicUrl(path).data.publicUrl)
    } catch (e) { setErr('ছবি আপলোড করা যায়নি: ' + describeError(e)) } finally { setUploading('') }
  }

  async function save() {
    setSaving(true); setErr('')
    try {
      const payload = {}
      for (const k of Object.keys(SETTINGS_SCHEMA)) payload[k] = vals[k]
      await adminCall('save-settings', { settings: payload })
      toast('সেটিংস সংরক্ষিত হয়েছে।'); setDirty(false); reload()
    } catch (e) { setErr(describeError(e, 'সেটিংস সংরক্ষণ করা যায়নি।')) } finally { setSaving(false) }
  }

  if (loadErr) return <div className="alert error" role="alert"><div>{loadErr}</div><button className="btn sm mt-8" onClick={load}>আবার চেষ্টা করুন</button></div>
  if (!vals) return <PageLoading />

  function renderField(key, def) {
    const id = `set-${key}`
    switch (def.type) {
      case 'longtext':
        return <Field key={key} label={def.label} htmlFor={id} hint={key === 'whatsapp_template' ? undefined : `সর্বোচ্চ ${def.max} অক্ষর`}>
          <textarea id={id} rows={key === 'whatsapp_template' ? 12 : 3} value={vals[key] || ''} onChange={(e) => set(key, e.target.value)} maxLength={def.max} /></Field>
      case 'image':
        return <Field key={key} label={def.label} htmlFor={id} hint="PNG / JPG / SVG / ICO ছবি আপলোড করুন।">
          <input id={id} type="file" accept="image/*" onChange={(e) => upload(key, e.target.files[0])} />
          {uploading === key && <div className="hint"><Spinner /> আপলোড হচ্ছে…</div>}
          {vals[key] && <div className="row mt-8"><img src={vals[key]} className="img-preview" alt="" /><button type="button" className="btn sm" onClick={() => set(key, '')}>সরিয়ে দিন</button></div>}</Field>
      case 'json_steps':
        return <div key={key} className="field"><span className="label">{def.label}</span>
          {vals[key].map((st, i) => (
            <div className="rep-item" key={i}>
              <input type="text" aria-label="ধাপের শিরোনাম" value={st.title} onChange={(e) => set(key, vals[key].map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} placeholder="শিরোনাম" maxLength={80} />
              <textarea aria-label="ধাপের বর্ণনা" rows={2} value={st.text} onChange={(e) => set(key, vals[key].map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))} placeholder="বর্ণনা" maxLength={240} />
              <button type="button" className="btn danger sm" onClick={() => set(key, vals[key].filter((_, j) => j !== i))}>মুছুন</button>
            </div>))}
          {vals[key].length < 8 && <button type="button" className="btn sm" onClick={() => set(key, [...vals[key], { title: '', text: '' }])}>+ ধাপ যোগ করুন</button>}</div>
      case 'json_faq':
        return <div key={key} className="field"><span className="label">{def.label}</span>
          {vals[key].map((f, i) => (
            <div className="rep-item" key={i}>
              <input type="text" aria-label="প্রশ্ন" value={f.q} onChange={(e) => set(key, vals[key].map((x, j) => (j === i ? { ...x, q: e.target.value } : x)))} placeholder="প্রশ্ন" maxLength={160} />
              <textarea aria-label="উত্তর" rows={3} value={f.a} onChange={(e) => set(key, vals[key].map((x, j) => (j === i ? { ...x, a: e.target.value } : x)))} placeholder="উত্তর" maxLength={600} />
              <button type="button" className="btn danger sm" onClick={() => set(key, vals[key].filter((_, j) => j !== i))}>মুছুন</button>
            </div>))}
          {vals[key].length < 12 && <button type="button" className="btn sm" onClick={() => set(key, [...vals[key], { q: '', a: '' }])}>+ প্রশ্ন যোগ করুন</button>}</div>
      default:
        return <Field key={key} label={def.label} htmlFor={id}>
          <input id={id} type={def.type === 'url' ? 'url' : def.type === 'email' ? 'email' : 'text'} value={vals[key] || ''} onChange={(e) => set(key, e.target.value)} maxLength={def.max || 500} placeholder={def.type === 'url' ? 'https://…' : ''} /></Field>
    }
  }

  const sample = renderTemplate(vals.whatsapp_template, { customer_name: 'রহিম', product_name: 'Glitch Transition Pack', code: 'SF-ABCD-2345-EFGH-6789', product_url: `${window.location.origin}/product/glitch-pack`, website_name: vals.site_name })

  return (
    <div>
      <div className="page-head"><h1>ওয়েবসাইট সেটিংস</h1></div>
      <p className="muted">এখানে বদলালে GitHub-এ কোড বদলাতে হয় না। ফাঁকা রাখলে Default লেখা ব্যবহার হবে।</p>
      {SETTING_GROUPS.map((g, gi) => (
        <details className="glass settings-group" key={g.id} open={gi === 0}>
          <summary>{g.title}</summary>
          <div className="inner">
            {Object.entries(SETTINGS_SCHEMA).filter(([, d]) => d.group === g.id).map(([k, d]) => renderField(k, d))}
            {g.id === 'whatsapp' && (<>
              <div><span className="label">ব্যবহারযোগ্য Placeholder (ক্লিক করলে কপি হবে):</span>
                <div className="row mt-8">{TEMPLATE_PLACEHOLDERS.map((p) => <button type="button" key={p} className="chip" style={{ cursor: 'pointer' }} onClick={() => navigator.clipboard?.writeText(p)}>{p}</button>)}</div>
                <p className="hint mt-8">{'{code}'} অবশ্যই থাকতে হবে। <button type="button" className="link" style={{ background: 'none', border: 0, color: '#8fb0ff', cursor: 'pointer' }} onClick={() => set('whatsapp_template', DEFAULT_SETTINGS.whatsapp_template)}>Default টেমপ্লেট ফিরিয়ে আনুন</button></p></div>
              <div><span className="label">প্রিভিউ (নমুনা তথ্যে)</span><div className="msg-preview mt-8">{sample}</div></div>
            </>)}
          </div>
        </details>
      ))}
      <div className="glass savebar">
        <span className={dirty ? 'warn-line' : 'muted small'}>{dirty ? '⚠ অসংরক্ষিত পরিবর্তন আছে' : 'সব পরিবর্তন সংরক্ষিত'}</span>
        {err && <span className="err">{err}</span>}
        <button className="btn primary" onClick={save} disabled={saving || !dirty}>{saving && <Spinner />} সংরক্ষণ করুন</button>
      </div>
    </div>
  )
}
