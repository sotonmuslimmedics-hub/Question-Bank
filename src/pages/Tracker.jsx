import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useSections } from '../lib/useSections'
import { PageHeader, Notice, Empty } from '../components/ui'

// How confident you feel with a topic, not how you're actually scoring (that's on Home).
const LEVELS = [
  [1, 'Low confidence', 'bg-red-400', 'ring-red-500'],
  [2, 'Getting there', 'bg-amber-400', 'ring-amber-500'],
  [3, 'Confident', 'bg-emerald-500', 'ring-emerald-600'],
]
const FILTERS = [['all', 'All'], [0, 'Not rated'], ...LEVELS.map(([v, l]) => [v, l])]

// Students mark how confident they feel about each topic with a colour. Purely self-assessed and
// private to them — separate from the leads' content-readiness view at /coverage.
export default function Tracker() {
  const sec = useSections()
  const [ratings, setRatings] = useState({})
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('all')

  async function load() {
    const { data, error } = await supabase.from('topic_confidence').select('section_id,level')
    if (error) return setError(error.message)
    setRatings(Object.fromEntries((data || []).map((r) => [r.section_id, r.level])))
  }
  useEffect(() => { load() }, [])

  // Only the lowest level (sections with no children) are topics worth rating.
  const topics = useMemo(() => sec.flat.filter((s) => s.node.children.length === 0 && !s.node.is_hidden), [sec.flat])
  const shown = topics.filter((t) => filter === 'all' || (ratings[t.id] || 0) === filter)

  const summary = useMemo(() => {
    const counts = { 0: 0, 1: 0, 2: 0, 3: 0 }
    topics.forEach((t) => { counts[ratings[t.id] || 0]++ })
    return counts
  }, [topics, ratings])

  async function setLevel(id, level) {
    const next = ratings[id] === level ? 0 : level // clicking the active colour again clears it
    setRatings((r) => ({ ...r, [id]: next }))
    const { error } = next
      ? await supabase.from('topic_confidence').upsert({ section_id: id, level: next, updated_at: new Date().toISOString() })
      : await supabase.from('topic_confidence').delete().eq('section_id', id)
    if (error) { setError(error.message); load() }
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

      {sec.loading && <p className="text-sm text-stone-400">Loading…</p>}
      {!sec.loading && !shown.length && <Empty>No topics match.</Empty>}

      <div className="divide-y divide-stone-100 rounded-2xl border border-stone-200 bg-white">
        {shown.map((t) => {
          const level = ratings[t.id] || 0
          return (
            <div key={t.id} className="flex items-center justify-between gap-3 p-3">
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{t.name}</span>
                <span className="block truncate text-xs text-stone-400">{t.path.slice(0, -1).join(' › ')}</span>
              </span>
              <div className="flex shrink-0 items-center gap-2">
                {LEVELS.map(([v, label, bg, ring]) => (
                  <button
                    key={v}
                    onClick={() => setLevel(t.id, v)}
                    aria-label={label}
                    aria-pressed={level === v}
                    title={label}
                    className={`h-7 w-7 rounded-full border-2 transition ${level === v ? `${bg} ${ring} border-transparent ring-2 ring-offset-2` : 'border-stone-300 bg-white hover:border-stone-400'}`}
                  />
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
