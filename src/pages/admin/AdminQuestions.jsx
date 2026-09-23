import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { csvToQuestions } from '../../lib/csv'

const LETTERS = 'ABCDEFGH'
const btn = 'rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium hover:bg-slate-50'
const input = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none'
const blank = { id: null, stem: '', options: ['', '', '', '', ''], correct_option: 0, explanation: '', is_published: true }

export default function AdminQuestions() {
  const [modules, setModules] = useState([])
  const [weeks, setWeeks] = useState([])
  const [weekId, setWeekId] = useState('')
  const [questions, setQuestions] = useState([])
  const [form, setForm] = useState(null)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    Promise.all([
      supabase.from('modules').select('id,code,name').order('sort_order'),
      supabase.from('weeks').select('id,module_id,week_number').order('week_number'),
    ]).then(([m, w]) => {
      setModules(m.data || [])
      setWeeks(w.data || [])
    })
  }, [])

  async function loadQuestions(id = weekId) {
    if (!id) return setQuestions([])
    const { data } = await supabase.from('questions').select('*').eq('week_id', id).order('created_at')
    setQuestions(data || [])
  }
  useEffect(() => { loadQuestions() }, [weekId])

  async function save(e) {
    e.preventDefault()
    const options = form.options.map((o) => o.trim()).filter(Boolean)
    if (!form.stem.trim()) return setMsg('Enter the question text')
    if (options.length < 2) return setMsg('Enter at least two options')
    if (!form.options[form.correct_option]?.trim()) return setMsg('The correct answer must be one of the filled-in options')
    // keep correct index aligned after empty options are removed
    const correctText = form.options[form.correct_option].trim()
    const payload = {
      week_id: weekId,
      stem: form.stem.trim(),
      options,
      correct_option: options.indexOf(correctText),
      explanation: form.explanation.trim() || null,
      is_published: form.is_published,
    }
    const { error } = form.id
      ? await supabase.from('questions').update(payload).eq('id', form.id)
      : await supabase.from('questions').insert(payload)
    if (error) return setMsg(`Error: ${error.message}`)
    setMsg('Saved')
    setForm(null)
    loadQuestions()
  }

  async function remove(q) {
    if (!window.confirm('Delete this question? Students’ past attempts on it will also be removed.')) return
    const { error } = await supabase.from('questions').delete().eq('id', q.id)
    setMsg(error ? `Error: ${error.message}` : 'Deleted')
    loadQuestions()
  }

  async function importCsv(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const rows = csvToQuestions(await file.text())
      const { error } = await supabase.from('questions').insert(rows.map((r) => ({ ...r, week_id: weekId })))
      if (error) throw error
      setMsg(`Imported ${rows.length} questions`)
      loadQuestions()
    } catch (err) {
      setMsg(`Import failed: ${err.message}`)
    }
  }

  function downloadTemplate() {
    const csv = 'stem,option_a,option_b,option_c,option_d,option_e,correct,explanation\n"Which ion is the main extracellular cation?",Potassium,Calcium,Sodium,Magnesium,Chloride,C,"Sodium is the predominant extracellular cation."\n'
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = 'question-template.csv'
    a.click()
  }

  const setOption = (i, v) => setForm((f) => ({ ...f, options: f.options.map((o, j) => (j === i ? v : o)) }))

  return (
    <div>
      <h1 className="text-2xl font-bold">Questions</h1>
      <p className="mt-1 text-slate-500">Choose a week, then add, edit or bulk-import multiple-choice questions.</p>
      {msg && <p className="mt-3 rounded-lg bg-slate-100 px-3 py-2 text-sm">{msg}</p>}

      <select className={`${input} mt-4`} value={weekId} onChange={(e) => { setWeekId(e.target.value); setForm(null) }}>
        <option value="">Select a week…</option>
        {modules.map((m) => (
          <optgroup key={m.id} label={`${m.code} — ${m.name}`}>
            {weeks.filter((w) => w.module_id === m.id).map((w) => <option key={w.id} value={w.id}>Week {w.week_number}</option>)}
          </optgroup>
        ))}
      </select>

      {weekId && !form && (
        <div className="mt-4 flex flex-wrap gap-2">
          <button className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700" onClick={() => setForm({ ...blank })}>+ Add question</button>
          <label className={`${btn} cursor-pointer px-3 py-2`}>
            Import CSV
            <input type="file" accept=".csv,text/csv" className="hidden" onChange={importCsv} />
          </label>
          <button className={`${btn} px-3 py-2`} onClick={downloadTemplate}>Download CSV template</button>
        </div>
      )}

      {form && (
        <form onSubmit={save} className="mt-4 space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
          <textarea className={input} rows={3} placeholder="Question text" value={form.stem} onChange={(e) => setForm({ ...form, stem: e.target.value })} />
          {form.options.map((o, i) => (
            <div key={i} className="flex items-center gap-2">
              <input type="radio" name="correct" checked={form.correct_option === i} onChange={() => setForm({ ...form, correct_option: i })} className="accent-emerald-600" title="Mark as correct answer" />
              <span className="w-5 text-sm font-bold text-slate-400">{LETTERS[i]}</span>
              <input className={input} placeholder={`Option ${LETTERS[i]}${i > 1 ? ' (optional)' : ''}`} value={o} onChange={(e) => setOption(i, e.target.value)} />
            </div>
          ))}
          <textarea className={input} rows={3} placeholder="Explanation shown after answering" value={form.explanation} onChange={(e) => setForm({ ...form, explanation: e.target.value })} />
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.is_published} onChange={(e) => setForm({ ...form, is_published: e.target.checked })} /> Published (visible to students)</label>
          <div className="flex gap-2">
            <button className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">Save</button>
            <button type="button" className={`${btn} px-4 py-2`} onClick={() => setForm(null)}>Cancel</button>
          </div>
        </form>
      )}

      <ul className="mt-6 space-y-2">
        {questions.map((q) => (
          <li key={q.id} className="rounded-xl border border-slate-200 bg-white p-3 text-sm">
            <div className="flex items-start gap-3">
              <div className="flex-1">
                <div className="font-medium">{q.stem}</div>
                <div className="mt-1 text-xs text-slate-500">
                  {q.options.length} options · correct: {LETTERS[q.correct_option]}{!q.is_published && ' · draft'}
                </div>
              </div>
              <button className={btn} onClick={() => setForm({ ...q, options: [...q.options, '', '', '', '', '', '', '', ''].slice(0, Math.max(5, q.options.length)), explanation: q.explanation || '' })}>Edit</button>
              <button className={`${btn} text-red-600`} onClick={() => remove(q)}>Delete</button>
            </div>
          </li>
        ))}
        {weekId && questions.length === 0 && <li className="text-sm text-slate-400">No questions in this week yet.</li>}
      </ul>
    </div>
  )
}
