// Small shared building blocks so every page looks and behaves the same.
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
