import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { useSections } from '../lib/useSections'
import { PageHeader, Notice, Pill, inputCls, btnGhost } from '../components/ui'

const STATUS = [
  ['not_started', 'Not started', 'stone'],
  ['in_progress', 'In progress', 'amber'],
  ['needs_review', 'Needs review', 'brand'],
  ['complete', 'Complete', 'green'],
]

// Which topics have questions, and who is on them. Everyone on the teaching side reads it; leads and admins edit it.
export default function Tracker() {
  const { isLead, user } = useAuth()
  const sec = useSections()
  const [track, setTrack] = useState({})
  const [stats, setStats] = useState({})
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('all')
  const [open, setOpen] = useState(null)

  async function load() {
    const [t, s] = await Promise.all([supabase.from('topic_tracker').select('*'), supabase.rpc('section_question_stats')])
    if (t.error) setError(t.error.message)
    setTrack(Object.fromEntries((t.data || []).map((r) => [r.section_id, r])))
    setStats(Object.fromEntries((s.data || []).map((r) => [r.section_id, { published: Number(r.published), draft: Number(r.draft) }])))
  }
  useEffect(() => { load() }, [])

  // Only the lowest level (sections with no children) are "topics" worth tracking.
  const topics = useMemo(() => sec.flat.filter((s) => s.node.children.length === 0 && !s.node.is_hidden), [sec.flat])
  const shown = topics.filter((t) => filter === 'all' || (track[t.id]?.status || 'not_started') === filter)

  async function save(id, patch) {
    const cur = track[id] || { status: 'not_started', assignee: null, notes: null }
    const row = { section_id: id, status: cur.status, assignee: cur.assignee, notes: cur.notes, ...patch, updated_by: user.id, updated_at: new Date().toISOString() }
    setTrack((t) => ({ ...t, [id]: row }))
    const { error } = await supabase.from('topic_tracker').upsert(row)
    if (error) { setError(error.message); load() }
  }

  return (
    <div>
      <PageHeader title="Topic tracker">
        {isLead ? 'Set the status of each topic, who is covering it, and leave notes.' : 'See which topics need questions and who is working on them.'}
      </PageHeader>
      <Notice tone="error" onClose={() => setError('')}>{error}</Notice>

      <div className="mb-3 flex flex-wrap gap-2">
        {[['all', 'All'], ...STATUS.map(([v, l]) => [v, l])].map(([v, l]) => (
          <button key={v} onClick={() => setFilter(v)} className={`rounded-full border px-3 py-1 text-xs font-medium ${filter === v ? 'border-stone-900 bg-stone-900 text-white' : 'border-stone-300 bg-white'}`}>{l}</button>
        ))}
      </div>

      <div className="divide-y divide-stone-100 rounded-2xl border border-stone-200 bg-white">
        {shown.map((t) => {
          const r = track[t.id]
          const st = STATUS.find((s) => s[0] === (r?.status || 'not_started'))
          const c = stats[t.id] || { published: 0, draft: 0 }
          const isOpen = open === t.id
          return (
            <div key={t.id} className="p-3">
              <button className="flex w-full items-center justify-between gap-3 text-left" onClick={() => setOpen(isOpen ? null : t.id)}>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{t.name}</span>
                  <span className="block truncate text-xs text-stone-400">{t.path.slice(0, -1).join(' › ')}</span>
                </span>
                <span className="flex shrink-0 items-center gap-2 text-xs text-stone-500">
                  {c.published} live{c.draft > 0 && ` · ${c.draft} draft`}
                  <Pill tone={st[2]}>{st[1]}</Pill>
                </span>
              </button>
              {isOpen && (
                <div className="mt-3 space-y-2">
                  {isLead ? (
                    <>
                      <select className={inputCls} value={r?.status || 'not_started'} onChange={(e) => save(t.id, { status: e.target.value })}>
                        {STATUS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                      </select>
                      <input className={inputCls} placeholder="Who is covering it?" defaultValue={r?.assignee || ''} onBlur={(e) => e.target.value !== (r?.assignee || '') && save(t.id, { assignee: e.target.value.trim() || null })} />
                      <textarea className={inputCls} rows={2} placeholder="Notes" defaultValue={r?.notes || ''} onBlur={(e) => e.target.value !== (r?.notes || '') && save(t.id, { notes: e.target.value.trim() || null })} />
                    </>
                  ) : (
                    <div className="text-sm text-stone-600">
                      <p>Covered by: {r?.assignee || 'nobody yet'}</p>
                      {r?.notes && <p className="mt-1 whitespace-pre-wrap">{r.notes}</p>}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
        {!shown.length && <p className="p-6 text-center text-sm text-stone-400">No topics match.</p>}
      </div>
    </div>
  )
}
