import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../supabaseClient.js'

const empty = {
  name: '', slug: '', short_description: '', full_description: '',
  price: '', version: '', compatible_software: '', features: '',
  status: 'active', image_url: '', file_path: '',
}

export default function AdminProductForm() {
  const { id } = useParams()
  const isEdit = !!id
  const navigate = useNavigate()

  const [form, setForm] = useState(empty)
  const [imageFile, setImageFile] = useState(null)
  const [productFile, setProductFile] = useState(null)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    if (isEdit) load()
  }, [id])

  async function load() {
    const { data } = await supabase.from('products').select('*').eq('id', id).maybeSingle()
    if (data) setForm(data)
  }

  function handleChange(e) {
    const { name, value } = e.target
    setForm((f) => ({
      ...f,
      [name]: value,
      slug: name === 'name' && !isEdit ? value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') : f.slug,
    }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setErr('')
    setSaving(true)
    try {
      let image_url = form.image_url
      let file_path = form.file_path

      if (imageFile) {
        const ext = imageFile.name.split('.').pop()
        const path = `${form.slug}-${Date.now()}.${ext}`
        const { error: upErr } = await supabase.storage.from('product-images').upload(path, imageFile, { upsert: true })
        if (upErr) throw upErr
        const { data: pub } = supabase.storage.from('product-images').getPublicUrl(path)
        image_url = pub.publicUrl
      }

      if (productFile) {
        const ext = productFile.name.split('.').pop()
        const path = `${form.slug}-${Date.now()}.${ext}`
        const { error: upErr } = await supabase.storage.from('product-files').upload(path, productFile, { upsert: true })
        if (upErr) throw upErr
        file_path = path
      }

      const payload = { ...form, image_url, file_path, price: Number(form.price) }
      delete payload.id
      delete payload.created_at

      if (isEdit) {
        const { error } = await supabase.from('products').update(payload).eq('id', id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('products').insert(payload)
        if (error) throw error
      }

      navigate('/admin/products')
    } catch (e2) {
      setErr(e2.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <h1>{isEdit ? 'Edit Product' : 'New Product'}</h1>
      <form onSubmit={handleSubmit} className="form-grid mt-16" style={{ maxWidth: 640 }}>
        <div>
          <label>Product Name</label>
          <input name="name" value={form.name} onChange={handleChange} required />
        </div>
        <div>
          <label>Slug (URL)</label>
          <input name="slug" value={form.slug} onChange={handleChange} required />
        </div>
        <div>
          <label>Short Description</label>
          <input name="short_description" value={form.short_description} onChange={handleChange} />
        </div>
        <div>
          <label>Full Description</label>
          <textarea name="full_description" rows={5} value={form.full_description} onChange={handleChange} />
        </div>
        <div className="form-row">
          <div>
            <label>Price (৳)</label>
            <input type="number" name="price" value={form.price} onChange={handleChange} required />
          </div>
          <div>
            <label>Version</label>
            <input name="version" value={form.version} onChange={handleChange} placeholder="1.0.0" />
          </div>
        </div>
        <div>
          <label>Compatible Software</label>
          <input name="compatible_software" value={form.compatible_software} onChange={handleChange} placeholder="WordPress 6.0+" />
        </div>
        <div>
          <label>Features (একটি লাইনে একটি Feature)</label>
          <textarea name="features" rows={4} value={form.features} onChange={handleChange} />
        </div>
        <div>
          <label>Product Image</label>
          <input type="file" accept="image/*" onChange={(e) => setImageFile(e.target.files[0])} />
          {form.image_url && <img src={form.image_url} className="img-preview mt-8" alt="preview" />}
        </div>
        <div>
          <label>Product File (.zip) — Customer এটি সরাসরি কখনো দেখবে না</label>
          <input type="file" onChange={(e) => setProductFile(e.target.files[0])} />
          {form.file_path && <p className="muted" style={{ fontSize: 13 }}>বর্তমান File: {form.file_path}</p>}
        </div>
        <div>
          <label>Status</label>
          <select name="status" value={form.status} onChange={handleChange}>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>

        {err && <p className="error-text">{err}</p>}
        <button className="btn btn-primary" disabled={saving}>{saving ? 'Save হচ্ছে...' : 'Save Product'}</button>
      </form>
    </div>
  )
}
