import { useEffect, useState } from 'react'
import { supabase } from '../../supabaseClient.js'

export default function AdminSettings() {
  const [bkashNumber, setBkashNumber] = useState('')
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    const { data } = await supabase.from('settings').select('value').eq('key', 'bkash_number').maybeSingle()
    setBkashNumber(data?.value || '')
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    await supabase.from('settings').upsert({ key: 'bkash_number', value: bkashNumber })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div>
      <h1>Settings</h1>
      <form onSubmit={handleSave} className="form-grid mt-16" style={{ maxWidth: 400 }}>
        <div>
          <label>bKash Payment Number</label>
          <input value={bkashNumber} onChange={(e) => setBkashNumber(e.target.value)} placeholder="01XXXXXXXXX" />
        </div>
        <button className="btn btn-primary" disabled={saving}>{saving ? 'Save হচ্ছে...' : 'Save'}</button>
        {saved && <p className="success-text">Save হয়ে গেছে ✓</p>}
      </form>
    </div>
  )
}
