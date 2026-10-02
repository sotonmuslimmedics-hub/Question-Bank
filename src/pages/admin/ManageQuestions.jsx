import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useSections } from '../../lib/useSections'
import { useSubjects } from '../../lib/useSubjects'
import { descendantIds, pathOf } from '../../lib/sections'
import { deleteImage } from '../../lib/images'
import QuestionEditor from '../../components/QuestionEditor'
import SlideDialog from '../../components/SlideDialog'
import { PageHeader, Notice, Empty, Pill, Modal, inputCls, btnDark, btnGhost, btnDanger, useConfirm, usePrompt } from '../../components/ui'

const PAGE = 40

export default function ManageQuestions() {
  const sec = useSections()
  const sub = useSubjects()
  const [confirmDialog, askConfirm] = useConfirm()
  const [tagDialog, askTag] = usePrompt()
  const subjectName = (id) => sub.rows.find((s) => s.id === id)?.name
  const [rows, setRows] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState({ text: '', tone: 'ok' })
  const [f, setF] = useState({ section: '', subject: '', status: 'all', type: 'all', q: '', mine: false, examTag: '' })
  const [picked, setPicked] = useState(new Set())
  const [editing, setEditing] = useState(null)
  const [slides, setSlides] = useState(false)
  const [moveTo, setMoveTo] = useState(null) // string | null

  // Questions used in a mock exam are often ones already living in their
  // normal topic section, scattered across the syllabus — not a fresh batch
  // written into one place. exam_tag lets a lead stamp an arbitrary
  // selection with a shared label (e.g. "BM4 Mock — March 2026") so that
  // exact set can be pulled back up with one filter later — to publish them
  // for revision after the exam, say — instead of hunting down and
  // reselecting each question individually.
  const [tags, setTags] = useState([])
  useEffect(() => {
    supabase
      .from('questions')
      .select('exam_tag')
      .not('exam_tag', 'is', null)
      .then(({ data }) => setTags([...new Set((data || []).map((r) => r.exam_tag))].sort()))
  }, [msg])

  // Guards against out-of-order responses: publishing/deleting/moving all
  // trigger an immediate reload, and a filter change shortly after triggers
  // its own (debounced) reload. Without this, whichever request happened to
  // resolve last would win — even if it was the older, differently-filtered
  // one — making the list look "stuck" and unresponsive to the filters.
  const loadSeq = useRef(0)
  const load = useCallback(
    async (append = false, from = 0) => {
      const seq = ++loadSeq.current
      setLoading(true)
      let query = supabase
        .from('questions')
        .select('id,stem,options,correct_option,explanation,explanation_image_path,section_id,subject_id,question_type,image_path,is_published,difficulty,author_name,created_by,created_at,exam_tag,question_parts(id,part_number,prompt,accepted_answers)', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, from + PAGE - 1)
      if (f.section && sec.nodes.get(f.section)) query = query.in('section_id', descendantIds(sec.nodes.get(f.section)))
      if (f.subject) query = query.eq('subject_id', f.subject)
      if (f.status === 'published') query = query.eq('is_published', true)
      if (f.status === 'draft') query = query.eq('is_published', false)
      if (f.type !== 'all') query = query.eq('question_type', f.type)
      if (f.examTag) query = query.eq('exam_tag', f.examTag)
      if (f.q.trim()) query = query.ilike('stem', `%${f.q.trim().replace(/[%,]/g, ' ')}%`)
      const { data, count, error } = await query
      if (seq !== loadSeq.current) return // a newer load was issued meanwhile; drop this stale response
      if (error) setMsg({ text: error.message, tone: 'error' })
      setRows((r) => (append ? [...r, ...(data || [])] : data || []))
      setTotal(count || 0)
      setLoading(false)
    },
    [f, sec.nodes],
  )
  useEffect(() => {
    if (sec.loading) return
    const t = setTimeout(() => load(false, 0), 250)
    return () => clearTimeout(t)
  }, [load, sec.loading])

  const ids = [...picked]
  const toggle = (id) => setPicked((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n })

  async function bulk(patch, text) {
    const { error } = await supabase.from('questions').update(patch).in('id', ids)
    setMsg(error ? { text: error.message, tone: 'error' } : { text, tone: 'ok' })
    setPicked(new Set())
    load(false, 0)
  }

  async function tagSelected() {
    const existing = [...new Set(rows.filter((r) => picked.has(r.id) && r.exam_tag).map((r) => r.exam_tag))]
    const val = await askTag('Mock name (e.g. "BM4 Mock — March 2026")', existing.length === 1 ? existing[0] : '')
    if (!val) return // cancelled, or submitted blank — never clears a tag from here to avoid the two being indistinguishable
    await bulk({ exam_tag: val }, `Tagged as "${val}"`)
  }

  async function bulkDelete() {
    const ok = await askConfirm(`Delete ${ids.length} question${ids.length === 1 ? '' : 's'} and their photos? This cannot be undone.`)
    if (!ok) return
    const imgs = rows.filter((r) => picked.has(r.id) && r.image_path).map((r) => r.image_path)
    const { error } = await supabase.from('questions').delete().in('id', ids)
    if (error) return setMsg({ text: error.message, tone: 'error' })
    for (const p of imgs) await deleteImage(p)
    setMsg({ text: 'Deleted, including their photos.', tone: 'ok' })
    setPicked(new Set())
    load(false, 0)
  }

  return (
    <div className="pb-28">
      <PageHeader title="Questions" actions={<button className={btnDark} onClick={() => setEditing({})}>New question</button>}>
        Review student-teacher drafts, publish, move or delete questions, and build slides. Tick any set of questions — even ones scattered across different sections — and use "Tag for mock…" to label them, so you can filter back to that exact set later (e.g. to publish them after the exam) without reselecting each one.
      </PageHeader>
      <Notice tone={msg.tone} onClose={() => setMsg({ text: '' })}>{msg.text}</Notice>

      <div className="mb-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <select className={inputCls} value={f.section} onChange={(e) => setF({ ...f, section: e.target.value })}>
          <option value="">All sections</option>
          {sec.flat.map((s) => <option key={s.id} value={s.id}>{' '.repeat(s.depth)}{s.name}</option>)}
        </select>
        <select className={inputCls} value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })}>
          <option value="">All subjects</option>
          {sub.rows.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select className={inputCls} value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>
          <option value="all">Any status</option>
          <option value="draft">Drafts (review queue)</option>
          <option value="published">Published</option>
        </select>
        <select className={inputCls} value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>
          <option value="all">MCQ and photo</option>
          <option value="mcq">MCQ only</option>
          <option value="station">Photo only</option>
        </select>
        <select className={inputCls} value={f.examTag} onChange={(e) => setF({ ...f, examTag: e.target.value })}>
          <option value="">Any mock tag</option>
          {tags.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <input className={inputCls} placeholder="Search text" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} />
      </div>

      <div className="mb-2 flex items-center gap-2 text-xs text-stone-500">
        {rows.length > 0 && (
          <input
            type="checkbox"
            className="h-4 w-4 shrink-0 accent-brand-600"
            checked={rows.every((r) => picked.has(r.id))}
            onChange={() => setPicked((p) => {
              const allChecked = rows.every((r) => picked.has(r.id))
              const n = new Set(p)
              rows.forEach((r) => (allChecked ? n.delete(r.id) : n.add(r.id)))
              return n
            })}
            aria-label="Select all loaded"
          />
        )}
        <span>{total} question{total === 1 ? '' : 's'}{rows.length > 0 ? ` (select all to pick the ${rows.length} shown${rows.length < total ? ' — load more first for the rest' : ''})` : ''}</span>
      </div>
      {!loading && !rows.length && <Empty>No questions match.</Empty>}
      <div className="divide-y divide-stone-100 rounded-2xl border border-stone-200 bg-white">
        {rows.map((q) => (
          <div key={q.id} className="flex items-start gap-3 p-3">
            <input type="checkbox" className="mt-1 h-5 w-5 shrink-0 accent-brand-600" checked={picked.has(q.id)} onChange={() => toggle(q.id)} aria-label="Select" />
            <button className="min-w-0 flex-1 text-left" onClick={() => setEditing(q)}>
              <span className="line-clamp-2 text-sm font-medium">{q.stem}</span>
              <span className="mt-1 flex flex-wrap items-center gap-2 text-xs text-stone-500">
                <Pill tone={q.is_published ? 'green' : 'amber'}>{q.is_published ? 'Live' : 'Draft'}</Pill>
                <Pill>{q.question_type === 'station' ? 'Photo' : 'MCQ'}</Pill>
                {subjectName(q.subject_id) && <Pill>{subjectName(q.subject_id)}</Pill>}
                {q.exam_tag && <Pill tone="amber">{q.exam_tag}</Pill>}
                {q.author_name && <span>{q.author_name}</span>}
                <span className="truncate">{pathOf(sec.nodes, q.section_id)}</span>
              </span>
            </button>
          </div>
        ))}
      </div>
      {rows.length < total && (
        <div className="mt-3 text-center">
          <button className={btnGhost} disabled={loading} onClick={() => load(true, rows.length)}>Load more</button>
        </div>
      )}

      {picked.size > 0 && (
        <div className="safe-bottom fixed inset-x-0 bottom-[3.9rem] z-20 border-t border-stone-200 bg-white px-4 py-3 shadow-lg sm:bottom-0">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2">
            <b className="mr-1 text-sm">{picked.size} selected</b>
            <button className={btnGhost} onClick={() => bulk({ is_published: true }, 'Published')}>Publish</button>
            <button className={btnGhost} onClick={() => bulk({ is_published: false }, 'Moved back to drafts')}>Unpublish</button>
            <button className={btnGhost} onClick={() => setMoveTo('')}>Move…</button>
            <button className={btnGhost} onClick={tagSelected}>Tag for mock…</button>
            <button className={btnGhost} onClick={() => setSlides(true)}>Slides</button>
            <button className={btnDanger} onClick={bulkDelete}>Delete</button>
            <button className={btnGhost} onClick={() => setPicked(new Set())}>Clear</button>
          </div>
        </div>
      )}

      {editing && (
        <Modal title={editing.id ? 'Edit question' : 'New question'} onClose={() => setEditing(null)} wide>
          <QuestionEditor initial={editing.id ? editing : null} sections={sec.flat} subjects={sub.rows} canPublish onCancel={() => setEditing(null)} onSaved={() => { setEditing(null); load(false, 0) }} />
        </Modal>
      )}
      {slides && <SlideDialog ids={ids} nodes={sec.nodes} onClose={() => setSlides(false)} />}
      {confirmDialog}
      {tagDialog}
      {moveTo !== null && (
        <Modal title={`Move ${picked.size} question${picked.size === 1 ? '' : 's'}`} onClose={() => setMoveTo(null)}>
          <select className={inputCls} value={moveTo} onChange={(e) => setMoveTo(e.target.value)}>
            <option value="">Choose a section…</option>
            {sec.flat.map((s) => <option key={s.id} value={s.id}>{s.pathLabel}</option>)}
          </select>
          <button className={`${btnDark} mt-3 w-full`} disabled={!moveTo} onClick={() => { bulk({ section_id: moveTo }, 'Moved'); setMoveTo(null) }}>Move</button>
        </Modal>
      )}
    </div>
  )
}
