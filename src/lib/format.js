export function fmtDateTime(d, locale = 'en-GB') {
  if (!d) return '—'
  return new Date(d).toLocaleString(locale, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}
export function fmtDate(d, locale = 'en-GB') {
  if (!d) return '—'
  return new Date(d).toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' })
}
export const STATUS_LABEL = {
  pending: 'Pending', approved: 'Approved', rejected: 'Rejected', redeemed: 'Code Redeemed', revoked: 'Revoked', cancelled: 'Cancelled',
  active: 'Active', inactive: 'Inactive', archived: 'Archived',
}
export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true } catch {
    const ta = document.createElement('textarea')
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0'
    document.body.appendChild(ta); ta.select()
    let ok = false
    try { ok = document.execCommand('copy') } catch { /* ignore */ }
    document.body.removeChild(ta)
    return ok
  }
}
