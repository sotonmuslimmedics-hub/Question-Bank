// Small helpers shared by the timed-mock screens.

export const LETTERS = 'ABCDEFGH'

export const outlineBtn =
  'inline-flex items-center justify-center rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-sm font-semibold text-stone-700 hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-50'

// 3725 -> "1:02:05", 605 -> "10:05"
export function fmtClock(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const mm = String(m).padStart(2, '0')
  const ss = String(sec).padStart(2, '0')
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
}

// "1 h 05 min" / "42 min" — for durations in sentences
export function fmtDuration(minutes) {
  const m = Math.round(minutes)
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60)
  const rest = m % 60
  return rest ? `${h} h ${String(rest).padStart(2, '0')} min` : `${h} h`
}

export function fmtDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

// <input type="datetime-local"> works in local time with no zone
export function toLocalInput(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}
export function fromLocalInput(value) {
  return value ? new Date(value).toISOString() : null
}

export function barColour(pct) {
  return pct < 40 ? 'bg-red-400' : pct < 70 ? 'bg-amber-400' : 'bg-emerald-500'
}
