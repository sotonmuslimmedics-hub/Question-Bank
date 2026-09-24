import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useSubjects } from '../lib/useSubjects'
import { buildTree, markLocks, addTotals, practisableIds, fetchAll } from '../lib/sections'
import { PageHeader, Notice, btnDark, btnGhost, inputCls, Empty } from '../components/ui'

export default function Practice() {
  const nav = useNavigate()
  const sub = useSubjects()
  const [subject, setSubject] = useState('')
  const [sectionRows, setSectionRows] = useState(null)
  const [progress, setProgress] = useState({})
  const [tree, setTree] = useState(null)
  const [error, setError] = useState('')
  const [picked, setPicked] = useState(new Set())
  const [open, setOpen] = useState(new Set())
  const [limit, setLimit] = useState('')

  // Sections and the student's all-time progress only need loading once.
  useEffect(() => {
    ;(async () => {
      try {
        const [rows, prog] = await Promise.all([
          fetchAll(() => supabase.from('sections').select('id,parent_id,name,sort_order,is_locked,is_hidden').order('id')),
          supabase.rpc('my_section_progress'),
        ])
        setSectionRows(rows.filter((r) => !r.is_hidden))
        setProgress(Object.fromEntries((prog.data || []).map((r) => [r.section_id, Number(r.answered)])))
      } catch (e) {
        setError(e.message)
      }
    })()
  }, [])

  // Question counts depend on which subject (if any) is selected, so they're refetched on change.
  useEffect(() => {
    if (!sectionRows) return
    ;(async () => {
      try {
        const counts = await supabase.rpc('section_question_counts', { p_subject: subject || null })
        if (counts.error) throw counts.error
        const c = Object.fromEntries((counts.data || []).map((r) => [r.section_id, Number(r.question_count)]))
        const t = buildTree(sectionRows)
        markLocks(t.roots)
        // locked sections show "coming soon" and don't count towards the totals
        const openCounts = Object.fromEntries(Object.entries(c).filter(([id]) => !t.nodes.get(id)?.effectiveLocked))
        addTotals(t.roots, openCounts, progress)
        setTree(t)
        setOpen((prev) => (prev.size ? prev : new Set(t.roots.map((r) => r.id))))
        // a topic that no longer has questions in the chosen subject shouldn't stay selected
        setPicked((prev) => new Set([...prev].filter((id) => (t.nodes.get(id)?.ownCount || 0) > 0)))
      } catch (e) {
        setError(e.message)
      }
    })()
  }, [sectionRows, progress, subject])

  const selectedTotal = useMemo(() => {
    if (!tree) return 0
    let n = 0
    for (const id of picked) n += tree.nodes.get(id)?.ownCount || 0
    return n
  }, [picked, tree])

  function toggleNode(node) {
    const ids = practisableIds(node)
    if (!ids.length) return
    setPicked((prev) => {
      const next = new Set(prev)
      const all = ids.every((i) => next.has(i))
      ids.forEach((i) => (all ? next.delete(i) : next.add(i)))
      return next
    })
  }

  function start() {
    const q = new URLSearchParams({ s: [...picked].join(',') })
    if (Number(limit) > 0) q.set('n', String(Number(limit)))
    if (subject) q.set('subject', subject)
    nav(`/quiz?${q}`)
  }

  const toggleOpen = (id) =>
    setOpen((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  function Row({ node, depth }) {
    const ids = practisableIds(node)
    const selected = ids.length > 0 && ids.every((i) => picked.has(i))
    const some = !selected && ids.some((i) => picked.has(i))
    const hasKids = node.children.length > 0
    const locked = node.effectiveLocked
    return (
      <li>
        <div
          className={`flex items-center gap-2 rounded-xl px-2 py-2 ${selected ? 'bg-brand-50' : 'hover:bg-stone-50'}`}
          style={{ marginLeft: depth * 14 }}
        >
          {hasKids ? (
            <button onClick={() => toggleOpen(node.id)} className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-stone-400 hover:bg-stone-100" aria-label={open.has(node.id) ? 'Collapse' : 'Expand'}>
              {open.has(node.id) ? '▾' : '▸'}
            </button>
          ) : (
            <span className="w-7 shrink-0" />
          )}
          <input
            type="checkbox"
            className="h-5 w-5 shrink-0 accent-brand-600"
            checked={selected}
            ref={(el) => el && (el.indeterminate = some)}
            disabled={!ids.length}
            onChange={() => toggleNode(node)}
            aria-label={`Select ${node.name}`}
          />
          <button onClick={() => (hasKids ? toggleOpen(node.id) : toggleNode(node))} className="min-w-0 flex-1 text-left">
            <span className={`block truncate text-sm ${depth === 0 ? 'font-semibold' : ''} ${locked ? 'text-stone-400' : ''}`}>
              {locked && '🔒 '}
              {node.name}
            </span>
          </button>
          <span className="shrink-0 text-xs tabular-nums text-stone-400">
            {locked ? 'coming soon' : node.totalCount ? `${node.totalDone}/${node.totalCount}` : ''}
          </span>
        </div>
        {hasKids && open.has(node.id) && (
          <ul>
            {node.children.map((c) => (
              <Row key={c.id} node={c} depth={depth + 1} />
            ))}
          </ul>
        )}
      </li>
    )
  }

  return (
    <div className="pb-24">
      <PageHeader title="Practise">Tick anything, a whole year, a module or one topic, then start. Numbers show questions you've answered out of what's available.</PageHeader>
      <Notice tone="error">{error}</Notice>
      {sub.rows.length > 0 && (
        <label className="mb-3 block text-sm font-medium">
          Subject
          <select className={`${inputCls} mt-1 sm:!w-64`} value={subject} onChange={(e) => setSubject(e.target.value)}>
            <option value="">Any subject</option>
            {sub.rows.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>
      )}
      {!tree && !error && <p className="text-sm text-stone-400">Loading…</p>}
      {tree && tree.roots.length === 0 && <Empty>Nothing here yet.</Empty>}
      {tree && (
        <ul className="rounded-2xl border border-stone-200 bg-white p-2">
          {tree.roots.map((r) => (
            <Row key={r.id} node={r} depth={0} />
          ))}
        </ul>
      )}

      <div className="safe-bottom fixed inset-x-0 bottom-[3.9rem] z-20 border-t border-stone-200 bg-white/95 px-4 py-3 backdrop-blur sm:bottom-0">
        <div className="mx-auto flex max-w-6xl items-center gap-3">
          <div className="min-w-0 flex-1 text-sm">
            <b>{selectedTotal}</b> question{selectedTotal === 1 ? '' : 's'} selected
            {picked.size > 0 && (
              <button onClick={() => setPicked(new Set())} className={`${btnGhost} ml-2`}>Clear</button>
            )}
          </div>
          <input
            className={`${inputCls} !w-24`}
            inputMode="numeric"
            placeholder="How many?"
            value={limit}
            onChange={(e) => setLimit(e.target.value.replace(/\D/g, ''))}
            aria-label="Limit number of questions"
          />
          <button className={btnDark} disabled={!selectedTotal} onClick={start}>Start</button>
        </div>
      </div>
    </div>
  )
}
