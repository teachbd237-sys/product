import { useEffect, useState, useCallback, createContext, useContext } from 'react'
import { STATUS_LABEL } from '../lib/format.js'

export function Spinner() { return <span className="spinner" aria-hidden="true" /> }
export function PageLoading({ text = 'লোড হচ্ছে…' }) {
  return <div className="page-loading" role="status"><Spinner /><span>{text}</span></div>
}
export function StatusBadge({ status }) { return <span className={`badge ${status}`}>{STATUS_LABEL[status] || status}</span> }

export function Field({ label, hint, error, required, children, htmlFor }) {
  return (
    <div className={`field${error ? ' invalid' : ''}`}>
      {label && <label htmlFor={htmlFor}>{label}{required && <span className="req" aria-hidden="true">*</span>}</label>}
      {children}
      {hint && <div className="hint">{hint}</div>}
      {error && <div className="err" role="alert">{error}</div>}
    </div>
  )
}

// গুরুত্বপূর্ণ কাজের আগে নিশ্চিতকরণ Dialog
export function ConfirmDialog({ open, title, children, confirmLabel = 'নিশ্চিত করুন', danger, busy, onConfirm, onCancel, disabled }) {
  useEffect(() => {
    if (!open) return
    const h = (e) => { if (e.key === 'Escape' && !busy) onCancel() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [open, busy, onCancel])
  if (!open) return null
  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onCancel() }}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title}>
        <h3>{title}</h3>
        <div className="muted">{children}</div>
        <div className="actions">
          <button className="btn ghost" onClick={onCancel} disabled={busy}>বাতিল</button>
          <button className={`btn ${danger ? 'danger' : 'primary'}`} onClick={onConfirm} disabled={busy || disabled}>
            {busy && <Spinner />} {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

const ToastCtx = createContext(() => {})
export const useToast = () => useContext(ToastCtx)
export function ToastProvider({ children }) {
  const [items, setItems] = useState([])
  const push = useCallback((text, kind = 'ok') => {
    const id = Math.random().toString(36).slice(2) // শুধু UI Key, নিরাপত্তার কাজে নয়
    setItems((x) => [...x, { id, text, kind }])
    setTimeout(() => setItems((x) => x.filter((i) => i.id !== id)), 3800)
  }, [])
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toast-wrap" aria-live="polite">{items.map((i) => <div key={i.id} className={`toast ${i.kind}`}>{i.text}</div>)}</div>
    </ToastCtx.Provider>
  )
}
