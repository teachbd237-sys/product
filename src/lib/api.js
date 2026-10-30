import { supabase } from '../supabaseClient.js'

export class ApiError extends Error {
  constructor(status, data) {
    super(data?.message || 'কিছু একটা সমস্যা হয়েছে।')
    this.status = status
    this.code = data?.error
    this.fieldErrors = data?.fieldErrors
    this.requirementId = data?.requirementId
  }
}

// Netlify Function-এ JSON পাঠানো। onProgress দিলে Upload Progress পাওয়া যায় (XHR)।
export function postJson(fn, body, { token, onProgress } = {}) {
  const url = `/.netlify/functions/${fn}`
  const payload = JSON.stringify(body)
  if (!onProgress) {
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: payload,
    }).then(async (res) => {
      let data = null
      try { data = await res.json() } catch { /* খালি উত্তর */ }
      if (!res.ok) throw new ApiError(res.status, data)
      return data
    }, () => { throw new ApiError(0, { message: 'ইন্টারনেট সংযোগ পাওয়া যায়নি। সংযোগ দেখে আবার চেষ্টা করুন।' }) })
  }
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', url)
    xhr.setRequestHeader('Content-Type', 'application/json')
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`)
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100)) }
    xhr.onload = () => {
      let data = null
      try { data = JSON.parse(xhr.responseText) } catch { /* ignore */ }
      if (xhr.status >= 200 && xhr.status < 300) resolve(data)
      else reject(new ApiError(xhr.status, data))
    }
    xhr.onerror = () => reject(new ApiError(0, { message: 'ইন্টারনেট সংযোগ পাওয়া যায়নি। সংযোগ দেখে আবার চেষ্টা করুন।' }))
    xhr.send(payload)
  })
}

// Admin Function কল: Supabase Session Token পাঠানো হয়; Server আবার Admin কিনা যাচাই করে।
export async function adminCall(action, params = {}) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new ApiError(401, { message: 'লগইন সেশন শেষ। আবার লগইন করুন।' })
  return postJson('admin-api', { action, ...params }, { token: session.access_token })
}
