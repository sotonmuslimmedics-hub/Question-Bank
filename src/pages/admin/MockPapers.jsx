import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useSections } from '../../lib/useSections'
import { useSubjects } from '../../lib/useSubjects'
import { pathOf } from '../../lib/sections'
import { fmtDate, fmtDuration, fromLocalInput, toLocalInput } from '../../lib/mock'
import { PageHeader, Notice, Empty, Pill, Modal, card, inputCls, btnDark, btnPrimary, btnGhost, btnDanger, useConfirm } from '../../components/ui'

const GENERIC_STEM = /^\s*study the (image|photo|picture)/i

// Leads: create timed mock papers, order their questions, open and close them, release them to practice.
export default function MockPapers() {
  const nav = useNavigate()
  const sec = useSections()
  const sub = useSubjects()
  const [confirmDialog, askConfirm] = useConfirm()
  const [papers, setPapers] = useState(null)
  const [items, setItems] = useState([]) // every mock_paper_questions row with its question
  const [open, setOpen] = useState('') // expanded paper id
  const [editing, setEditing] = useState(null) // paper being edited, or {} for new
  const [msg, setMsg] = useState({ text: '', tone: 'ok' })
  const [busy, setBusy] = useState('')

  const load = useCallback(async () => {
    const [p, i] = await Promise.all([
      supabase.from('mock_papers').select('*').order('created_at', { ascending: false }),
      supabase
        .from('mock_paper_questions')
        .select('paper_id,question_id,position,questions(id,stem,title,question_type,is_published,section_id,subject_id)')
        .order('position'),
    ])
    const err = p.error || i.error
    if (err) setMsg({ text: err.message, tone: 'error' })
    setPapers(p.data || [])
    setItems(i.data || [])
  }, [])
  useEffect(() => { load() }, [load])

  const byPaper = useMemo(() => {
    const m = new Map()
    for (const it of items) {
      if (!it.questions) continue
      if (!m.has(it.paper_id)) m.set(it.paper_id, [])
      m.get(it.paper_id).push(it)
    }
    return m
  }, [items])

  const subjectName = (id) => sub.rows.find((s) => s.id === id)?.name
  const ok = (text) => setMsg({ text, tone: 'ok' })
  const bad = (text) => setMsg({ text, tone: 'error' })

  async function run(id, fn, success) {
    setBusy(id)
    setMsg({ text: '' })
    try {
      await fn()
      if (success) ok(success)
    } catch (e) {
      bad(e.message || 'That did not work.')
    }
    setBusy('')
    load()
  }

  const setStatus = (p, status, success) => run(p.id, async () => {
    const { error } = await supabase.from('mock_papers').update({ status }).eq('id', p.id)
    if (error) throw error
  }, success)

  function goLive(p) {
    const list = (byPaper.get(p.id) || []).filter((x) => x.questions.question_type === 'mcq')
    if (!list.length) return bad('Add some multiple-choice questions first.')
    // Whether a question is published has no bearing here: "unpublished" just means it is not in normal practice yet.
    setStatus(p, 'live', `“${p.title}” is now open to students.`)
  }

  async function release(p) {
    const yes = await askConfirm(`Release “${p.title}”? It will close, and its published questions go back into students' normal practice. Any that are still unpublished stay hidden until you publish them on the Questions page. Students keep their scores and can still review. This can't be undone.`, 'Release')
    if (!yes) return
    run(p.id, async () => {
      const { error } = await supabase.rpc('mock_release', { p_paper: p.id })
      if (error) throw error
    }, 'Released. Its published questions are back in normal practice; unpublished ones stay hidden until you publish them.')
  }

  async function remove(p) {
    const yes = await askConfirm(`Delete “${p.title}”? This also deletes every student's sittings and scores for it, and its questions go back to normal practice. This cannot be undone.`)
    if (!yes) return
    run(p.id, async () => {
      const { error } = await supabase.from('mock_papers').delete().eq('id', p.id)
      if (error) throw error
    }, 'Paper deleted.')
  }

  async function preview(p) {
    setBusy(p.id)
    const { data, error } = await supabase.rpc('mock_start', { p_paper: p.id })
    setBusy('')
    if (error) return bad(error.message)
    nav(`/mocks/${data.attempt_id}`)
  }

  async function reorder(p, from, to) {
    const list = [...(byPaper.get(p.id) || [])]
    if (to < 0 || to >= list.length) return
    const [moved] = list.splice(from, 1)
    list.splice(to, 0, moved)
    run(p.id, async () => {
      const { error } = await supabase
        .from('mock_paper_questions')
        .upsert(list.map((it, i) => ({ paper_id: p.id, question_id: it.question_id, position: i + 1 })), { onConflict: 'paper_id,question_id' })
      if (error) throw error
    })
  }

  async function removeQuestion(p, it) {
    run(p.id, async () => {
      const { error } = await supabase.from('mock_paper_questions').delete().eq('paper_id', p.id).eq('question_id', it.question_id)
      if (error) throw error
    }, 'Removed. It is back in normal practice unless it is in another unreleased paper.')
  }

  return (
    <div>
      <PageHeader title="Mock papers" actions={<button className={btnDark} onClick={() => setEditing({})}>New paper</button>}>
        Timed multiple-choice papers for students. Tick questions on the Questions page and use “Add to paper…”. While a question is in an unreleased paper, students can’t see it in normal practice. Set a paper live to open it; when it closes, release it to put its questions back into practice.
      </PageHeader>
      <Notice tone={msg.tone} onClose={() => setMsg({ text: '' })}>{msg.text}</Notice>

      {papers === null && <p className="text-sm text-stone-400">Loading…</p>}
      {papers && papers.length === 0 && <Empty>No papers yet. Create one, or tick questions on the Questions page and choose “Add to paper…”.</Empty>}

      <div className="space-y-3">
        {(papers || []).map((p) => {
          const list = byPaper.get(p.id) || []
          const mcq = list.filter((x) => x.questions.question_type === 'mcq')
          const released = !!p.released_at
          const expanded = open === p.id
          return (
            <div key={p.id} className={card}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <h2 className="text-lg font-bold leading-tight">{p.title}</h2>
                  {p.description && <p className="mt-0.5 text-sm text-stone-500">{p.description}</p>}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {released ? <Pill tone="brand">Released to practice</Pill> : p.status === 'live' ? <Pill tone="green">Live</Pill> : p.status === 'closed' ? <Pill>Closed</Pill> : <Pill tone="amber">Draft</Pill>}
                </div>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-stone-500">
                <Pill tone="brand">{mcq.length} questions</Pill>
                <Pill tone="brand">{fmtDuration(p.duration_minutes)}</Pill>
                {p.opens_at && <span>Opens {fmtDate(p.opens_at)}</span>}
                {p.closes_at && <span>Closes {fmtDate(p.closes_at)}</span>}
                {list.length > mcq.length && <span className="text-amber-700">{list.length - mcq.length} photo question(s) are ignored</span>}
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <button className={btnGhost} onClick={() => setOpen(expanded ? '' : p.id)}>{expanded ? 'Hide questions' : 'Questions & order'}</button>
                <button className={btnGhost} onClick={() => setEditing(p)}>Edit details</button>
                <button className={btnGhost} disabled={busy === p.id || mcq.length === 0} onClick={() => preview(p)}>Preview as student</button>
                {!released && p.status === 'draft' && <button className={btnPrimary} disabled={busy === p.id} onClick={() => goLive(p)}>Set live</button>}
                {!released && p.status === 'live' && <button className={btnGhost} disabled={busy === p.id} onClick={() => setStatus(p, 'draft', 'Back to draft. Students can no longer start it; anyone mid-sitting can finish.')}>Back to draft</button>}
                {!released && p.status === 'live' && <button className={btnGhost} disabled={busy === p.id} onClick={() => setStatus(p, 'closed', 'Closed. Students keep their scores and can review.')}>Close</button>}
                {!released && p.status === 'closed' && <button className={btnGhost} disabled={busy === p.id} onClick={() => setStatus(p, 'live', 'Re-opened.')}>Re-open</button>}
                {!released && p.status === 'closed' && <button className={btnGhost} disabled={busy === p.id} onClick={() => release(p)}>Release to practice</button>}
                <button className={btnDanger} disabled={busy === p.id} onClick={() => remove(p)}>Delete</button>
              </div>

              {expanded && (
                <div className="mt-4">
                  {list.length === 0 ? (
                    <Empty>No questions yet. Tick questions on the Questions page and choose “Add to paper…”.</Empty>
                  ) : (
                    <ol className="divide-y divide-stone-100 rounded-xl border border-stone-200">
                      {list.map((it, i) => {
                        const q = it.questions
                        const heading = q.title || q.stem
                        return (
                          <li key={it.question_id} className="flex items-start gap-2 p-2.5 text-sm">
                            <span className="w-7 shrink-0 pt-0.5 text-right text-xs font-bold text-stone-400">{i + 1}</span>
                            <div className="min-w-0 flex-1">
                              <div className="line-clamp-2 font-medium">{GENERIC_STEM.test(heading) ? `Photo: ${heading}` : heading}</div>
                              <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-stone-500">
                                {q.question_type !== 'mcq' && <Pill tone="amber">Photo (ignored)</Pill>}
                                {!q.is_published && <Pill>Unpublished</Pill>}
                                {subjectName(q.subject_id) && <Pill>{subjectName(q.subject_id)}</Pill>}
                                <span className="truncate">{pathOf(sec.nodes, q.section_id)}</span>
                              </div>
                            </div>
                            <div className="flex shrink-0 gap-1">
                              <button className={btnGhost} aria-label="Move up" disabled={busy === p.id || i === 0} onClick={() => reorder(p, i, i - 1)}>↑</button>
                              <button className={btnGhost} aria-label="Move down" disabled={busy === p.id || i === list.length - 1} onClick={() => reorder(p, i, i + 1)}>↓</button>
                              <button className={btnDanger} aria-label="Remove from paper" disabled={busy === p.id} onClick={() => removeQuestion(p, it)}>✕</button>
                            </div>
                          </li>
                        )
                      })}
                    </ol>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {editing && <PaperForm paper={editing} onClose={() => setEditing(null)} onSaved={(t) => { setEditing(null); ok(t); load() }} onError={bad} />}
      {confirmDialog}
    </div>
  )
}

function PaperForm({ paper, onClose, onSaved, onError }) {
  const isNew = !paper.id
  const [title, setTitle] = useState(paper.title || '')
  const [description, setDescription] = useState(paper.description || '')
  const [minutes, setMinutes] = useState(paper.duration_minutes || 90)
  const [opens, setOpens] = useState(toLocalInput(paper.opens_at))
  const [closes, setCloses] = useState(toLocalInput(paper.closes_at))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function save(e) {
    e.preventDefault()
    setError('')
    const mins = Number(minutes)
    if (!title.trim()) return setError('Give the paper a name.')
    if (!Number.isInteger(mins) || mins < 1 || mins > 360) return setError('Time limit must be a whole number of minutes, from 1 to 360.')
    if (opens && closes && new Date(closes) <= new Date(opens)) return setError('The closing time must be after the opening time.')
    setBusy(true)
    const row = {
      title: title.trim(),
      description: description.trim() || null,
      duration_minutes: mins,
      opens_at: fromLocalInput(opens),
      closes_at: fromLocalInput(closes),
    }
    const { error: err } = isNew
      ? await supabase.from('mock_papers').insert(row)
      : await supabase.from('mock_papers').update(row).eq('id', paper.id)
    setBusy(false)
    if (err) { setError(err.message); onError?.(err.message); return }
    onSaved(isNew ? 'Paper created as a draft.' : 'Saved.')
  }

  return (
    <Modal title={isNew ? 'New mock paper' : 'Edit paper'} onClose={onClose}>
      <form onSubmit={save} className="space-y-3">
        <Notice tone="error">{error}</Notice>
        <label className="block text-sm font-medium">
          Name
          <input className={`${inputCls} mt-1`} value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Mock Paper 1" required />
        </label>
        <label className="block text-sm font-medium">
          Description <span className="font-normal text-stone-400">(optional)</span>
          <textarea className={`${inputCls} mt-1`} rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What it covers, who it is for" />
        </label>
        <label className="block text-sm font-medium">
          Time limit (minutes)
          <input className={`${inputCls} mt-1`} type="number" min="1" max="360" value={minutes} onChange={(e) => setMinutes(e.target.value)} required />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm font-medium">
            Opens <span className="font-normal text-stone-400">(optional)</span>
            <input className={`${inputCls} mt-1`} type="datetime-local" value={opens} onChange={(e) => setOpens(e.target.value)} />
          </label>
          <label className="block text-sm font-medium">
            Closes <span className="font-normal text-stone-400">(optional)</span>
            <input className={`${inputCls} mt-1`} type="datetime-local" value={closes} onChange={(e) => setCloses(e.target.value)} />
          </label>
        </div>
        <p className="text-xs text-stone-500">
          Opening and closing only control when students can <b>start</b> a sitting; one already underway can always be finished. Leave both blank to open it as soon as you set it live and keep it open until you close it.
        </p>
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className={btnGhost} onClick={onClose}>Cancel</button>
          <button type="submit" className={btnDark} disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
        </div>
      </form>
    </Modal>
  )
}
