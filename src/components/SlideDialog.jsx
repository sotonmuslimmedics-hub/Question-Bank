import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { makeSlides } from '../lib/slides'
import { pathOf } from '../lib/sections'
import { Modal, inputCls, btnDark, Notice } from './ui'

// Turns the chosen question ids into a downloaded PowerPoint.
export default function SlideDialog({ ids, nodes, onClose }) {
  const [title, setTitle] = useState('Teaching session')
  const [subtitle, setSubtitle] = useState('')
  const [answers, setAnswers] = useState('after')
  const [explanations, setExplanations] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function go() {
    setBusy(true)
    setError('')
    try {
      const out = []
      for (let i = 0; i < ids.length; i += 100) {
        const { data, error } = await supabase
          .from('questions')
          .select('id,stem,options,correct_option,explanation,section_id,question_type,image_path,question_parts(part_number,prompt,accepted_answers)')
          .in('id', ids.slice(i, i + 100))
        if (error) throw error
        out.push(...data)
      }
      const order = new Map(ids.map((id, i) => [id, i]))
      out.sort((a, b) => order.get(a.id) - order.get(b.id))
      await makeSlides(out, { title, subtitle, answers, explanations, pathOf: (q) => pathOf(nodes, q.section_id) })
      onClose()
    } catch (e) {
      setError(e.message || 'Could not build the slides.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title={`Make slides (${ids.length} question${ids.length === 1 ? '' : 's'})`} onClose={onClose}>
      <Notice tone="error">{error}</Notice>
      <div className="space-y-3">
        <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Slide deck title" />
        <input className={inputCls} value={subtitle} onChange={(e) => setSubtitle(e.target.value)} placeholder="Subtitle (optional), e.g. date or group" />
        <label className="block text-sm font-medium">
          Answers
          <select className={`${inputCls} mt-1`} value={answers} onChange={(e) => setAnswers(e.target.value)}>
            <option value="after">All questions first, then all the answers</option>
            <option value="none">Questions only, no answer slides</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={explanations} onChange={(e) => setExplanations(e.target.checked)} /> Include explanations on answer slides
        </label>
        <button className={`${btnDark} w-full`} disabled={busy || !ids.length} onClick={go}>{busy ? 'Building…' : 'Download PowerPoint'}</button>
      </div>
    </Modal>
  )
}
