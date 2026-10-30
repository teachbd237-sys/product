import { supabase } from '../supabaseClient.js'

export class ApiError extends Error {
  constructor(status, data) {
    super(data?.message || fallbackMessage(status))
    this.name = 'ApiError'
    this.status = status
    this.code = data?.error
    this.errorId = data?.errorId
    this.fieldErrors = data?.fieldErrors
    this.requirementId = data?.requirementId
  }
  // network | auth | permission | validation | rate | server
  get kind() {
    if (this.status === 0) return 'network'
    if (this.status === 401) return 'auth'
    if (this.status === 403) return 'permission'
    if (this.status === 429) return 'rate'
    if (this.status >= 400 && this.status < 500) return 'validation'
    return 'server'
  }
  // শুধু Network / সাময়িক Server সমস্যায় আবার চেষ্টা (Retry) বাটন দেখানোর জন্য
  get retryable() { return this.status === 0 || this.status === 429 || this.status >= 500 }
}

const NETWORK_MSG = 'ইন্টারনেট সংযোগ পাওয়া যায়নি। সংযোগ দেখে আবার চেষ্টা করুন।'

// Function ক্র্যাশ করলে Netlify JSON নয়, HTML/টেক্সট ফেরত দেয় — তখনও যেন একটি ব্যবহারযোগ্য বার্তা যায়
function fallbackMessage(status) {
  if (status === 401) return 'লগইন সেশন শেষ। আবার লগইন করুন।'
  if (status === 403) return 'এই কাজের অনুমতি নেই।'
  if (status === 404) return 'অনুরোধ করা তথ্য পাওয়া যায়নি।'
  if (status === 413) return 'পাঠানো ডাটা অনেক বড়।'
  if (status === 429) return 'অনেকবার চেষ্টা করা হয়েছে। কিছুক্ষণ পরে আবার চেষ্টা করুন।'
  if (status >= 500) return 'সার্ভার এই মুহূর্তে সাড়া দিচ্ছে না। কিছুক্ষণ পরে আবার চেষ্টা করুন।'
  return 'কিছু একটা সমস্যা হয়েছে। আবার চেষ্টা করুন।'
}

// Netlify Function-এ JSON পাঠানো। onProgress দিলে Upload Progress পাওয়া যায় (XHR)।
export function postJson(fn, body, { token, onProgress, timeoutMs = 45000 } = {}) {
  const url = `/.netlify/functions/${fn}`
  const payload = JSON.stringify(body)
  if (!onProgress) {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), timeoutMs)
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: payload,
      signal: ctrl.signal,
    }).then(async (res) => {
      let data = null
      try { data = await res.json() } catch { /* খালি/অ-JSON উত্তর */ }
      if (!res.ok) throw new ApiError(res.status, data)
      if (data === null) throw new ApiError(502, null)
      return data
    }, (e) => {
      throw new ApiError(0, { message: e?.name === 'AbortError' ? 'সার্ভার সময়মতো সাড়া দেয়নি। আবার চেষ্টা করুন।' : NETWORK_MSG })
    }).finally(() => clearTimeout(timer))
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
    xhr.onerror = () => reject(new ApiError(0, { message: NETWORK_MSG }))
    xhr.send(payload)
  })
}

// Admin Function কল: Supabase Session Token পাঠানো হয়; Server আবার Admin কিনা যাচাই করে।
export async function adminCall(action, params = {}) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new ApiError(401, { error: 'unauthorized', message: 'লগইন সেশন শেষ। আবার লগইন করুন।' })
  return postJson('admin-api', { action, ...params }, { token: session.access_token })
}
