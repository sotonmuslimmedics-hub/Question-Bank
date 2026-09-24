import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { imageUrl, uploadImage, deleteImage } from '../lib/images'
import { parseAccepted } from '../lib/answers'
import { inputCls, btnDark, btnGhost, Notice, Modal } from './ui'
import ImageAnnotator from './ImageAnnotator'

const LETTERS = 'ABCDEFGH'

// Shared by student teachers (their own drafts) and leads/admins (anything).
// Photos can be pasted from the clipboard, dropped, or chosen from the device.
export default function QuestionEditor({ initial, sections, subjects, canPublish, onSaved, onCancel }) {
  const q = initial || {}
  const [type, setType] = useState(q.question_type || 'mcq')
  const [sectionId, setSectionId] = useState(q.section_id || '')
  const [subjectId, setSubjectId] = useState(q.subject_id || '')
  const [stem, setStem] = useState(q.stem || '')
  const [options, setOptions] = useState(q.options || ['', '', '', '', ''])
  const [correct, setCorrect] = useState(q.correct_option ?? 0)
  const [explanation, setExplanation] = useState(q.explanation || '')
  const [difficulty, setDifficulty] = useState(q.difficulty || '')
  const [published, setPublished] = useState(!!q.is_published)
  const [parts, setParts] = useState(() => {
    const p = [...(q.question_parts || [])].sort((a, b) => a.part_number - b.part_number)
    return [0, 1].map((i) => ({ prompt: p[i]?.prompt || '', accepted: (p[i]?.accepted_answers || []).join('\n') }))
  })
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [removeImage, setRemoveImage] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [drag, setDrag] = useState(false)
  const [annotating, setAnnotating] = useState(false)
  const inputRef = useRef(null)

  const setPicked = (f) => {
    if (!f) return
    if (!f.type.startsWith('image/')) return setError('That is not an image.')
    setError('')
    setFile(f)
    setRemoveImage(false)
    setPreview((old) => {
      if (old) URL.revokeObjectURL(old)
      return URL.createObjectURL(f)
    })
  }

  // Ctrl/Cmd+V anywhere in the editor pastes a copied or screenshotted image.
  useEffect(() => {
    if (type !== 'station') return
    const onPaste = (e) => {
      const item = [...(e.clipboardData?.items || [])].find((i) => i.type.startsWith('image/'))
      if (item) {
        e.preventDefault()
        setPicked(item.getAsFile())
      }
    }
    document.addEventListener('paste', onPaste)
    return () => document.removeEventListener('paste', onPaste)
  }, [type])

  const shownImage = removeImage ? null : preview || imageUrl(q.image_path)

  // Only a freshly pasted/dropped/chosen image (still a local blob) can be marked up —
  // an already-uploaded photo would need re-adding first, to keep the canvas same-origin.
  function onAnnotated(blob) {
    const f = new File([blob], file?.name || 'annotated.png', { type: 'image/png' })
    setPicked(f)
    setAnnotating(false)
  }

  async function save(e) {
    e.preventDefault()
    setError('')
    if (!sectionId) return setError('Choose where this question belongs.')
    if (!subjectId) return setError('Choose a subject.')
    if (!stem.trim()) return setError('The question text is empty.')
    const clean = options.map((o) => o.trim())
    if (type === 'mcq') {
      const filled = clean.filter(Boolean)
      if (filled.length < 2) return setError('Give at least two options.')
      if (!clean[correct]) return setError('The correct answer must be one of the filled options.')
    } else {
      if (!shownImage) return setError('Add a photo: paste it, drop it here, or choose a file.')
      for (const [i, p] of parts.entries()) {
        if (!p.prompt.trim()) return setError(`Part ${i + 1} needs a question.`)
        if (!parseAccepted(p.accepted).length) return setError(`Part ${i + 1} needs at least one accepted answer.`)
      }
    }
    setBusy(true)
    let newPath = null
    try {
      if (type === 'station' && file) newPath = await uploadImage(file)
      let opts = null
      let corr = null
      if (type === 'mcq') {
        // drop blank options but keep the correct index pointing at the same answer
        const keep = clean.map((o, i) => ({ o, i })).filter((x) => x.o)
        opts = keep.map((x) => x.o)
        corr = keep.findIndex((x) => x.i === correct)
      }
      const imagePath = type === 'station' ? (newPath ?? (removeImage ? null : q.image_path ?? null)) : null
      const row = {
        section_id: sectionId,
        subject_id: subjectId,
        question_type: type,
        stem: stem.trim(),
        options: opts,
        correct_option: corr,
        explanation: explanation.trim() || null,
        difficulty: difficulty ? Number(difficulty) : null,
        image_path: imagePath,
        is_published: canPublish ? published : false,
      }
      let id = q.id
      if (id) {
        const { error } = await supabase.from('questions').update(row).eq('id', id)
        if (error) throw error
      } else {
        const { data, error } = await supabase.from('questions').insert(row).select('id').single()
        if (error) throw error
        id = data.id
      }
      if (type === 'station') {
        await supabase.from('question_parts').delete().eq('question_id', id)
        const { error } = await supabase.from('question_parts').insert(
          parts.map((p, i) => ({ question_id: id, part_number: i + 1, prompt: p.prompt.trim(), accepted_answers: parseAccepted(p.accepted) })),
        )
        if (error) throw error
      }
      // tidy storage: remove the previous photo if it was replaced or removed
      if (q.image_path && q.image_path !== imagePath) await deleteImage(q.image_path)
      onSaved(id)
    } catch (err) {
      if (newPath) await deleteImage(newPath)
      setError(err.message || 'Could not save.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={save} className="space-y-4">
      <Notice tone="error">{error}</Notice>

      <div className="flex gap-2">
        {[['mcq', 'Multiple choice'], ['station', 'Photo station']].map(([v, l]) => (
          <button
            key={v}
            type="button"
            disabled={!!q.id && type !== v}
            onClick={() => setType(v)}
            className={`flex-1 rounded-xl border px-3 py-2 text-sm font-medium disabled:opacity-40 ${type === v ? 'border-stone-900 bg-stone-900 text-white' : 'border-stone-300 bg-white'}`}
          >
            {l}
          </button>
        ))}
      </div>

      <label className="block text-sm font-medium">
        Where does it belong?
        <select className={`${inputCls} mt-1`} value={sectionId} onChange={(e) => setSectionId(e.target.value)} required>
          <option value="">Choose…</option>
          {sections.map((s) => (
            <option key={s.id} value={s.id} disabled={s.node.effectiveLocked && !q.id}>
              {s.pathLabel}
              {s.node.effectiveLocked ? ' (locked)' : ''}
            </option>
          ))}
        </select>
      </label>

      <label className="block text-sm font-medium">
        Subject
        <select className={`${inputCls} mt-1`} value={subjectId} onChange={(e) => setSubjectId(e.target.value)} required>
          <option value="">Choose…</option>
          {(subjects || []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </label>

      <label className="block text-sm font-medium">
        {type === 'mcq' ? 'Question' : 'Prompt shown above the photo'}
        <textarea className={`${inputCls} mt-1`} rows={type === 'mcq' ? 4 : 2} value={stem} onChange={(e) => setStem(e.target.value)} required />
      </label>

      {type === 'station' && (
        <div>
          <p className="mb-1 text-sm font-medium">Photo</p>
          <div
            onDragOver={(e) => { e.preventDefault(); setDrag(true) }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => { e.preventDefault(); setDrag(false); setPicked(e.dataTransfer.files?.[0]) }}
            className={`rounded-2xl border-2 border-dashed p-4 text-center text-sm ${drag ? 'border-brand-500 bg-brand-50' : 'border-stone-300'}`}
          >
            {shownImage ? (
              <img src={shownImage} alt="Preview" className="mx-auto max-h-64 rounded-xl" />
            ) : (
              <p className="text-stone-500">Press <kbd className="rounded border bg-stone-100 px-1">Ctrl</kbd>/<kbd className="rounded border bg-stone-100 px-1">⌘</kbd> + <kbd className="rounded border bg-stone-100 px-1">V</kbd> to paste a copied image or screenshot, or drop a file here.</p>
            )}
            <div className="mt-3 flex justify-center gap-2">
              <button type="button" className={btnGhost} onClick={() => inputRef.current?.click()}>Choose file</button>
              {preview && <button type="button" className={btnGhost} onClick={() => setAnnotating(true)}>Label image</button>}
              {shownImage && <button type="button" className={btnGhost} onClick={() => { setFile(null); setPreview(null); setRemoveImage(true) }}>Remove</button>}
            </div>
            <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => setPicked(e.target.files?.[0])} />
          </div>
        </div>
      )}

      {annotating && (
        <Modal title="Label the image" onClose={() => setAnnotating(false)} wide>
          <ImageAnnotator src={preview} onDone={onAnnotated} onCancel={() => setAnnotating(false)} />
        </Modal>
      )}

      {type === 'mcq' ? (
        <fieldset>
          <legend className="mb-1 text-sm font-medium">Options (tick the correct one)</legend>
          <div className="space-y-2">
            {options.map((o, i) => (
              <div key={i} className="flex items-center gap-2">
                <input type="radio" name="correct" className="h-5 w-5 accent-emerald-600" checked={correct === i} onChange={() => setCorrect(i)} aria-label={`Option ${LETTERS[i]} is correct`} />
                <span className="w-4 text-sm text-stone-400">{LETTERS[i]}</span>
                <input className={inputCls} value={o} onChange={(e) => setOptions(options.map((v, j) => (j === i ? e.target.value : v)))} />
              </div>
            ))}
          </div>
          {options.length < 8 && (
            <button type="button" className={`${btnGhost} mt-2`} onClick={() => setOptions([...options, ''])}>Add option</button>
          )}
        </fieldset>
      ) : (
        <div className="space-y-3">
          {parts.map((p, i) => (
            <div key={i} className="rounded-2xl border border-stone-200 p-3">
              <label className="block text-sm font-medium">
                Part {i + 1} question
                <input className={`${inputCls} mt-1`} value={p.prompt} onChange={(e) => setParts(parts.map((x, j) => (j === i ? { ...x, prompt: e.target.value } : x)))} />
              </label>
              <label className="mt-2 block text-sm font-medium">
                Accepted answers <span className="font-normal text-stone-400">(one per line, first is the model answer)</span>
                <textarea className={`${inputCls} mt-1`} rows={2} value={p.accepted} onChange={(e) => setParts(parts.map((x, j) => (j === i ? { ...x, accepted: e.target.value } : x)))} />
              </label>
            </div>
          ))}
        </div>
      )}

      <label className="block text-sm font-medium">
        Explanation <span className="font-normal text-stone-400">(shown after answering)</span>
        <textarea className={`${inputCls} mt-1`} rows={3} value={explanation} onChange={(e) => setExplanation(e.target.value)} />
      </label>

      <div className="flex flex-wrap items-center gap-4">
        <label className="text-sm font-medium">
          Difficulty
          <select className={`${inputCls} mt-1 !w-auto`} value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
            <option value="">Not set</option>
            <option value="1">Easier</option>
            <option value="2">Medium</option>
            <option value="3">Harder</option>
          </select>
        </label>
        {canPublish && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} /> Published (visible to students)
          </label>
        )}
      </div>
      {!canPublish && <p className="text-xs text-stone-500">Your questions are saved as drafts. An academic lead reviews them before they go live.</p>}

      <div className="flex gap-2">
        <button className={btnDark} disabled={busy}>{busy ? 'Saving…' : 'Save question'}</button>
        <button type="button" className={btnGhost} onClick={onCancel}>Cancel</button>
      </div>
    </form>
  )
}
