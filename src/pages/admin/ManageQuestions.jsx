import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useSections } from '../../lib/useSections'
import { useSubjects } from '../../lib/useSubjects'
import { descendantIds, pathOf } from '../../lib/sections'
import { deleteImage } from '../../lib/images'
import QuestionEditor from '../../components/QuestionEditor'
import SlideDialog from '../../components/SlideDialog'
import { PageHeader, Notice, Empty, Pill, Modal, inputCls, btnDark, btnGhost, btnDanger } from '../../components/ui'

const PAGE = 40

export default function ManageQuestions() {
  const sec = useSections()
  const sub = useSubjects()
  const subjectName = (id) => sub.rows.find((s) => s.id === id)?.name
  const [rows, setRows] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState({ text: '', tone: 'ok' })
  const [f, setF] = useState({ section: '', subject: '', status: 'all', type: 'all', q: '', mine: false })
  const [picked, setPicked] = useState(new Set())
  const [editing, setEditing] = useState(null)
  const [slides, setSlides] = useState(false)
  const [moveTo, setMoveTo] = useState(null) // string | null

  const load = useCallback(
    async (append = false, from = 0) => {
      setLoading(true)
      let query = supabase
        .from('questions')
        .select('id,stem,options,correct_option,explanation,section_id,subject_id,question_type,image_path,is_published,difficulty,author_name,created_by,created_at,question_parts(id,part_number,prompt,accepted_answers)', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, from + PAGE - 1)
      if (f.section && sec.nodes.get(f.section)) query = query.in('section_id', descendantIds(sec.nodes.get(f.section)))
      if (f.subject) query = query.eq('subject_id', f.subject)
      if (f.status === 'published') query = query.eq('is_published', true)
      if (f.status === 'draft') query = query.eq('is_published', false)
      if (f.type !== 'all') query = query.eq('question_type', f.type)
      if (f.q.trim()) query = query.ilike('stem', `%${f.q.trim().replace(/[%,]/g, ' ')}%`)
      const { data, count, error } = await query
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

  async function bulkDelete() {
    if (!confirm(`Delete ${ids.length} question${ids.length === 1 ? '' : 's'} and their photos? This cannot be undone.`)) return
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
        Review student-teacher drafts, publish, move or delete questions, and build slides.
      </PageHeader>
      <Notice tone={msg.tone} onClose={() => setMsg({ text: '' })}>{msg.text}</Notice>

      <div className="mb-3 grid gap-2 sm:grid-cols-5">
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
        <input className={inputCls} placeholder="Search text" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} />
      </div>

      <p className="mb-2 text-xs text-stone-500">{total} question{total === 1 ? '' : 's'}</p>
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
