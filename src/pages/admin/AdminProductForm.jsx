import { useEffect, useState, useRef } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { supabase } from '../../supabaseClient.js'
import { slugify } from '../../../shared/validation.js'
import { describeError } from '../../lib/errors.js'
import { Field, PageLoading, Spinner } from '../../components/ui.jsx'

const empty = {
  name: '', slug: '', short_description: '', full_description: '', version: '', compatible_software: '', features: '',
  category: '', cta_label: '', sort_order: 0, is_featured: false, status: 'active', verification_mode: 'global', image_url: '', file_path: '',
}
const MAX_PRODUCT_FILE = 50 * 1024 * 1024  // Supabase Free Plan সীমা
const MAX_IMAGE = 5 * 1024 * 1024
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
// ফাইলের Extension থেকে শুধু নিরাপদ অক্ষর রাখা (Storage Path ভাঙা/অদ্ভুত নাম আটকাতে)
const safeExt = (name, dflt) => ((name.split('.').length > 1 ? name.split('.').pop() : '') || dflt).toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8) || dflt
const MODE_HELP = {
  global: 'Requirements পেজের "Global" ধাপগুলো দেখাবে।',
  custom: 'শুধু এই প্রোডাক্টের নিজস্ব ধাপ দেখাবে (Global ধাপ বাদ)।',
  combined: 'Global ধাপ + এই প্রোডাক্টের নিজস্ব ধাপ — দুটোই দেখাবে।',
  none: 'কোনো সোশ্যাল ধাপ ছাড়াই শুধু রিকোয়েস্ট ও অনুমোদন।',
}

export default function AdminProductForm() {
  const { id } = useParams()
  const isEdit = !!id
  const navigate = useNavigate()
  const [form, setForm] = useState(empty)
  const [loaded, setLoaded] = useState(!isEdit)
  const [imageFile, setImageFile] = useState(null)
  const [productFile, setProductFile] = useState(null)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const [ownReqs, setOwnReqs] = useState([])
  const [loadErr, setLoadErr] = useState('')
  const inflight = useRef(false)

  useEffect(() => {
    if (!isEdit) return
    let alive = true
    ;(async () => {
      try {
        const { data, error } = await supabase.from('products').select('*').eq('id', id).maybeSingle()
        if (error) throw error
        if (!alive) return
        if (!data) { setLoadErr('প্রোডাক্টটি খুঁজে পাওয়া যায়নি (হয়তো মুছে গেছে)।'); setLoaded(true); return }
        setForm({ ...empty, ...data, category: data.category || '', cta_label: data.cta_label || '', image_url: data.image_url || '', file_path: data.file_path || '' })
        setLoaded(true)
        const { data: rq } = await supabase.from('verification_requirements').select('id, title, is_enabled').eq('product_id', id).order('sort_order')
        if (alive) setOwnReqs(rq || [])
      } catch (e) { if (alive) { setLoadErr(describeError(e, 'প্রোডাক্ট লোড করা যায়নি।')); setLoaded(true) } }
    })()
    return () => { alive = false }
  }, [id, isEdit])

  function set(name, value) {
    setForm((f) => ({ ...f, [name]: value, ...(name === 'name' && !isEdit ? { slug: slugify(value) } : {}) }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (inflight.current) return
    setErr('')
    if (!form.name.trim()) { setErr('প্রোডাক্টের নাম লিখুন।'); return }
    if (!SLUG_RE.test(form.slug)) { setErr('Slug (URL) দিন — শুধু ইংরেজি ছোট হাতের অক্ষর, সংখ্যা ও হাইফেন (যেমন: my-product)।'); return }
    if (imageFile && !imageFile.type.startsWith('image/')) { setErr('প্রোডাক্ট ছবি হিসেবে শুধু ছবির ফাইল দিন।'); return }
    if (imageFile && imageFile.size > MAX_IMAGE) { setErr('ছবিটি অনেক বড় (সর্বোচ্চ ৫ MB)।'); return }
    if (productFile && productFile.size > MAX_PRODUCT_FILE) { setErr('প্রোডাক্ট ফাইলটি ৫০ MB-এর বেশি। Supabase Free Plan-এ এর চেয়ে বড় ফাইল আপলোড হবে না।'); return }

    inflight.current = true
    setSaving(true)
    const newlyUploaded = [] // সংরক্ষণ ব্যর্থ হলে শুধু এই নতুন আপলোড-গুলো মুছে ফেলা হবে (পুরনো ফাইল কখনো ছোঁয়া হয় না)
    try {
      let { image_url, file_path } = form
      const stamp = Date.now()
      if (imageFile) {
        const path = `${form.slug}-${stamp}.${safeExt(imageFile.name, 'jpg')}`
        const { error } = await supabase.storage.from('product-images').upload(path, imageFile, { upsert: false, contentType: imageFile.type })
        if (error) throw error
        newlyUploaded.push(['product-images', path])
        image_url = supabase.storage.from('product-images').getPublicUrl(path).data.publicUrl
      }
      if (productFile) {
        const path = `${form.slug}-${stamp}.${safeExt(productFile.name, 'zip')}`
        const { error } = await supabase.storage.from('product-files').upload(path, productFile, { upsert: false })
        if (error) throw error
        newlyUploaded.push(['product-files', path])
        file_path = path
      }
      const payload = {
        name: form.name.trim(), slug: form.slug, short_description: form.short_description || null, full_description: form.full_description || null,
        version: form.version || null, compatible_software: form.compatible_software || null, features: form.features || null,
        category: form.category.trim() || null, cta_label: form.cta_label.trim() || null, sort_order: Number.parseInt(form.sort_order, 10) || 0,
        is_featured: !!form.is_featured, status: form.status, verification_mode: form.verification_mode, image_url: image_url || null, file_path: file_path || null,
      }
      const q = isEdit ? supabase.from('products').update(payload).eq('id', id).select('id') : supabase.from('products').insert(payload).select('id')
      const { data: saved, error } = await q
      if (error) throw error
      if (isEdit && (!saved || saved.length === 0)) throw Object.assign(new Error('not saved'), { code: 'PGRST116', message: 'প্রোডাক্টটি সংরক্ষণ হয়নি — হয়তো মুছে গেছে বা আপনার অনুমতি নেই।' })
      navigate('/admin/products')
    } catch (e2) {
      for (const [bucket, path] of newlyUploaded) { try { await supabase.storage.from(bucket).remove([path]) } catch { /* ignore */ } }
      setErr(e2.code === '23505' ? 'এই Slug আগে থেকেই আছে। অন্য একটি Slug দিন।' : e2.code === 'PGRST116' ? e2.message : describeError(e2, 'সংরক্ষণ করা যায়নি। আবার চেষ্টা করুন।'))
    } finally { inflight.current = false; setSaving(false) }
  }

  if (!loaded) return <PageLoading />
  if (loadErr) return <div><Link to="/admin/products" className="muted small">← প্রোডাক্ট তালিকা</Link><div className="alert error mt-16" role="alert">{loadErr}</div></div>
  return (
    <div>
      <Link to="/admin/products" className="muted small">← প্রোডাক্ট তালিকা</Link>
      <div className="page-head mt-8"><h1>{isEdit ? 'প্রোডাক্ট এডিট' : 'নতুন প্রোডাক্ট'}</h1></div>
      <form onSubmit={handleSubmit} noValidate className="glass pad-lg form-grid" style={{ maxWidth: 760 }}>
        <Field label="প্রোডাক্টের নাম" required htmlFor="p-name"><input id="p-name" type="text" value={form.name} onChange={(e) => set('name', e.target.value)} required /></Field>
        <Field label="Slug (URL)" required htmlFor="p-slug" hint={`লিংক হবে: /product/${form.slug || '…'}`}><input id="p-slug" type="text" value={form.slug} onChange={(e) => set('slug', slugify(e.target.value))} required /></Field>
        <Field label="সংক্ষিপ্ত বর্ণনা" htmlFor="p-short"><input id="p-short" type="text" value={form.short_description || ''} onChange={(e) => set('short_description', e.target.value)} maxLength={200} /></Field>
        <Field label="পূর্ণ বর্ণনা" htmlFor="p-full"><textarea id="p-full" rows={5} value={form.full_description || ''} onChange={(e) => set('full_description', e.target.value)} /></Field>
        <div className="grid-2">
          <Field label="ভার্সন" htmlFor="p-ver"><input id="p-ver" type="text" value={form.version || ''} onChange={(e) => set('version', e.target.value)} placeholder="1.0.0" /></Field>
          <Field label="সামঞ্জস্যপূর্ণ সফটওয়্যার" htmlFor="p-soft"><input id="p-soft" type="text" value={form.compatible_software || ''} onChange={(e) => set('compatible_software', e.target.value)} placeholder="After Effects 2023+" /></Field>
        </div>
        <Field label="ফিচারসমূহ" hint="প্রতি লাইনে একটি ফিচার লিখুন।" htmlFor="p-feat"><textarea id="p-feat" rows={4} value={form.features || ''} onChange={(e) => set('features', e.target.value)} /></Field>
        <div className="grid-2">
          <Field label="ক্যাটাগরি (ঐচ্ছিক)" htmlFor="p-cat" hint="হোমপেজে ফিল্টার হিসেবে দেখাবে।"><input id="p-cat" type="text" value={form.category} onChange={(e) => set('category', e.target.value)} placeholder="Transitions" /></Field>
          <Field label="বাটনের লেখা (ঐচ্ছিক)" htmlFor="p-cta" hint="খালি রাখলে সাধারণ সেটিংসের লেখা দেখাবে।"><input id="p-cta" type="text" value={form.cta_label} onChange={(e) => set('cta_label', e.target.value)} maxLength={40} /></Field>
        </div>
        <div className="grid-2">
          <Field label="স্ট্যাটাস" htmlFor="p-status"><select id="p-status" value={form.status} onChange={(e) => set('status', e.target.value)}><option value="active">Active — সবাই দেখবে</option><option value="inactive">Inactive — লুকানো</option><option value="archived">Archived</option></select></Field>
          <Field label="ক্রম (ছোট সংখ্যা আগে)" htmlFor="p-sort"><input id="p-sort" type="number" value={form.sort_order} onChange={(e) => set('sort_order', e.target.value)} /></Field>
        </div>
        <label className="switch"><input type="checkbox" checked={form.is_featured} onChange={(e) => set('is_featured', e.target.checked)} />Featured (হোমপেজে আগে দেখাবে)</label>

        <Field label="এই প্রোডাক্টের ভেরিফিকেশন ধাপ" htmlFor="p-mode" hint={MODE_HELP[form.verification_mode]}>
          <select id="p-mode" value={form.verification_mode} onChange={(e) => set('verification_mode', e.target.value)}>
            <option value="global">Global ধাপ ব্যবহার করুন</option><option value="custom">শুধু নিজস্ব ধাপ</option><option value="combined">Global + নিজস্ব</option><option value="none">কোনো ধাপ নেই</option>
          </select>
        </Field>
        {isEdit && ['custom', 'combined'].includes(form.verification_mode) && (
          <div className="alert info small">নিজস্ব ধাপ: {ownReqs.length ? ownReqs.map((r) => r.title + (r.is_enabled ? '' : ' (বন্ধ)')).join(', ') : 'এখনো কোনোটি নেই'}। <Link className="link" to={`/admin/requirements?product=${id}`}>ধাপ যোগ/সম্পাদনা করুন →</Link></div>
        )}

        <Field label="প্রোডাক্ট ছবি" htmlFor="p-img">
          <input id="p-img" type="file" accept="image/*" onChange={(e) => setImageFile(e.target.files[0])} />
          {form.image_url && <img src={form.image_url} className="img-preview mt-8" alt="প্রিভিউ" />}
        </Field>
        <Field label="প্রোডাক্ট ফাইল (Private)" htmlFor="p-file" hint="গ্রাহক এই ফাইল কখনো সরাসরি পাবে না; শুধু বৈধ কোডের পর ২ মিনিটের অস্থায়ী লিংকে ডাউনলোড হবে। Supabase Free Plan-এ প্রতি ফাইল সর্বোচ্চ ৫০ MB।">
          <input id="p-file" type="file" onChange={(e) => setProductFile(e.target.files[0])} />
          {form.file_path && <p className="hint mb-0">বর্তমান ফাইল: <code>{form.file_path}</code>{productFile ? ' (সংরক্ষণ করলে নতুনটি বসবে)' : ''}</p>}
        </Field>

        {err && <div className="alert error" role="alert">{err}</div>}
        <button className="btn primary lg" disabled={saving}>{saving && <Spinner />} {saving ? 'সংরক্ষণ হচ্ছে…' : 'প্রোডাক্ট সংরক্ষণ করুন'}</button>
      </form>
    </div>
  )
}
