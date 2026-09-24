import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { useSections } from '../lib/useSections'
import { pathOf } from '../lib/sections'
import { PageHeader, Notice, Empty, Modal, inputCls, btnDark, btnGhost, btnDanger, card } from '../components/ui'

const TYPES = ['Small group', 'Lecture-style', 'One-to-one', 'Online', 'Revision session', 'Other']
const blank = () => ({
  session_date: new Date().toISOString().slice(0, 10),
  title: '', section_id: '', session_type: TYPES[0], audience: '', duration_minutes: 60, attendees: '', reflection: '', feedback: '',
})

function csvCell(v) {
  const s = String(v ?? '')
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

// Private log of teaching a student teacher has done. Only its owner can read it.
export default function Portfolio() {
  const { user } = useAuth()
  const sec = useSections()
  const [rows, setRows] = useState(null)
  const [error, setError] = useState('')
  const [edit, setEdit] = useState(null)

  async function load() {
    const { data, error } = await supabase.from('teaching_sessions').select('*').eq('user_id', user.id).order('session_date', { ascending: false })
    if (error) setError(error.message)
    setRows(data || [])
  }
  useEffect(() => { load() }, [])

  const totals = useMemo(() => {
    const r = rows || []
    return {
      n: r.length,
      hours: Math.round((r.reduce((s, x) => s + (x.duration_minutes || 0), 0) / 60) * 10) / 10,
      people: r.reduce((s, x) => s + (x.attendees || 0), 0),
    }
  }, [rows])

  async function save(e) {
    e.preventDefault()
    const p = {
      session_date: edit.session_date,
      title: edit.title.trim(),
      section_id: edit.section_id || null,
      session_type: edit.session_type,
      audience: edit.audience.trim() || null,
      duration_minutes: edit.duration_minutes === '' ? null : Number(edit.duration_minutes),
      attendees: edit.attendees === '' || edit.attendees == null ? null : Number(edit.attendees),
      reflection: edit.reflection.trim() || null,
      feedback: edit.feedback.trim() || null,
    }
    const { error } = edit.id
      ? await supabase.from('teaching_sessions').update(p).eq('id', edit.id)
      : await supabase.from('teaching_sessions').insert({ ...p, user_id: user.id })
    if (error) return setError(error.message)
    setEdit(null)
    load()
  }

  async function remove(id) {
    if (!confirm('Delete this entry?')) return
    const { error } = await supabase.from('teaching_sessions').delete().eq('id', id)
    if (error) setError(error.message)
    load()
  }

  function exportCsv() {
    const head = ['Date', 'Title', 'Topic', 'Type', 'Audience', 'Minutes', 'Attendees', 'Reflection', 'Feedback']
    const lines = (rows || []).map((r) =>
      [r.session_date, r.title, r.section_id ? pathOf(sec.nodes, r.section_id) : '', r.session_type, r.audience, r.duration_minutes, r.attendees, r.reflection, r.feedback].map(csvCell).join(','),
    )
    const blob = new Blob([[head.join(','), ...lines].join('\n')], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'teaching-portfolio.csv'
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <div>
      <PageHeader
        title="Teaching portfolio"
        actions={
          <>
            <button className={btnGhost} disabled={!rows?.length} onClick={exportCsv}>Export CSV</button>
            <button className={btnDark} onClick={() => setEdit(blank())}>Log a session</button>
          </>
        }
      >
        A private record of the teaching you've done, useful for portfolios and applications. Only you can see it.
      </PageHeader>
      <Notice tone="error" onClose={() => setError('')}>{error}</Notice>

      <div className="mb-4 grid grid-cols-3 gap-3">
        {[['Sessions', totals.n], ['Hours', totals.hours], ['Learners', totals.people]].map(([l, v]) => (
          <div key={l} className={`${card} text-center`}>
            <div className="text-2xl font-bold">{v}</div>
            <div className="text-xs text-stone-500">{l}</div>
          </div>
        ))}
      </div>

      {rows && !rows.length && <Empty>No sessions logged yet.</Empty>}
      <div className="space-y-2">
        {(rows || []).map((r) => (
          <div key={r.id} className={card}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <b className="text-sm">{r.title}</b>
                <p className="text-xs text-stone-500">
                  {new Date(r.session_date).toLocaleDateString()} · {r.session_type}
                  {r.duration_minutes ? ` · ${r.duration_minutes} min` : ''}
                  {r.attendees ? ` · ${r.attendees} learners` : ''}
                </p>
                {r.section_id && <p className="text-xs text-stone-400">{pathOf(sec.nodes, r.section_id)}</p>}
              </div>
              <div className="flex shrink-0 gap-2">
                <button className={btnGhost} onClick={() => setEdit({ ...blank(), ...Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v ?? ''])) })}>Edit</button>
                <button className={btnDanger} onClick={() => remove(r.id)}>Delete</button>
              </div>
            </div>
            {r.reflection && <p className="mt-2 text-sm text-stone-700"><span className="text-xs font-bold uppercase text-stone-400">Reflection </span>{r.reflection}</p>}
            {r.feedback && <p className="mt-1 text-sm text-stone-700"><span className="text-xs font-bold uppercase text-stone-400">Feedback </span>{r.feedback}</p>}
          </div>
        ))}
      </div>

      {edit && (
        <Modal title={edit.id ? 'Edit session' : 'Log a session'} onClose={() => setEdit(null)} wide>
          <form onSubmit={save} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <input className={inputCls} type="date" value={edit.session_date} onChange={(e) => setEdit({ ...edit, session_date: e.target.value })} required />
              <select className={inputCls} value={edit.session_type} onChange={(e) => setEdit({ ...edit, session_type: e.target.value })}>
                {TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
            <input className={inputCls} placeholder="Title, e.g. Cardiology MCQ revision" value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} required />
            <select className={inputCls} value={edit.section_id} onChange={(e) => setEdit({ ...edit, section_id: e.target.value })}>
              <option value="">Topic (optional)</option>
              {sec.flat.map((s) => <option key={s.id} value={s.id}>{s.pathLabel}</option>)}
            </select>
            <input className={inputCls} placeholder="Audience, e.g. Year 3 students" value={edit.audience} onChange={(e) => setEdit({ ...edit, audience: e.target.value })} />
            <div className="grid grid-cols-2 gap-3">
              <input className={inputCls} type="number" min="0" placeholder="Minutes" value={edit.duration_minutes} onChange={(e) => setEdit({ ...edit, duration_minutes: e.target.value })} />
              <input className={inputCls} type="number" min="0" placeholder="Learners" value={edit.attendees} onChange={(e) => setEdit({ ...edit, attendees: e.target.value })} />
            </div>
            <textarea className={inputCls} rows={3} placeholder="Reflection: what went well, what would you change?" value={edit.reflection} onChange={(e) => setEdit({ ...edit, reflection: e.target.value })} />
            <textarea className={inputCls} rows={2} placeholder="Feedback received" value={edit.feedback} onChange={(e) => setEdit({ ...edit, feedback: e.target.value })} />
            <button className={`${btnDark} w-full`}>Save</button>
          </form>
        </Modal>
      )}
    </div>
  )
}
