import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useSubjects } from '../lib/useSubjects'
import { buildTree, markLocks, addTotals, practisableIds, fetchAll } from '../lib/sections'
import { PageHeader, Notice, btnDark, btnGhost, inputCls, Empty } from '../components/ui'

export default function Practice() {
  const nav = useNavigate()
  const sub = useSubjects()
  const [subjects, setSubjects] = useState(new Set())
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

  // Question counts depend on which subjects (if any) are selected, so they're refetched on change.
  const subjectKey = [...subjects].sort().join(',')
  useEffect(() => {
    if (!sectionRows) return
    ;(async () => {
      try {
        const counts = await supabase.rpc('section_question_counts', { p_subjects: subjects.size ? [...subjects] : null })
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectionRows, progress, subjectKey])

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
    if (subjects.size) q.set('subject', [...subjects].join(','))
    nav(`/quiz?${q}`)
  }

  function toggleSubject(id) {
    setSubjects((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
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
    <div className="pb-32 sm:pb-28">
      <PageHeader title="Practise">Tick anything, a whole year, a module or one topic, then start. Numbers show questions you've answered out of what's available.</PageHeader>
      <Notice tone="error">{error}</Notice>
      {sub.rows.length > 0 && (
        <div className="mb-4 rounded-2xl border border-stone-200 bg-white p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium">Subject</span>
            {subjects.size > 0 && (
              <button onClick={() => setSubjects(new Set())} className="text-xs font-medium text-stone-400 hover:text-stone-600">Clear</button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {sub.rows.map((s) => {
              const on = subjects.has(s.id)
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => toggleSubject(s.id)}
                  aria-pressed={on}
                  className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${on ? 'border-brand-600 bg-brand-600 text-white' : 'border-stone-300 bg-white text-stone-600 hover:bg-stone-50'}`}
                >
                  {s.name}
                </button>
              )
            })}
          </div>
          {subjects.size === 0 && <p className="mt-2 text-xs text-stone-400">Any subject — pick one or more to narrow it down.</p>}
        </div>
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

      <div className="safe-bottom fixed inset-x-0 bottom-[3.9rem] z-20 rounded-t-2xl border-t border-stone-200 bg-white/95 px-4 pb-4 pt-3 shadow-[0_-8px_24px_-12px_rgba(0,0,0,0.15)] backdrop-blur sm:bottom-0 sm:rounded-none">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1 text-sm">
            <b>{selectedTotal}</b> question{selectedTotal === 1 ? '' : 's'} selected
            {picked.size > 0 && (
              <button onClick={() => setPicked(new Set())} className={`${btnGhost} ml-2`}>Clear</button>
            )}
          </div>
          <div className="flex w-full items-center gap-2 sm:w-auto">
            <input
              className={`${inputCls} !w-24`}
              inputMode="numeric"
              placeholder="How many?"
              value={limit}
              onChange={(e) => setLimit(e.target.value.replace(/\D/g, ''))}
              aria-label="Limit number of questions"
            />
            <button className={`${btnDark} flex-1 sm:flex-none`} disabled={!selectedTotal} onClick={start}>Start</button>
          </div>
        </div>
      </div>
    </div>
  )
}
