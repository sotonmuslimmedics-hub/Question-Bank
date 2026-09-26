import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { useSections } from '../lib/useSections'
import { useSubjects } from '../lib/useSubjects'
import { pathOf, fetchAll } from '../lib/sections'
import { deleteImage } from '../lib/images'
import QuestionEditor from '../components/QuestionEditor'
import SlideDialog from '../components/SlideDialog'
import { PageHeader, Notice, Empty, Pill, Modal, btnDark, btnGhost, btnDanger, card, useConfirm } from '../components/ui'

// Student-teacher workspace. Everything here is limited to the signed-in person's own questions.
export default function Teach() {
  const { user } = useAuth()
  const sec = useSections()
  const sub = useSubjects()
  const [confirmDialog, askConfirm] = useConfirm()
  const [rows, setRows] = useState(null)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(null) // question | {} for new
  const [picked, setPicked] = useState(new Set())
  const [slides, setSlides] = useState(false)

  async function load() {
    try {
      const data = await fetchAll(() =>
        supabase
          .from('questions')
          .select('id,stem,options,correct_option,explanation,section_id,subject_id,question_type,image_path,is_published,difficulty,created_at,question_parts(id,part_number,prompt,accepted_answers)')
          .eq('created_by', user.id)
          .order('created_at', { ascending: false }),
      )
      setRows(data)
    } catch (e) {
      setError(e.message)
      setRows([])
    }
  }
  useEffect(() => { load() }, [])

  async function remove(q) {
    const ok = await askConfirm('Delete this draft? This cannot be undone.')
    if (!ok) return
    const { error } = await supabase.from('questions').delete().eq('id', q.id)
    if (error) return setError(error.message)
    if (q.image_path) await deleteImage(q.image_path)
    setPicked((p) => { const n = new Set(p); n.delete(q.id); return n })
    load()
  }

  const toggle = (id) => setPicked((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n })
  const all = rows || []

  return (
    <div>
      <PageHeader
        title="Teach"
        actions={
          <>
            <button className={btnGhost} disabled={!picked.size} onClick={() => setSlides(true)}>Make slides ({picked.size})</button>
            <button className={btnDark} onClick={() => setEditing({})}>New question</button>
          </>
        }
      >
        Write questions for the bank and build teaching slides from them. You only see your own questions here. New questions stay as drafts until an academic lead publishes them.
      </PageHeader>
      <Notice tone="error" onClose={() => setError('')}>{error}</Notice>
      {rows && !all.length && <Empty>You haven't written any questions yet.</Empty>}
      {all.length > 0 && (
        <div className="mb-2 flex gap-2 text-xs">
          <button className={btnGhost} onClick={() => setPicked(new Set(all.map((q) => q.id)))}>Select all</button>
          <button className={btnGhost} onClick={() => setPicked(new Set())}>Clear</button>
        </div>
      )}
      <div className="space-y-2">
        {all.map((q) => (
          <div key={q.id} className={`${card} flex items-start gap-3`}>
            <input type="checkbox" className="mt-1 h-5 w-5 shrink-0 accent-brand-600" checked={picked.has(q.id)} onChange={() => toggle(q.id)} aria-label="Select for slides" />
            <div className="min-w-0 flex-1">
              <p className="line-clamp-2 text-sm font-medium">{q.stem}</p>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-stone-500">
                <Pill tone={q.is_published ? 'green' : 'amber'}>{q.is_published ? 'Live' : 'Draft'}</Pill>
                <Pill>{q.question_type === 'station' ? 'Photo' : 'MCQ'}</Pill>
                {sub.rows.find((s) => s.id === q.subject_id)?.name && <Pill>{sub.rows.find((s) => s.id === q.subject_id).name}</Pill>}
                <span className="truncate">{pathOf(sec.nodes, q.section_id)}</span>
              </div>
              {!q.is_published && (
                <div className="mt-2 flex gap-2">
                  <button className={btnGhost} onClick={() => setEditing(q)}>Edit</button>
                  <button className={btnDanger} onClick={() => remove(q)}>Delete</button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <Modal title={editing.id ? 'Edit question' : 'New question'} onClose={() => setEditing(null)} wide>
          <QuestionEditor
            initial={editing.id ? editing : null}
            sections={sec.flat}
            subjects={sub.rows}
            canPublish={false}
            onCancel={() => setEditing(null)}
            onSaved={() => { setEditing(null); load() }}
          />
        </Modal>
      )}
      {slides && <SlideDialog ids={[...picked]} nodes={sec.nodes} onClose={() => setSlides(false)} />}
      {confirmDialog}
    </div>
  )
}
