import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { buildTree, fetchAll } from '../lib/sections'
import { PageHeader, Notice, Empty } from '../components/ui'

// How confident you feel with a topic, not how you're actually scoring (that's on Home).
const LEVELS = [
  [1, 'Low confidence', 'bg-red-400', 'ring-red-500'],
  [2, 'Getting there', 'bg-amber-400', 'ring-amber-500'],
  [3, 'Confident', 'bg-emerald-500', 'ring-emerald-600'],
]
const FILTERS = [['all', 'All'], [0, 'Not rated'], ...LEVELS.map(([v, l]) => [v, l])]

// Adds, to every node, how many leaf topics sit below it and how many of those are rated.
function addRatingTotals(roots, ratings) {
  for (const n of roots) {
    addRatingTotals(n.children, ratings)
    if (n.children.length === 0) {
      n.leafTotal = 1
      n.leafRated = ratings[n.id] ? 1 : 0
    } else {
      n.leafTotal = n.children.reduce((s, c) => s + c.leafTotal, 0)
      n.leafRated = n.children.reduce((s, c) => s + c.leafRated, 0)
    }
  }
}

// Whether a leaf under `node` matches the current filter (used to hide non-matching branches).
function matches(node, filter, ratings) {
  if (node.children.length === 0) return filter === 'all' || (ratings[node.id] || 0) === filter
  return node.children.some((c) => matches(c, filter, ratings))
}

// Students mark how confident they feel about each topic with a colour. Purely self-assessed and
// private to them, organised the same way as Practise: a collapsible year > module > topic tree.
export default function Tracker() {
  const [tree, setTree] = useState(null)
  const [ratings, setRatings] = useState({})
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('all')
  const [open, setOpen] = useState(new Set())

  useEffect(() => {
    ;(async () => {
      try {
        const [rows, r] = await Promise.all([
          fetchAll(() => supabase.from('sections').select('id,parent_id,name,sort_order,is_hidden')),
          supabase.from('topic_confidence').select('section_id,level'),
        ])
        if (r.error) throw r.error
        const t = buildTree(rows.filter((row) => !row.is_hidden))
        setTree(t)
        setOpen(new Set(t.roots.map((n) => n.id)))
        setRatings(Object.fromEntries((r.data || []).map((row) => [row.section_id, row.level])))
      } catch (e) {
        setError(e.message)
      }
    })()
  }, [])

  if (tree) addRatingTotals(tree.roots, ratings)

  const summary = useMemo(() => {
    const counts = { 0: 0, 1: 0, 2: 0, 3: 0 }
    for (const n of tree?.nodes.values() || []) {
      if (n.children.length === 0) counts[ratings[n.id] || 0]++
    }
    return counts
  }, [tree, ratings])

  const toggleOpen = (id) =>
    setOpen((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  async function setLevel(id, level) {
    const next = ratings[id] === level ? 0 : level // clicking the active colour again clears it
    setRatings((r) => ({ ...r, [id]: next }))
    const { error } = next
      ? await supabase.from('topic_confidence').upsert({ section_id: id, level: next, updated_at: new Date().toISOString() })
      : await supabase.from('topic_confidence').delete().eq('section_id', id)
    if (error) setError(error.message)
  }

  function Row({ node, depth }) {
    if (!matches(node, filter, ratings)) return null
    const hasKids = node.children.length > 0
    const isOpen = filter !== 'all' || open.has(node.id)
    const level = ratings[node.id] || 0
    return (
      <li>
        <div className="flex items-center gap-2 rounded-xl px-2 py-2 hover:bg-stone-50" style={{ marginLeft: depth * 14 }}>
          {hasKids ? (
            <button onClick={() => toggleOpen(node.id)} className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-stone-400 hover:bg-stone-100" aria-label={isOpen ? 'Collapse' : 'Expand'}>
              {isOpen ? '▾' : '▸'}
            </button>
          ) : (
            <span className="w-7 shrink-0" />
          )}
          <span className={`min-w-0 flex-1 truncate text-sm ${depth === 0 ? 'font-semibold' : ''}`}>{node.name}</span>
          {hasKids ? (
            <span className="shrink-0 text-xs tabular-nums text-stone-400">{node.leafRated}/{node.leafTotal} rated</span>
          ) : (
            <div className="flex shrink-0 items-center gap-2">
              {LEVELS.map(([v, label, bg, ring]) => (
                <button
                  key={v}
                  onClick={() => setLevel(node.id, v)}
                  aria-label={label}
                  aria-pressed={level === v}
                  title={label}
                  className={`h-7 w-7 rounded-full border-2 transition ${level === v ? `${bg} ${ring} border-transparent ring-2 ring-offset-2` : 'border-stone-300 bg-white hover:border-stone-400'}`}
                />
              ))}
            </div>
          )}
        </div>
        {hasKids && isOpen && <ul>{node.children.map((c) => <Row key={c.id} node={c} depth={depth + 1} />)}</ul>}
      </li>
    )
  }

  return (
    <div>
      <PageHeader title="Topic tracker">Mark how confident you're feeling about each topic. Only you can see this.</PageHeader>
      <Notice tone="error" onClose={() => setError('')}>{error}</Notice>

      <div className="mb-3 flex flex-wrap items-center gap-4">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map(([v, l]) => (
            <button key={v} onClick={() => setFilter(v)} className={`rounded-full border px-3 py-1 text-xs font-medium ${filter === v ? 'border-stone-900 bg-stone-900 text-white' : 'border-stone-300 bg-white'}`}>{l}</button>
          ))}
        </div>
        <div className="ml-auto flex gap-3 text-xs text-stone-500">
          <span>{summary[3]} confident</span>
          <span>{summary[2]} getting there</span>
          <span>{summary[1]} low</span>
          <span>{summary[0]} not rated</span>
        </div>
      </div>

      {!tree && !error && <p className="text-sm text-stone-400">Loading…</p>}
      {tree && tree.roots.length === 0 && <Empty>Nothing here yet.</Empty>}
      {tree && (
        <ul className="rounded-2xl border border-stone-200 bg-white p-2">
          {tree.roots.map((r) => <Row key={r.id} node={r} depth={0} />)}
        </ul>
      )}
    </div>
  )
}
