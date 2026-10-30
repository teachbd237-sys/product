import { useEffect, useState, useCallback, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { adminCall } from '../../lib/api.js'
import { describeError } from '../../lib/errors.js'
import { PLATFORMS } from '../../../shared/requirements.js'
import { ConfirmDialog, Field, PageLoading, useToast, Spinner } from '../../components/ui.jsx'
import { useSettings } from '../../lib/settings.jsx'

const blank = (product_id = '') => ({ title: '', instruction: '', platform: 'youtube', target_url: '', button_label: 'লিংক খুলুন', is_enabled: true, requires_screenshot: true, is_mandatory: true, sort_order: 0, product_id })

export default function AdminRequirements() {
  const toast = useToast()
  const { s } = useSettings()
  const [sp, setSp] = useSearchParams()
  const scope = sp.get('product') || 'all' // all | global | <productId>
  const [rows, setRows] = useState(null)
  const [products, setProducts] = useState([])
  const [edit, setEdit] = useState(null)
  const [del, setDel] = useState(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [fieldErrs, setFieldErrs] = useState({})
  const [loadErr, setLoadErr] = useState('')
  const inflight = useRef(false) // দুইবার Submit (Enter + ক্লিক) আটকানো

  const load = useCallback(async () => {
    setLoadErr('')
    try {
      const r = await adminCall('list-requirements')
      setRows(r.requirements || []); setProducts(r.products || [])
    } catch (e) { setLoadErr(describeError(e, 'ভেরিফিকেশন ধাপ লোড করা যায়নি।')); setRows((x) => x || []) }
  }, [])
  useEffect(() => { load() }, [load])

  const pname = (id) => products.find((p) => p.id === id)?.name || 'অজানা প্রোডাক্ট'
  const list = (rows || []).filter((r) => (scope === 'all' ? true : scope === 'global' ? !r.product_id : r.product_id === scope))

  function quick(kind) {
    const base = blank(scope !== 'all' && scope !== 'global' ? scope : '')
    const presets = {
      youtube: { platform: 'youtube', title: 'YouTube চ্যানেল Subscribe করুন', instruction: 'প্রথমে আমাদের YouTube চ্যানেলটি Subscribe করুন। Subscribe করার পর একটি স্ক্রিনশট নিন।', target_url: s.social_youtube, button_label: 'চ্যানেল খুলুন' },
      fb_profile: { platform: 'facebook_profile', title: 'Facebook প্রোফাইল ফলো করুন', instruction: 'আমাদের Facebook প্রোফাইলটি Follow করুন এবং স্ক্রিনশট নিন।', target_url: s.social_facebook, button_label: 'প্রোফাইল খুলুন' },
      fb_page: { platform: 'facebook_page', title: 'Facebook পেজ ফলো করুন', instruction: 'আমাদের Facebook পেজটি Like ও Follow করুন এবং স্ক্রিনশট নিন।', target_url: s.social_facebook, button_label: 'পেজ খুলুন' },
      fb_group: { platform: 'facebook_group', title: 'Facebook গ্রুপে জয়েন করুন', instruction: 'আমাদের Facebook গ্রুপে Join করুন এবং স্ক্রিনশট নিন।', target_url: s.social_group, button_label: 'গ্রুপ খুলুন' },
      instagram: { platform: 'instagram', title: 'Instagram ফলো করুন', instruction: 'আমাদের Instagram অ্যাকাউন্টটি Follow করুন এবং স্ক্রিনশট নিন।', target_url: s.social_instagram, button_label: 'Instagram খুলুন' },
      custom: { platform: 'website', title: '', instruction: '', target_url: '', button_label: 'লিংক খুলুন', requires_screenshot: false },
    }
    setErr(''); setFieldErrs({}); setEdit({ ...base, ...presets[kind], sort_order: ((rows || []).reduce((m, r) => Math.max(m, Number(r.sort_order) || 0), 0)) + 10 })
  }

  async function save() {
    if (inflight.current) return
    // Browser-স্তরের দ্রুত যাচাই (আসল যাচাই Server-এ হয়)
    const fe = {}
    if (!edit.title.trim()) fe.title = 'শিরোনাম লিখুন।'
    if (!/^https?:\/\/\S+$/i.test(edit.target_url.trim())) fe.target_url = 'সঠিক লিংক দিন (https:// দিয়ে শুরু)।'
    if (!edit.button_label.trim()) fe.button_label = 'বাটনের লেখা দিন।'
    setFieldErrs(fe)
    if (Object.keys(fe).length) { setErr(Object.values(fe)[0]); return }
    inflight.current = true
    setBusy(true); setErr('')
    try {
      await adminCall('upsert-requirement', { requirement: { ...edit, product_id: edit.product_id || null, sort_order: Number(edit.sort_order) || 0 } })
      toast('সংরক্ষিত হয়েছে।'); setEdit(null); setFieldErrs({}); load()
    } catch (e) {
      if (e.fieldErrors && typeof e.fieldErrors === 'object' && !Array.isArray(e.fieldErrors)) setFieldErrs(e.fieldErrors)
      setErr(describeError(e, 'ধাপটি সংরক্ষণ করা যায়নি। আবার চেষ্টা করুন।'))
    } finally { inflight.current = false; setBusy(false) }
  }
  async function toggle(r) {
    try {
      const { id, title, instruction, platform, target_url, button_label, product_id, requires_screenshot, is_mandatory, sort_order } = r
      await adminCall('upsert-requirement', { requirement: { id, title, instruction, platform, target_url, button_label, product_id: product_id || null, requires_screenshot, is_mandatory, sort_order, is_enabled: !r.is_enabled } })
      toast(r.is_enabled ? 'ধাপটি বন্ধ করা হয়েছে।' : 'ধাপটি চালু করা হয়েছে।'); load()
    } catch (e) { toast(describeError(e), 'bad') }
  }
  async function remove() {
    setBusy(true)
    try { await adminCall('delete-requirement', { id: del.id }); toast('মুছে ফেলা হয়েছে।'); setDel(null); load() } catch (e) { toast(describeError(e), 'bad'); if (e.status === 404) { setDel(null); load() } } finally { setBusy(false) }
  }
  async function move(r, dir) {
    const group = list.map((x) => x.id)
    const i = group.indexOf(r.id), j = i + dir
    if (j < 0 || j >= group.length) return
    ;[group[i], group[j]] = [group[j], group[i]]
    try { await adminCall('reorder-requirements', { ids: group }); load() } catch (e) { toast(describeError(e), 'bad') }
  }
  const upd = (k, v) => setEdit((x) => ({ ...x, [k]: v }))

  return (
    <div>
      <div className="page-head"><h1>ভেরিফিকেশন ধাপ</h1></div>
      <div className="glass pad mb-16">
        <div className="toolbar" style={{ marginBottom: 0 }}>
          <Field label="কোন ধাপগুলো দেখবেন"><select value={scope} onChange={(e) => setSp(e.target.value === 'all' ? {} : { product: e.target.value })}>
            <option value="all">সব</option><option value="global">শুধু Global</option>{products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
        </div>
        <p className="label mt-16">নতুন ধাপ যোগ করুন</p>
        <div className="row">
          <button className="btn sm" onClick={() => quick('youtube')}>+ YouTube</button><button className="btn sm" onClick={() => quick('fb_profile')}>+ Facebook প্রোফাইল</button>
          <button className="btn sm" onClick={() => quick('fb_page')}>+ Facebook পেজ</button><button className="btn sm" onClick={() => quick('fb_group')}>+ Facebook গ্রুপ</button>
          <button className="btn sm" onClick={() => quick('instagram')}>+ Instagram</button><button className="btn sm" onClick={() => quick('custom')}>+ কাস্টম লিংক</button>
        </div>
        <p className="hint mt-16 mb-0">"Global" ধাপ সব প্রোডাক্টে দেখায় (যেগুলোর ভেরিফিকেশন সেটিং Global বা Global + নিজস্ব)। কোনো প্রোডাক্ট বেছে ধাপ যোগ করলে সেটি শুধু ঐ প্রোডাক্টের নিজস্ব ধাপ হবে।</p>
      </div>

      {loadErr && <div className="alert error mb-16" role="alert"><div>{loadErr}</div><button className="btn sm mt-8" onClick={load}>আবার চেষ্টা করুন</button></div>}
      {!rows ? <PageLoading /> : loadErr && rows.length === 0 ? null : list.length === 0 ? <div className="glass empty">এখনো কোনো ধাপ নেই। উপরের বাটন দিয়ে যোগ করুন।</div> : (
        <div className="glass table-wrap"><table className="data">
          <thead><tr><th>ক্রম</th><th>ধাপ</th><th>কার জন্য</th><th>নিয়ম</th><th>চালু</th><th /></tr></thead>
          <tbody>{list.map((r, i) => (
            <tr key={r.id}>
              <td className="nowrap"><button className="btn sm ghost" disabled={i === 0} onClick={() => move(r, -1)} aria-label="উপরে">↑</button><button className="btn sm ghost" disabled={i === list.length - 1} onClick={() => move(r, 1)} aria-label="নিচে">↓</button></td>
              <td><strong>{r.title}</strong><span className="sub">{PLATFORMS[r.platform]} · <a className="link" href={r.target_url} target="_blank" rel="noopener noreferrer">লিংক</a></span></td>
              <td>{r.product_id ? <span className="chip">{pname(r.product_id)}</span> : <span className="chip">Global</span>}</td>
              <td className="small">{r.is_mandatory ? 'বাধ্যতামূলক' : 'ঐচ্ছিক'}<span className="sub">{r.requires_screenshot ? 'স্ক্রিনশট লাগবে' : 'স্ক্রিনশট লাগবে না'}</span></td>
              <td><label className="switch"><input type="checkbox" checked={r.is_enabled} onChange={() => toggle(r)} aria-label="চালু/বন্ধ" /></label></td>
              <td><div className="row" style={{ flexWrap: 'nowrap' }}><button className="btn sm" onClick={() => { setErr(''); setFieldErrs({}); setEdit({ ...r, product_id: r.product_id || '' }) }}>Edit</button><button className="btn danger sm" onClick={() => setDel(r)}>Delete</button></div></td>
            </tr>))}</tbody>
        </table></div>
      )}

      {edit && (
        <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) setEdit(null) }}>
          <form className="modal wide form-grid" onSubmit={(e) => { e.preventDefault(); save() }} noValidate role="dialog" aria-modal="true" aria-label="ধাপ সম্পাদনা">
            <h3 className="mb-0">{edit.id ? 'ধাপ সম্পাদনা' : 'নতুন ধাপ'}</h3>
            <Field label="শিরোনাম" required htmlFor="r-title" error={fieldErrs.title}><input id="r-title" type="text" value={edit.title} onChange={(e) => upd('title', e.target.value)} maxLength={120} required /></Field>
            <Field label="ছোট নির্দেশনা" htmlFor="r-ins" hint="গ্রাহক এটি ধাপের নিচে দেখবে।"><textarea id="r-ins" rows={2} value={edit.instruction} onChange={(e) => upd('instruction', e.target.value)} maxLength={500} /></Field>
            <div className="grid-2">
              <Field label="প্ল্যাটফর্ম" htmlFor="r-plat"><select id="r-plat" value={edit.platform} onChange={(e) => upd('platform', e.target.value)}>{Object.entries(PLATFORMS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
              <Field label="বাটনের লেখা" htmlFor="r-btn" error={fieldErrs.button_label}><input id="r-btn" type="text" value={edit.button_label} onChange={(e) => upd('button_label', e.target.value)} maxLength={40} required /></Field>
            </div>
            <Field label="লিংক (https://…)" required htmlFor="r-url" error={fieldErrs.target_url}><input id="r-url" type="url" value={edit.target_url} onChange={(e) => upd('target_url', e.target.value)} placeholder="https://www.youtube.com/@yourchannel" required /></Field>
            <Field label="কার জন্য" htmlFor="r-scope"><select id="r-scope" value={edit.product_id} onChange={(e) => upd('product_id', e.target.value)}><option value="">Global (সব প্রোডাক্ট)</option>{products.map((p) => <option key={p.id} value={p.id}>শুধু: {p.name}</option>)}</select></Field>
            <div className="row">
              <label className="switch"><input type="checkbox" checked={edit.is_enabled} onChange={(e) => upd('is_enabled', e.target.checked)} />চালু</label>
              <label className="switch"><input type="checkbox" checked={edit.is_mandatory} onChange={(e) => upd('is_mandatory', e.target.checked)} />বাধ্যতামূলক</label>
              <label className="switch"><input type="checkbox" checked={edit.requires_screenshot} onChange={(e) => upd('requires_screenshot', e.target.checked)} />স্ক্রিনশট লাগবে</label>
            </div>
            {err && <div className="alert error" role="alert">{err}</div>}
            <div className="actions"><button type="button" className="btn ghost" onClick={() => setEdit(null)} disabled={busy}>বাতিল</button><button className="btn primary" disabled={busy}>{busy && <Spinner />} সংরক্ষণ</button></div>
          </form>
        </div>
      )}
      <ConfirmDialog open={!!del} title="ধাপটি মুছবেন?" danger confirmLabel="মুছে ফেলুন" busy={busy} onConfirm={remove} onCancel={() => setDel(null)}>
        <strong>{del?.title}</strong> মুছে গেলে নতুন রিকোয়েস্টে আর দেখাবে না। পুরনো রিকোয়েস্টের তথ্য অক্ষত থাকবে। শুধু সাময়িক বন্ধ করতে চাইলে "চালু" সুইচ বন্ধ করুন।
      </ConfirmDialog>
    </div>
  )
}
