import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

const btn = 'rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium hover:bg-slate-50'
const input = 'rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none'

export default function AdminContent() {
  const [years, setYears] = useState([])
  const [modules, setModules] = useState([])
  const [weeks, setWeeks] = useState([])
  const [msg, setMsg] = useState('')
  const [newYear, setNewYear] = useState('')
  const [newMod, setNewMod] = useState({})
  const [newWeek, setNewWeek] = useState({})

  async function load() {
    const [y, m, w] = await Promise.all([
      supabase.from('years').select('*').order('sort_order'),
      supabase.from('modules').select('*').order('sort_order'),
      supabase.from('weeks').select('*').order('week_number'),
    ])
    setYears(y.data || [])
    setModules(m.data || [])
    setWeeks(w.data || [])
  }
  useEffect(() => { load() }, [])

  async function run(promise, okMsg) {
    const { error } = await promise
    setMsg(error ? `Error: ${error.message}` : okMsg || '')
    await load()
  }

  const addYear = () => newYear.trim() && run(supabase.from('years').insert({ name: newYear.trim(), sort_order: years.length + 1 }), 'Year added').then(() => setNewYear(''))

  const addModule = (yearId) => {
    const v = newMod[yearId] || {}
    if (!v.code || !v.name) return setMsg('Enter a module code and name')
    run(supabase.from('modules').insert({ year_id: yearId, code: v.code.trim(), name: v.name.trim(), sort_order: modules.filter((m) => m.year_id === yearId).length + 1, is_locked: true }), 'Module added (locked by default)')
      .then(() => setNewMod((s) => ({ ...s, [yearId]: {} })))
  }

  const addWeek = (moduleId) => {
    const n = parseInt(newWeek[moduleId], 10)
    if (!n) return setMsg('Enter a week number')
    run(supabase.from('weeks').insert({ module_id: moduleId, week_number: n, is_locked: true }), 'Week added (locked by default)')
      .then(() => setNewWeek((s) => ({ ...s, [moduleId]: '' })))
  }

  const confirmDelete = (what, promise) => window.confirm(`Delete ${what}? This also deletes everything inside it and cannot be undone.`) && run(promise, 'Deleted')

  return (
    <div>
      <h1 className="text-2xl font-bold">Structure</h1>
      <p className="mt-1 text-slate-500">Create years, modules and weeks, and lock or unlock them. New modules and weeks start locked, so students see nothing until you unlock them.</p>
      {msg && <p className="mt-3 rounded-lg bg-slate-100 px-3 py-2 text-sm">{msg}</p>}

      <div className="mt-6 space-y-6">
        {years.map((y) => (
          <section key={y.id} className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="flex-1 text-lg font-semibold">{y.name}</h2>
              <button className={btn} onClick={() => run(supabase.from('years').update({ is_visible: !y.is_visible }).eq('id', y.id))}>{y.is_visible ? 'Visible' : 'Hidden'}</button>
              <button className={btn} onClick={() => { const n = window.prompt('Rename year', y.name); n && run(supabase.from('years').update({ name: n }).eq('id', y.id)) }}>Rename</button>
              <button className={`${btn} text-red-600`} onClick={() => confirmDelete(y.name, supabase.from('years').delete().eq('id', y.id))}>Delete</button>
            </div>

            <div className="mt-3 space-y-3">
              {modules.filter((m) => m.year_id === y.id).map((m) => (
                <div key={m.id} className="rounded-xl border border-slate-200 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{m.code}</span>
                    <span className="flex-1 text-slate-600">{m.name}</span>
                    <button className={btn} onClick={() => run(supabase.from('modules').update({ is_locked: !m.is_locked }).eq('id', m.id))}>{m.is_locked ? '🔒 Locked' : '🔓 Unlocked'}</button>
                    <button className={btn} onClick={() => { const n = window.prompt('Module name', m.name); n && run(supabase.from('modules').update({ name: n }).eq('id', m.id)) }}>Rename</button>
                    <button className={`${btn} text-red-600`} onClick={() => confirmDelete(m.code, supabase.from('modules').delete().eq('id', m.id))}>Delete</button>
                  </div>
                  <ul className="mt-2 space-y-1">
                    {weeks.filter((w) => w.module_id === m.id).map((w) => (
                      <li key={w.id} className="flex items-center gap-2 pl-4 text-sm">
                        <span className="flex-1">Week {w.week_number}{w.name ? ` — ${w.name}` : ''}</span>
                        <button className={btn} onClick={() => run(supabase.from('weeks').update({ is_locked: !w.is_locked }).eq('id', w.id))}>{w.is_locked ? '🔒 Locked' : '🔓 Unlocked'}</button>
                        <button className={`${btn} text-red-600`} onClick={() => confirmDelete(`week ${w.week_number}`, supabase.from('weeks').delete().eq('id', w.id))}>Delete</button>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-2 flex gap-2 pl-4">
                    <input className={`${input} w-28`} placeholder="Week no." value={newWeek[m.id] || ''} onChange={(e) => setNewWeek((s) => ({ ...s, [m.id]: e.target.value }))} />
                    <button className={btn} onClick={() => addWeek(m.id)}>Add week</button>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <input className={`${input} w-24`} placeholder="Code" value={newMod[y.id]?.code || ''} onChange={(e) => setNewMod((s) => ({ ...s, [y.id]: { ...s[y.id], code: e.target.value } }))} />
              <input className={`${input} flex-1`} placeholder="Module name" value={newMod[y.id]?.name || ''} onChange={(e) => setNewMod((s) => ({ ...s, [y.id]: { ...s[y.id], name: e.target.value } }))} />
              <button className={btn} onClick={() => addModule(y.id)}>Add module</button>
            </div>
          </section>
        ))}
      </div>

      <div className="mt-6 flex gap-2">
        <input className={`${input} flex-1`} placeholder="New year name, e.g. Year 2" value={newYear} onChange={(e) => setNewYear(e.target.value)} />
        <button className={btn} onClick={addYear}>Add year</button>
      </div>
    </div>
  )
}
