// Download Authorization-এর গোপন token: Browser নিজে তৈরি করে, শুধু এই ট্যাবের sessionStorage-এ থাকে।
const KEY = (productId) => `sf_dl_${productId}`

export function newToken() {
  const b = new Uint8Array(32)
  crypto.getRandomValues(b)
  return btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function loadSession(productId) {
  try {
    const v = JSON.parse(sessionStorage.getItem(KEY(productId)) || 'null')
    if (!v?.token) return null
    if (v.expiresAt && new Date(v.expiresAt) <= new Date()) { sessionStorage.removeItem(KEY(productId)); return null }
    return v
  } catch { return null }
}
export function saveSession(productId, v) { try { sessionStorage.setItem(KEY(productId), JSON.stringify(v)) } catch { /* ignore */ } }
export function clearSession(productId) { try { sessionStorage.removeItem(KEY(productId)) } catch { /* ignore */ } }
