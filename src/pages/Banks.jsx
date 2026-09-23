import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function Banks() {
  const navigate = useNavigate()
  const [years, setYears] = useState([])
  const [modules, setModules] = useState([])
  const [weeks, setWeeks] = useState([])
  const [counts, setCounts] = useState({})
  const [progress, setProgress] = useState({})
  const [selected, setSelected] = useState(new Set())
  const [openYears, setOpenYears] = useState({})
  const [openModules, setOpenModules] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [y, m, w, c, p] = await Promise.all([
        supabase.from('years').select('*').order('sort_order'),
        supabase.from('modules').select('*').order('sort_order'),
        supabase.from('weeks').select('*').order('week_number'),
        supabase.rpc('week_question_counts'),
        supabase.rpc('my_week_progress'),
      ])
      setYears(y.data || [])
      setModules(m.data || [])
      setWeeks(w.data || [])
      setCounts(Object.fromEntries((c.data || []).map((r) => [r.week_id, Number(r.question_count)])))
      setProgress(Object.fromEntries((p.data || []).map((r) => [r.week_id, Number(r.answered)])))
      setOpenYears(Object.fromEntries((y.data || []).map((r) => [r.id, true])))
      setLoading(false)
    }
    load()
  }, [])

  const weeksByModule = useMemo(() => {
    const map = {}
    weeks.forEach((w) => (map[w.module_id] ||= []).push(w))
    return map
  }, [weeks])

  const isWeekLocked = (w, m) => w.is_locked || m.is_locked

  function toggle(id) {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function selectAll(m) {
    const ids = (weeksByModule[m.id] || []).filter((w) => !isWeekLocked(w, m) && (counts[w.id] || 0) > 0).map((w) => w.id)
    const allOn = ids.length > 0 && ids.every((id) => selected.has(id))
    setSelected((prev) => {
      const next = new Set(prev)
      ids.forEach((id) => (allOn ? next.delete(id) : next.add(id)))
      return next
    })
  }

  const totalSelectedQuestions = [...selected].reduce((n, id) => n + (counts[id] || 0), 0)

  function start() {
    navigate(`/quiz?weeks=${[...selected].join(',')}`)
  }

  if (loading) return <p className="text-slate-500">Loading…</p>

  return (
    <div className="pb-28">
      <h1 className="text-2xl font-bold">Question banks</h1>
      <p className="mt-1 text-slate-500">Choose a year, then a module and week to start a practice session — instant marking and a full explanation after every question.</p>

      <div className="mt-6 space-y-4">
        {years.map((y) => {
          const ym = modules.filter((m) => m.year_id === y.id)
          return (
            <section key={y.id} className="rounded-2xl border border-slate-200 bg-white">
              <button onClick={() => setOpenYears((o) => ({ ...o, [y.id]: !o[y.id] }))} className="flex w-full items-center gap-3 px-5 py-4 text-left">
                <span className="text-slate-400">{openYears[y.id] ? '▾' : '▸'}</span>
                <span className="text-lg font-semibold">{y.name}</span>
                <span className="text-xs text-slate-400">{ym.length} modules</span>
              </button>
              {openYears[y.id] && (
                <div className="space-y-2 px-4 pb-4">
                  {ym.length === 0 && <p className="px-2 text-sm text-slate-400">Coming soon</p>}
                  {ym.map((m) => {
                    const mw = weeksByModule[m.id] || []
                    const qTotal = mw.reduce((n, w) => n + (counts[w.id] || 0), 0)
                    const answered = mw.reduce((n, w) => n + (progress[w.id] || 0), 0)
                    const pct = qTotal ? Math.round((answered / qTotal) * 100) : 0
                    return (
                      <div key={m.id} className="rounded-xl border border-slate-200">
                        <div className="flex items-center gap-3 px-4 py-3">
                          <button onClick={() => setOpenModules((o) => ({ ...o, [m.id]: !o[m.id] }))} className="flex flex-1 items-center gap-3 text-left">
                            <span className="text-slate-400">{openModules[m.id] ? '▾' : '▸'}</span>
                            <span className="font-semibold">{m.code}</span>
                            <span className="text-slate-600">{m.name}</span>
                            {m.is_locked && <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">🔒 Locked</span>}
                          </button>
                          <span className="hidden text-xs text-slate-400 sm:inline">{mw.length} weeks · {qTotal} questions</span>
                          {!m.is_locked && <span className="text-xs font-semibold text-slate-500">{pct}%</span>}
                          <button
                            disabled={m.is_locked}
                            onClick={() => selectAll(m)}
                            className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-300"
                          >
                            Select all
                          </button>
                        </div>
                        {openModules[m.id] && (
                          <ul className="divide-y divide-slate-100 border-t border-slate-100">
                            {mw.map((w) => {
                              const locked = isWeekLocked(w, m)
                              const n = counts[w.id] || 0
                              const disabled = locked || n === 0
                              return (
                                <li key={w.id}>
                                  <label className={`flex items-center gap-3 px-6 py-2.5 text-sm ${disabled ? 'text-slate-300' : 'cursor-pointer hover:bg-slate-50'}`}>
                                    <input type="checkbox" disabled={disabled} checked={selected.has(w.id)} onChange={() => toggle(w.id)} className="h-4 w-4 accent-emerald-600" />
                                    <span className="flex-1">Week {w.week_number}{w.name ? ` — ${w.name}` : ''}</span>
                                    {locked && <span className="text-xs text-red-500">🔒</span>}
                                    <span className="text-xs">{n} questions{!locked && n > 0 ? ` · ${progress[w.id] || 0} done` : ''}</span>
                                  </label>
                                </li>
                              )
                            })}
                          </ul>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </section>
          )
        })}
      </div>

      <div className="fixed inset-x-0 bottom-4 z-10 flex justify-center px-4">
        <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white px-5 py-3 shadow-lg">
          <span className="text-sm text-slate-500">
            {selected.size === 0 ? 'No weeks selected' : `${selected.size} week${selected.size > 1 ? 's' : ''} · ${totalSelectedQuestions} questions`}
          </span>
          <button
            disabled={selected.size === 0}
            onClick={start}
            className="rounded-lg bg-slate-900 px-5 py-2 text-sm font-semibold text-white disabled:bg-slate-200 disabled:text-slate-400"
          >
            Start Questions
          </button>
        </div>
      </div>
    </div>
  )
}
