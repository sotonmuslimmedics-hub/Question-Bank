import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Modal, Notice, btnDark, btnGhost, inputCls } from './ui'

const CHUNK = 80 // keeps the request address short when many questions are ticked

// "Add to paper…" from the Questions page: puts the ticked multiple-choice questions into a mock paper.
export default function AddToPaperDialog({ ids, onClose, onDone }) {
  const [papers, setPapers] = useState(null)
  const [paperId, setPaperId] = useState('')
  const [newTitle, setNewTitle] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    supabase
      .from('mock_papers')
      .select('id,title,status')
      .is('released_at', null)
      .order('created_at', { ascending: false })
      .then(({ data, error: err }) => {
        if (err) setError(err.message)
        setPapers(data || [])
      })
  }, [])

  async function submit() {
    setBusy(true)
    setError('')
    try {
      if (!paperId) throw new Error('Choose a paper, or create a new one.')
      // only multiple-choice questions can be sat as a timed paper
      const mcq = []
      for (let i = 0; i < ids.length; i += CHUNK) {
        const { data, error: err } = await supabase.from('questions').select('id,question_type').in('id', ids.slice(i, i + CHUNK))
        if (err) throw err
        mcq.push(...(data || []).filter((q) => q.question_type === 'mcq').map((q) => q.id))
      }
      const skipped = ids.length - mcq.length
      if (!mcq.length) throw new Error('Only multiple-choice questions can go in a timed paper, and none of the ticked ones are.')

      let target = paperId
      let title = papers.find((p) => p.id === paperId)?.title
      if (paperId === 'new') {
        if (!newTitle.trim()) throw new Error('Give the new paper a name.')
        const { data, error: err } = await supabase.from('mock_papers').insert({ title: newTitle.trim(), duration_minutes: 90 }).select('id,title').single()
        if (err) throw err
        target = data.id
        title = data.title
      }

      const { data: existing, error: eErr } = await supabase.from('mock_paper_questions').select('question_id,position').eq('paper_id', target)
      if (eErr) throw eErr
      const have = new Set(existing.map((r) => r.question_id))
      const start = existing.reduce((m, r) => Math.max(m, r.position), 0)
      const fresh = mcq.filter((id) => !have.has(id))
      if (fresh.length) {
        const { error: err } = await supabase.from('mock_paper_questions').insert(fresh.map((question_id, i) => ({ paper_id: target, question_id, position: start + i + 1 })))
        if (err) throw err
      }
      const bits = [`Added ${fresh.length} question${fresh.length === 1 ? '' : 's'} to “${title}”`]
      if (mcq.length - fresh.length > 0) bits.push(`${mcq.length - fresh.length} were already in it`)
      if (skipped > 0) bits.push(`${skipped} photo question${skipped === 1 ? '' : 's'} skipped`)
      onDone(`${bits.join('; ')}. They are now hidden from students’ normal practice until the paper is released.`)
    } catch (e) {
      setError(e.message || 'Could not add them.')
      setBusy(false)
    }
  }

  return (
    <Modal title={`Add ${ids.length} question${ids.length === 1 ? '' : 's'} to a paper`} onClose={onClose}>
      <Notice tone="error">{error}</Notice>
      <p className="text-sm text-stone-600">
        Questions in a mock paper are <b>hidden from students’ normal practice</b>, including from students who already answered them, until you release the paper. Photo questions can’t be used in timed papers and will be skipped.
      </p>
      <div className="mt-3 space-y-2">
        <select className={inputCls} value={paperId} onChange={(e) => setPaperId(e.target.value)} disabled={papers === null}>
          <option value="">Choose a paper…</option>
          {(papers || []).map((p) => <option key={p.id} value={p.id}>{p.title} ({p.status})</option>)}
          <option value="new">＋ New paper…</option>
        </select>
        {paperId === 'new' && (
          <input className={inputCls} autoFocus placeholder='Paper name, e.g. "Mock Paper 1"' value={newTitle} onChange={(e) => setNewTitle(e.target.value)} maxLength={120} />
        )}
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" className={btnGhost} onClick={onClose} disabled={busy}>Cancel</button>
        <button type="button" className={btnDark} onClick={submit} disabled={busy || !paperId}>{busy ? 'Adding…' : 'Add to paper'}</button>
      </div>
    </Modal>
  )
}
