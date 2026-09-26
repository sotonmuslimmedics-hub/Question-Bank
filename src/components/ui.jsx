// Small shared building blocks so every page looks and behaves the same.
import { useCallback, useState } from 'react'
export const inputCls =
  'w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100 disabled:bg-stone-50 disabled:text-stone-400'
export const btnPrimary =
  'inline-flex items-center justify-center rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50'
export const btnDark =
  'inline-flex items-center justify-center rounded-xl bg-stone-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-stone-700 disabled:cursor-not-allowed disabled:bg-stone-200 disabled:text-stone-400'
export const btnGhost =
  'inline-flex items-center justify-center rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-50'
export const btnDanger =
  'inline-flex items-center justify-center rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50'
export const card = 'rounded-2xl border border-stone-200 bg-white p-4 shadow-sm sm:p-5'

export function PageHeader({ title, children, actions }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {children && <p className="mt-1 max-w-2xl text-sm text-stone-500">{children}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}

export function Notice({ children, tone = 'info', onClose }) {
  const tones = {
    info: 'bg-stone-100 text-stone-700',
    ok: 'bg-emerald-50 text-emerald-800',
    error: 'bg-red-50 text-red-700',
    warn: 'bg-amber-50 text-amber-800',
  }
  if (!children) return null
  return (
    <div className={`mb-4 flex items-start justify-between gap-3 rounded-xl px-3 py-2 text-sm ${tones[tone]}`} role={tone === 'error' ? 'alert' : 'status'}>
      <span>{children}</span>
      {onClose && (
        <button onClick={onClose} className="text-xs opacity-60 hover:opacity-100" aria-label="Dismiss">✕</button>
      )}
    </div>
  )
}

export function Pill({ children, tone = 'stone' }) {
  const tones = {
    stone: 'bg-stone-100 text-stone-600',
    brand: 'bg-brand-50 text-brand-700',
    green: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700',
    red: 'bg-red-50 text-red-700',
  }
  return <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${tones[tone]}`}>{children}</span>
}

export function Empty({ children }) {
  return <p className="rounded-2xl border border-dashed border-stone-300 px-4 py-8 text-center text-sm text-stone-400">{children}</p>
}

// Replaces window.confirm(). Native confirm/alert/prompt dialogs are known
// to leave some browsers (e.g. Arc) with the rest of the page unresponsive —
// dropdowns and other controls stop reacting to clicks until a reload. This
// renders an ordinary in-app modal instead, so nothing outside React's own
// event handling is involved.
// Usage: const [confirmDialog, askConfirm] = useConfirm(); ... {confirmDialog}
// then: if (!(await askConfirm('Delete this?'))) return
export function useConfirm() {
  const [req, setReq] = useState(null) // { message, resolve }
  const ask = useCallback((message) => new Promise((resolve) => setReq({ message, resolve })), [])
  if (!req) return [null, ask]
  const finish = (ok) => { req.resolve(ok); setReq(null) }
  const dialog = (
    <Modal title="Please confirm" onClose={() => finish(false)}>
      <p className="text-sm text-stone-600">{req.message}</p>
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" className={btnGhost} onClick={() => finish(false)}>Cancel</button>
        <button type="button" className={btnDanger} onClick={() => finish(true)}>Delete</button>
      </div>
    </Modal>
  )
  return [dialog, ask]
}

// Replaces window.prompt(), for the same reason as useConfirm above.
// Usage: const [promptDialog, askText] = usePrompt(); ... {promptDialog}
// then: const text = await askText('Label text:')
export function usePrompt() {
  const [req, setReq] = useState(null) // { message, value, resolve }
  const ask = useCallback((message, initial = '') => new Promise((resolve) => setReq({ message, value: initial, resolve })), [])
  if (!req) return [null, ask]
  const finish = (value) => { req.resolve(value); setReq(null) }
  const dialog = (
    <Modal title={req.message} onClose={() => finish(null)}>
      <form
        onSubmit={(e) => { e.preventDefault(); finish(req.value.trim() || null) }}
        className="space-y-3"
      >
        <input autoFocus className={inputCls} value={req.value} onChange={(e) => setReq((r) => ({ ...r, value: e.target.value }))} />
        <div className="flex justify-end gap-2">
          <button type="button" className={btnGhost} onClick={() => finish(null)}>Cancel</button>
          <button className={btnDark}>OK</button>
        </div>
      </form>
    </Modal>
  )
  return [dialog, ask]
}

export function Modal({ title, onClose, children, wide = false }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onClick={onClose}>
      <div
        className={`max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 shadow-xl sm:rounded-3xl ${wide ? 'sm:max-w-3xl' : 'sm:max-w-lg'}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">{title}</h2>
          <button onClick={onClose} className="rounded-lg px-2 py-1 text-stone-400 hover:bg-stone-100" aria-label="Close">✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}
