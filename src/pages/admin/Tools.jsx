import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useSections } from '../../lib/useSections'
import { fetchAll } from '../../lib/sections'
import { normalise } from '../../lib/answers'
import { parseMcq, parsePractical, MCQ_TEMPLATE, PRACTICAL_TEMPLATE } from '../../lib/importers'
import { PageHeader, Notice, inputCls, btnDark, btnGhost, btnDanger, card } from '../../components/ui'

function download(name, text, type = 'text/csv') {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([text], { type }))
  a.download = name
  a.click()
  URL.revokeObjectURL(a.href)
}
const cell = (v) => {
  let s = String(v ?? '')
  // Neutralise leading =, +, -, @, tab or CR so Excel/Sheets can't run a formula from
  // question text a student teacher wrote (CSV formula injection).
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export default function Tools() {
  const sec = useSections()
  return (
    <div className="space-y-5">
      <PageHeader title="Tools">Bring in questions from spreadsheets, back up your data, and tidy storage.</PageHeader>
      <Importer kind="mcq" sec={sec} />
      <Importer kind="practical" sec={sec} />
      <Backup sec={sec} />
      <Orphans />
    </div>
  )
}

function Importer({ kind, sec }) {
  const isMcq = kind === 'mcq'
  const [root, setRoot] = useState('')
  const [parsed, setParsed] = useState(null)
  const [msg, setMsg] = useState({ text: '', tone: 'ok' })
  const [busy, setBusy] = useState(false)
  const [publish, setPublish] = useState(false)

  async function onFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const text = await file.text()
      setParsed((isMcq ? parseMcq : parsePractical)(text))
      setMsg({ text: '', tone: 'ok' })
    } catch (err) {
      setParsed(null)
      setMsg({ text: err.message, tone: 'error' })
    }
    e.target.value = ''
  }

  // Finds each path under the chosen root, creating anything missing (new sections start locked).
  async function resolvePaths(paths) {
    const cache = new Map()
    let created = 0
    const rows = await fetchAll(() => supabase.from('sections').select('id,parent_id,name').order('id'))
    const kids = new Map()
    rows.forEach((r) => {
      const k = r.parent_id || 'root'
      if (!kids.has(k)) kids.set(k, [])
      kids.get(k).push(r)
    })
    for (const path of paths) {
      const key = path.join('\u0001')
      if (cache.has(key)) continue
      let parent = root || null
      for (const name of path) {
        const k = parent || 'root'
        let hit = (kids.get(k) || []).find((s) => normalise(s.name) === normalise(name))
        if (!hit) {
          const { data, error } = await supabase
            .from('sections')
            .insert({ name, parent_id: parent, sort_order: (kids.get(k) || []).length, is_locked: true })
            .select('id,parent_id,name')
            .single()
          if (error) throw error
          hit = data
          created++
          kids.set(k, [...(kids.get(k) || []), hit])
        }
        parent = hit.id
      }
      if (!parent) throw new Error('A row has no year/module/topic and no destination section is chosen.')
      cache.set(key, parent)
    }
    return { cache, created }
  }

  async function run() {
    setBusy(true)
    try {
      const { rows } = parsed
      const uniquePaths = [...new Map(rows.map((r) => [r.path.join('\u0001'), r.path])).values()]
      const { cache, created } = await resolvePaths(uniquePaths)

      // skip anything already in the bank for the same section
      const existing = await fetchAll(() => supabase.from('questions').select('stem,section_id').order('id'))
      const have = new Set(existing.map((q) => normalise(q.stem) + '|' + q.section_id))
      const todo = rows
        .map((r) => ({ ...r, section_id: cache.get(r.path.join('\u0001')) }))
        .filter((r) => !have.has(normalise(r.stem) + '|' + r.section_id))
      const skipped = rows.length - todo.length

      let added = 0
      for (let i = 0; i < todo.length; i += 100) {
        const chunk = todo.slice(i, i + 100)
        const payload = chunk.map((r) => ({
          section_id: r.section_id,
          question_type: isMcq ? 'mcq' : 'station',
          stem: r.stem,
          options: isMcq ? r.options : null,
          correct_option: isMcq ? r.correct_option : null,
          explanation: r.explanation,
          difficulty: r.difficulty,
          author_name: r.author_name,
          source_url: isMcq ? null : r.source_url,
          // photo questions can't go live until a photo is attached
          is_published: isMcq && (publish || r.published),
        }))
        const { data, error } = await supabase.from('questions').insert(payload).select('id')
        if (error) throw error
        added += data.length
        if (!isMcq) {
          const parts = data.flatMap((d, k) => chunk[k].parts.map((p, n) => ({ question_id: d.id, part_number: n + 1, prompt: p.prompt, accepted_answers: p.accepted_answers })))
          const { error: pe } = await supabase.from('question_parts').insert(parts)
          if (pe) throw pe
        }
      }
      setMsg({
        text: `Imported ${added} question${added === 1 ? '' : 's'}${skipped ? `, skipped ${skipped} already in the bank` : ''}${created ? `, created ${created} new section${created === 1 ? '' : 's'} (locked)` : ''}.${isMcq && !publish ? ' They are drafts: review and publish in Questions.' : ''}${!isMcq ? ' Open each one in Questions to paste in its photo, then publish.' : ''}`,
        tone: 'ok',
      })
      setParsed(null)
      sec.reload()
    } catch (err) {
      setMsg({ text: err.message, tone: 'error' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className={card}>
      <h2 className="font-semibold">{isMcq ? 'Import MCQs from a spreadsheet' : 'Import photo-station questions from a spreadsheet'}</h2>
      <p className="mt-1 text-sm text-stone-500">
        {isMcq
          ? 'Save your sheet as CSV. Columns: year, module, topic, subtopic (any you use), question, a to e, correct (a letter), explanation.'
          : 'Save your sheet as CSV. Columns: year, module, topic, subtopic, prompt, q1, a1, q2, a2, image_url, explanation. Separate several accepted answers with ";". The image link is kept for reference; photos are added afterwards by pasting them in.'}
      </p>
      <Notice tone={msg.tone}>{msg.text}</Notice>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <select className={`${inputCls} w-full sm:!w-auto sm:max-w-xs`} value={root} onChange={(e) => setRoot(e.target.value)}>
          <option value="">Import into the top level</option>
          {sec.flat.map((s) => <option key={s.id} value={s.id}>Under: {s.pathLabel}</option>)}
        </select>
        <input type="file" accept=".csv,text/csv" onChange={onFile} className="text-sm" />
        <button className={btnGhost} onClick={() => download(isMcq ? 'mcq-template.csv' : 'practical-template.csv', isMcq ? MCQ_TEMPLATE : PRACTICAL_TEMPLATE)}>Template</button>
      </div>
      {parsed && (
        <div className="mt-3 rounded-xl bg-stone-50 p-3 text-sm">
          <p><b>{parsed.rows.length}</b> question{parsed.rows.length === 1 ? '' : 's'} ready{parsed.dupes ? `, ${parsed.dupes} duplicate${parsed.dupes === 1 ? '' : 's'} in the file removed` : ''}.</p>
          {parsed.errors.length > 0 && (
            <details className="mt-1 text-red-700">
              <summary>{parsed.errors.length} row{parsed.errors.length === 1 ? '' : 's'} skipped</summary>
              <ul className="mt-1 list-disc pl-5">{parsed.errors.slice(0, 50).map((e) => <li key={e}>{e}</li>)}</ul>
            </details>
          )}
          {isMcq && (
            <label className="mt-2 flex items-center gap-2">
              <input type="checkbox" checked={publish} onChange={(e) => setPublish(e.target.checked)} /> Publish straight away (otherwise they arrive as drafts)
            </label>
          )}
          <button className={`${btnDark} mt-3`} disabled={busy || !parsed.rows.length} onClick={run}>{busy ? 'Importing…' : 'Import'}</button>
        </div>
      )}
    </section>
  )
}

function Backup({ sec }) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  async function exportAll() {
    setBusy(true)
    setErr('')
    try {
      const rows = await fetchAll(() =>
        supabase.from('questions').select('id,section_id,question_type,stem,options,correct_option,explanation,difficulty,author_name,is_published,image_path,question_parts(part_number,prompt,accepted_answers)').order('id'),
      )
      const head = ['type', 'path', 'question', 'a', 'b', 'c', 'd', 'e', 'correct', 'q1', 'a1', 'q2', 'a2', 'explanation', 'difficulty', 'author', 'status', 'image']
      const lines = rows.map((q) => {
        const o = q.options || []
        const p = [...(q.question_parts || [])].sort((a, b) => a.part_number - b.part_number)
        const path = sec.nodes.get(q.section_id) ? sec.flat.find((s) => s.id === q.section_id)?.pathLabel : ''
        return [
          q.question_type, path, q.stem, o[0], o[1], o[2], o[3], o[4],
          q.correct_option != null ? 'ABCDEFGH'[q.correct_option] : '',
          p[0]?.prompt, (p[0]?.accepted_answers || []).join('; '), p[1]?.prompt, (p[1]?.accepted_answers || []).join('; '),
          q.explanation, q.difficulty, q.author_name, q.is_published ? 'published' : 'draft', q.image_path,
        ].map(cell).join(',')
      })
      download(`question-bank-backup-${new Date().toISOString().slice(0, 10)}.csv`, [head.join(','), ...lines].join('\n'))
    } catch (e) {
      setErr(e.message)
    }
    setBusy(false)
  }
  return (
    <section className={card}>
      <h2 className="font-semibold">Back up questions</h2>
      <p className="mt-1 text-sm text-stone-500">The free Supabase plan has no automatic backups, so download this now and then. Photos live in storage and are not included; their file names are.</p>
      <Notice tone="error">{err}</Notice>
      <button className={`${btnGhost} mt-3`} disabled={busy} onClick={exportAll}>{busy ? 'Preparing…' : 'Download CSV'}</button>
    </section>
  )
}

// Photos whose question no longer exists (e.g. left behind by a failed upload).
function Orphans() {
  const [orphans, setOrphans] = useState(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState({ text: '', tone: 'ok' })
  const BUCKET = 'question-images'

  async function scan() {
    setBusy(true)
    setMsg({ text: '', tone: 'ok' })
    try {
      const files = []
      for (let offset = 0; ; offset += 1000) {
        const { data, error } = await supabase.storage.from(BUCKET).list('questions', { limit: 1000, offset })
        if (error) throw error
        files.push(...data.filter((f) => f.name && f.id))
        if (data.length < 1000) break
      }
      const used = new Set((await fetchAll(() => supabase.from('questions').select('image_path').not('image_path', 'is', null).order('id'))).map((q) => q.image_path))
      const list = files.map((f) => ({ path: `questions/${f.name}`, size: f.metadata?.size || 0 })).filter((f) => !used.has(f.path))
      setOrphans(list)
      if (!list.length) setMsg({ text: `Checked ${files.length} photos. None are orphaned.`, tone: 'ok' })
    } catch (e) {
      setMsg({ text: e.message, tone: 'error' })
    }
    setBusy(false)
  }

  async function clean() {
    setBusy(true)
    const { error } = await supabase.storage.from(BUCKET).remove(orphans.map((o) => o.path))
    setMsg(error ? { text: error.message, tone: 'error' } : { text: `Removed ${orphans.length} unused photo${orphans.length === 1 ? '' : 's'}.`, tone: 'ok' })
    setOrphans(null)
    setBusy(false)
  }

  const mb = orphans ? (orphans.reduce((s, o) => s + o.size, 0) / 1048576).toFixed(1) : 0
  return (
    <section className={card}>
      <h2 className="font-semibold">Unused photos</h2>
      <p className="mt-1 text-sm text-stone-500">Deleting a question removes its photo automatically. This finds any that slipped through (for example after an interrupted upload).</p>
      <Notice tone={msg.tone}>{msg.text}</Notice>
      <div className="mt-3 flex items-center gap-2">
        <button className={btnGhost} disabled={busy} onClick={scan}>{busy ? 'Working…' : 'Scan'}</button>
        {orphans?.length > 0 && (
          <>
            <span className="text-sm">{orphans.length} unused ({mb} MB)</span>
            <button className={btnDanger} disabled={busy} onClick={clean}>Delete them</button>
          </>
        )}
      </div>
    </section>
  )
}
