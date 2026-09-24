import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useSections } from '../../lib/useSections'
import { pathOf } from '../../lib/sections'
import { PageHeader, Notice, Empty, inputCls, btnGhost, card } from '../../components/ui'

function cell(v) {
  let s = String(v ?? '')
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}` // avoid a formula running if this is opened in Excel/Sheets
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

// What every student teacher has logged, for academic leads — useful for an end-of-year roundup
// of who's taught, how much, and to whom. Read-only: editing stays with whoever logged it.
export default function Teaching() {
  const sec = useSections()
  const [rows, setRows] = useState(null)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')

  async function load() {
    const { data, error } = await supabase.rpc('lead_teaching_sessions')
    if (error) setError(error.message)
    setRows(data || [])
  }
  useEffect(() => { load() }, [])

  const byTeacher = useMemo(() => {
    const m = new Map()
    for (const r of rows || []) {
      const key = r.user_id
      if (!m.has(key)) m.set(key, { name: r.teacher_name || r.teacher_email, email: r.teacher_email, sessions: 0, minutes: 0, learners: 0 })
      const t = m.get(key)
      t.sessions++
      t.minutes += r.duration_minutes || 0
      t.learners += r.attendees || 0
    }
    return [...m.values()].sort((a, b) => b.sessions - a.sessions)
  }, [rows])

  const totals = useMemo(() => ({
    teachers: byTeacher.length,
    sessions: rows?.length || 0,
    hours: Math.round(((rows || []).reduce((s, r) => s + (r.duration_minutes || 0), 0) / 60) * 10) / 10,
  }), [rows, byTeacher])

  const q = search.trim().toLowerCase()
  const shown = (rows || []).filter((r) => !q || `${r.teacher_name} ${r.teacher_email} ${r.title}`.toLowerCase().includes(q))

  function exportCsv() {
    const head = ['Teacher', 'Email', 'Date', 'Title', 'Topic', 'Type', 'Audience', 'Minutes', 'Learners', 'Reflection', 'Feedback']
    const lines = (rows || []).map((r) =>
      [r.teacher_name, r.teacher_email, r.session_date, r.title, r.section_id ? pathOf(sec.nodes, r.section_id) : '', r.session_type, r.audience, r.duration_minutes, r.attendees, r.reflection, r.feedback].map(cell).join(','),
    )
    const blob = new Blob([[head.join(','), ...lines].join('\n')], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'teaching-sessions-all.csv'
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <div>
      <PageHeader title="Teaching sessions" actions={<button className={btnGhost} disabled={!rows?.length} onClick={exportCsv}>Export CSV</button>}>
        Every session student teachers have logged in their portfolios. Read-only — the sign-up domains and roles are managed under People.
      </PageHeader>
      <Notice tone="error" onClose={() => setError('')}>{error}</Notice>

      <div className="mb-4 grid grid-cols-3 gap-3">
        {[['Student teachers', totals.teachers], ['Sessions', totals.sessions], ['Hours', totals.hours]].map(([l, v]) => (
          <div key={l} className={`${card} text-center`}>
            <div className="text-2xl font-bold">{v}</div>
            <div className="text-xs text-stone-500">{l}</div>
          </div>
        ))}
      </div>

      {byTeacher.length > 0 && (
        <div className={`${card} mb-4`}>
          <b className="text-sm">By teacher</b>
          <div className="mt-2 divide-y divide-stone-100">
            {byTeacher.map((t) => (
              <div key={t.email} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span className="min-w-0 truncate">{t.name}</span>
                <span className="shrink-0 text-xs text-stone-500">{t.sessions} session{t.sessions === 1 ? '' : 's'} · {Math.round((t.minutes / 60) * 10) / 10}h · {t.learners} learners</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <input className={`${inputCls} mb-3`} placeholder="Search teacher, email or session title" value={search} onChange={(e) => setSearch(e.target.value)} />

      {rows && !rows.length && <Empty>No sessions logged yet.</Empty>}
      <div className="space-y-2">
        {shown.map((r) => (
          <div key={r.id} className={card}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <b className="text-sm">{r.title}</b>
                <p className="text-xs text-stone-500">
                  {r.teacher_name || r.teacher_email} · {new Date(r.session_date).toLocaleDateString()} · {r.session_type}
                  {r.duration_minutes ? ` · ${r.duration_minutes} min` : ''}
                  {r.attendees ? ` · ${r.attendees} learners` : ''}
                </p>
                {r.section_id && <p className="text-xs text-stone-400">{pathOf(sec.nodes, r.section_id)}</p>}
              </div>
            </div>
            {r.reflection && <p className="mt-2 text-sm text-stone-700"><span className="text-xs font-bold uppercase text-stone-400">Reflection </span>{r.reflection}</p>}
            {r.feedback && <p className="mt-1 text-sm text-stone-700"><span className="text-xs font-bold uppercase text-stone-400">Feedback </span>{r.feedback}</p>}
          </div>
        ))}
      </div>
    </div>
  )
}
