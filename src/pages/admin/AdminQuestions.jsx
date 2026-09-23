import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { csvToQuestions } from '../../lib/csv'
import { deleteImage, imageUrl, uploadImage } from '../../lib/images'
import { parseAccepted } from '../../lib/answers'

const LETTERS = 'ABCDEFGH'
const btn = 'rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium hover:bg-slate-50'
const input = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none'

const blankMcq = { id: null, type: 'mcq', stem: '', options: ['', '', '', '', ''], correct_option: 0, explanation: '', is_published: true }
const blankStation = {
  id: null,
  type: 'station',
  stem: '',
  explanation: '',
  is_published: true,
  image_path: null,
  imageFile: null,
  parts: [
    { prompt: '', accepted: '' },
    { prompt: '', accepted: '' },
  ],
}

export default function AdminQuestions() {
  const [modules, setModules] = useState([])
  const [weeks, setWeeks] = useState([])
  const [weekId, setWeekId] = useState('')
  const [questions, setQuestions] = useState([])
  const [form, setForm] = useState(null)
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const [previewUrl, setPreviewUrl] = useState(null)

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
    const { data } = await supabase
      .from('questions')
      .select('*, question_parts(*)')
      .eq('week_id', id)
      .order('created_at')
    setQuestions(data || [])
  }
  useEffect(() => { loadQuestions() }, [weekId])

  // preview for a newly chosen image file
  useEffect(() => {
    if (form?.imageFile) {
      const url = URL.createObjectURL(form.imageFile)
      setPreviewUrl(url)
      return () => URL.revokeObjectURL(url)
    }
    setPreviewUrl(form?.image_path ? imageUrl(form.image_path) : null)
  }, [form?.imageFile, form?.image_path])

  async function saveMcq() {
    const options = form.options.map((o) => o.trim()).filter(Boolean)
    if (!form.stem.trim()) return setMsg('Enter the question text')
    if (options.length < 2) return setMsg('Enter at least two options')
    if (!form.options[form.correct_option]?.trim()) return setMsg('The correct answer must be one of the filled-in options')
    const correctText = form.options[form.correct_option].trim()
    const payload = {
      week_id: weekId,
      question_type: 'mcq',
      stem: form.stem.trim(),
      options,
      correct_option: options.indexOf(correctText),
      image_path: null,
      explanation: form.explanation.trim() || null,
      is_published: form.is_published,
    }
    const { error } = form.id
      ? await supabase.from('questions').update(payload).eq('id', form.id)
      : await supabase.from('questions').insert(payload)
    if (error) throw error
  }

  async function saveStation() {
    if (!form.imageFile && !form.image_path) throw new Error('Choose a photo for this question')
    for (const [i, p] of form.parts.entries()) {
      if (!p.prompt.trim()) throw new Error(`Enter the question for part ${i + 1}`)
      if (parseAccepted(p.accepted).length === 0) throw new Error(`Enter at least one accepted answer for part ${i + 1}`)
    }

    let imagePath = form.image_path
    let oldPath = null
    if (form.imageFile) {
      imagePath = await uploadImage(form.imageFile)
      oldPath = form.image_path
    }

    const payload = {
      week_id: weekId,
      question_type: 'station',
      stem: form.stem.trim() || 'Look at the image and answer the questions below.',
      options: null,
      correct_option: null,
      image_path: imagePath,
      explanation: form.explanation.trim() || null,
      is_published: form.is_published,
    }

    let questionId = form.id
    if (form.id) {
      const { error } = await supabase.from('questions').update(payload).eq('id', form.id)
      if (error) throw error
    } else {
      const { data, error } = await supabase.from('questions').insert(payload).select('id').single()
      if (error) throw error
      questionId = data.id
    }

    // upsert keeps part ids stable, so students' past answers survive an edit
    const rows = form.parts.map((p, i) => ({
      question_id: questionId,
      part_number: i + 1,
      prompt: p.prompt.trim(),
      accepted_answers: parseAccepted(p.accepted),
    }))
    const { error: partsError } = await supabase.from('question_parts').upsert(rows, { onConflict: 'question_id,part_number' })
    if (partsError) throw partsError

    if (oldPath) deleteImage(oldPath)
  }

  async function save(e) {
    e.preventDefault()
    setBusy(true)
    setMsg('')
    try {
      if (form.type === 'mcq') await saveMcq()
      else await saveStation()
      setMsg('Saved')
      setForm(null)
      loadQuestions()
    } catch (err) {
      setMsg(`Error: ${err.message}`)
    } finally {
      setBusy(false)
    }
  }

  async function remove(q) {
    if (!window.confirm('Delete this question? Students’ past attempts on it will also be removed.')) return
    const { error } = await supabase.from('questions').delete().eq('id', q.id)
    if (!error && q.image_path) deleteImage(q.image_path)
    setMsg(error ? `Error: ${error.message}` : 'Deleted')
    loadQuestions()
  }

  async function importCsv(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const rows = csvToQuestions(await file.text())
      const { error } = await supabase.from('questions').insert(rows.map((r) => ({ ...r, week_id: weekId, question_type: 'mcq' })))
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

  function editQuestion(q) {
    if (q.question_type === 'station') {
      const parts = [...(q.question_parts || [])].sort((a, b) => a.part_number - b.part_number)
      setForm({
        id: q.id,
        type: 'station',
        stem: q.stem,
        explanation: q.explanation || '',
        is_published: q.is_published,
        image_path: q.image_path,
        imageFile: null,
        parts: [0, 1].map((i) => ({
          prompt: parts[i]?.prompt || '',
          accepted: (parts[i]?.accepted_answers || []).join('\n'),
        })),
      })
    } else {
      const opts = [...q.options, '', '', '', '', ''].slice(0, Math.max(5, q.options.length))
      setForm({ ...q, type: 'mcq', options: opts, explanation: q.explanation || '' })
    }
  }

  const setOption = (i, v) => setForm((f) => ({ ...f, options: f.options.map((o, j) => (j === i ? v : o)) }))
  const setPart = (i, key, v) => setForm((f) => ({ ...f, parts: f.parts.map((p, j) => (j === i ? { ...p, [key]: v } : p)) }))

  return (
    <div>
      <h1 className="text-2xl font-bold">Questions</h1>
      <p className="mt-1 text-slate-500">Choose a week, then add, edit or bulk-import questions. Multiple choice and photo questions are both supported.</p>
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
          <button className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700" onClick={() => setForm({ ...blankMcq })}>+ Multiple choice</button>
          <button className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700" onClick={() => setForm({ ...blankStation, parts: blankStation.parts.map((p) => ({ ...p })) })}>+ Photo question</button>
          <label className={`${btn} cursor-pointer px-3 py-2`}>
            Import CSV
            <input type="file" accept=".csv,text/csv" className="hidden" onChange={importCsv} />
          </label>
          <button className={`${btn} px-3 py-2`} onClick={downloadTemplate}>Download CSV template</button>
        </div>
      )}

      {form && (
        <form onSubmit={save} className="mt-4 space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
          <div className="text-sm font-semibold text-slate-500">
            {form.id ? 'Edit' : 'New'} {form.type === 'station' ? 'photo question' : 'multiple-choice question'}
          </div>

          {form.type === 'station' && (
            <div className="space-y-2">
              <label className="block text-sm font-medium">Photo</label>
              {previewUrl && <img src={previewUrl} alt="Preview" className="max-h-72 rounded-lg border border-slate-200" />}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(e) => setForm({ ...form, imageFile: e.target.files?.[0] || null })}
                className="block text-sm"
              />
              <p className="text-xs text-slate-400">Photos are shrunk automatically (max 1600 px) before upload. Only use images you have the right to use, and never patient-identifiable ones.</p>
            </div>
          )}

          <textarea
            className={input}
            rows={form.type === 'station' ? 2 : 3}
            placeholder={form.type === 'station' ? 'Instruction shown above the photo (optional), e.g. Look at the image below.' : 'Question text'}
            value={form.stem}
            onChange={(e) => setForm({ ...form, stem: e.target.value })}
          />

          {form.type === 'mcq' &&
            form.options.map((o, i) => (
              <div key={i} className="flex items-center gap-2">
                <input type="radio" name="correct" checked={form.correct_option === i} onChange={() => setForm({ ...form, correct_option: i })} className="accent-emerald-600" title="Mark as correct answer" />
                <span className="w-5 text-sm font-bold text-slate-400">{LETTERS[i]}</span>
                <input className={input} placeholder={`Option ${LETTERS[i]}${i > 1 ? ' (optional)' : ''}`} value={o} onChange={(e) => setOption(i, e.target.value)} />
              </div>
            ))}

          {form.type === 'station' &&
            form.parts.map((p, i) => (
              <div key={i} className="rounded-xl border border-slate-200 p-3">
                <div className="mb-2 text-sm font-semibold">Part {i + 1}</div>
                <input className={input} placeholder="Question, e.g. Name the structure labelled A" value={p.prompt} onChange={(e) => setPart(i, 'prompt', e.target.value)} />
                <textarea
                  className={`${input} mt-2`}
                  rows={2}
                  placeholder={'Accepted answers, one per line\ne.g.\nfemoral artery\ncommon femoral artery'}
                  value={p.accepted}
                  onChange={(e) => setPart(i, 'accepted', e.target.value)}
                />
                <p className="mt-1 text-xs text-slate-400">Matching ignores capital letters and punctuation. Add each alternative wording on its own line. The first line is shown to students as the model answer.</p>
              </div>
            ))}

          <textarea className={input} rows={3} placeholder={form.type === 'station' ? 'Explanation / teaching points shown after answering (optional)' : 'Explanation shown after answering'} value={form.explanation} onChange={(e) => setForm({ ...form, explanation: e.target.value })} />
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.is_published} onChange={(e) => setForm({ ...form, is_published: e.target.checked })} /> Published (visible to students)</label>
          <div className="flex gap-2">
            <button disabled={busy} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60">{busy ? 'Saving…' : 'Save'}</button>
            <button type="button" className={`${btn} px-4 py-2`} onClick={() => setForm(null)}>Cancel</button>
          </div>
        </form>
      )}

      <ul className="mt-6 space-y-2">
        {questions.map((q) => (
          <li key={q.id} className="rounded-xl border border-slate-200 bg-white p-3 text-sm">
            <div className="flex items-start gap-3">
              {q.question_type === 'station' && q.image_path && (
                <img src={imageUrl(q.image_path)} alt="" loading="lazy" className="h-14 w-14 shrink-0 rounded-md border border-slate-200 object-cover" />
              )}
              <div className="flex-1">
                <div className="font-medium">{q.stem}</div>
                <div className="mt-1 text-xs text-slate-500">
                  {q.question_type === 'station'
                    ? `Photo question · ${(q.question_parts || []).length} parts`
                    : `${q.options.length} options · correct: ${LETTERS[q.correct_option]}`}
                  {!q.is_published && ' · draft'}
                </div>
              </div>
              <button className={btn} onClick={() => editQuestion(q)}>Edit</button>
              <button className={`${btn} text-red-600`} onClick={() => remove(q)}>Delete</button>
            </div>
          </li>
        ))}
        {weekId && questions.length === 0 && <li className="text-sm text-slate-400">No questions in this week yet.</li>}
      </ul>
    </div>
  )
}
