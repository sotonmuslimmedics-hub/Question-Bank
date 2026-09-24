import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { buildTree, pathOf, fetchAll } from '../lib/sections'
import { SITE_TAGLINE } from '../config'
import { card, Pill } from '../components/ui'
import { fmtDate } from './Announcements'

// A topic needs at least this many attempts before it counts towards strongest/weakest,
// so one lucky or unlucky guess doesn't dominate the list.
const MIN_ATTEMPTS = 3

function band(pct) {
  if (pct >= 80) return 'green'
  if (pct >= 50) return 'amber'
  return 'red'
}

export default function Home() {
  const { profile, user } = useAuth()
  const [stats, setStats] = useState(null)
  const [news, setNews] = useState([])
  const [topics, setTopics] = useState(null)

  useEffect(() => {
    ;(async () => {
      const [a, p, n, perf, secs] = await Promise.all([
        supabase.from('attempts').select('is_correct', { count: 'exact' }).eq('user_id', user.id).limit(5000),
        supabase.from('part_attempts').select('is_correct', { count: 'exact' }).eq('user_id', user.id).limit(5000),
        supabase.from('announcements').select('id,title,body,pinned,created_at').order('pinned', { ascending: false }).order('created_at', { ascending: false }).limit(3),
        supabase.rpc('my_topic_performance'),
        fetchAll(() => supabase.from('sections').select('id,parent_id,name,sort_order')),
      ])
      const rows = [...(a.data || []), ...(p.data || [])]
      setStats({ done: rows.length, correct: rows.filter((r) => r.is_correct).length })
      setNews(n.data || [])

      const { nodes } = buildTree(secs)
      const ranked = (perf.data || [])
        .map((r) => ({
          id: r.section_id,
          path: pathOf(nodes, r.section_id) || 'Unknown topic',
          attempted: Number(r.attempted),
          correct: Number(r.correct),
          pct: Math.round((Number(r.correct) / Number(r.attempted)) * 100),
        }))
        .sort((x, y) => y.pct - x.pct)
      setTopics(ranked)
    })()
  }, [user.id])

  const first = (profile?.full_name || '').split(' ')[0]
  const pct = stats?.done ? Math.round((stats.correct / stats.done) * 100) : null
  const ranked = (topics || []).filter((t) => t.attempted >= MIN_ATTEMPTS)
  const strongest = ranked.slice(0, 3)
  const weakest = ranked.slice(-3).reverse().filter((t) => !strongest.includes(t))

  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-stone-900 p-6 text-white sm:p-8">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{first ? `Hi ${first}` : 'Welcome'}</h1>
        <p className="mt-1 max-w-xl text-sm text-stone-300">{SITE_TAGLINE}</p>
        <div className="mt-5 flex flex-wrap items-center gap-4">
          <Link to="/practice" className="inline-flex rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-stone-900">Start practising</Link>
          {stats && (
            <span className="text-sm text-stone-300">
              {stats.done} answered{pct !== null && <> · <b className="text-white">{pct}%</b> correct</>}
            </span>
          )}
        </div>
      </section>

      <section>
        <h2 className="mb-2 font-semibold">Your marks breakdown</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className={card}>
            <span className="text-xs uppercase tracking-wide text-stone-400">Answered</span>
            <p className="mt-1 text-2xl font-bold">{stats?.done ?? '–'}</p>
          </div>
          <div className={card}>
            <span className="text-xs uppercase tracking-wide text-stone-400">Correct</span>
            <p className="mt-1 text-2xl font-bold">{stats?.correct ?? '–'}</p>
          </div>
          <div className={card}>
            <span className="text-xs uppercase tracking-wide text-stone-400">Accuracy</span>
            <p className="mt-1 text-2xl font-bold">{pct !== null ? `${pct}%` : '–'}</p>
          </div>
        </div>

        {stats && stats.done === 0 ? (
          <p className="mt-3 text-sm text-stone-400">
            You haven't answered any questions yet. <Link to="/practice" className="font-medium text-brand-700">Start practising</Link> to see your breakdown here.
          </p>
        ) : ranked.length === 0 ? (
          <p className="mt-3 text-sm text-stone-400">Answer at least {MIN_ATTEMPTS} questions in a topic to see it broken down here.</p>
        ) : (
          <>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className={card}>
                <b className="text-sm">Strongest topics</b>
                <ul className="mt-2 space-y-1.5">
                  {strongest.map((t) => (
                    <li key={t.id} className="flex items-center justify-between gap-2 text-sm">
                      <span className="truncate text-stone-600">{t.path}</span>
                      <Pill tone="green">{t.pct}%</Pill>
                    </li>
                  ))}
                </ul>
              </div>
              <div className={card}>
                <b className="text-sm">Weakest topics</b>
                {weakest.length === 0 ? (
                  <p className="mt-2 text-sm text-stone-400">Not enough topics attempted yet.</p>
                ) : (
                  <ul className="mt-2 space-y-1.5">
                    {weakest.map((t) => (
                      <li key={t.id} className="flex items-center justify-between gap-2 text-sm">
                        <span className="truncate text-stone-600">{t.path}</span>
                        <Pill tone="red">{t.pct}%</Pill>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div className={`${card} mt-3`}>
              <b className="text-sm">Every topic you've tried</b>
              <div className="mt-2 divide-y divide-stone-100">
                {ranked.map((t) => (
                  <div key={t.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <span className="min-w-0 truncate text-stone-600">{t.path}</span>
                    <span className="flex shrink-0 items-center gap-2">
                      <span className="text-xs text-stone-400">{t.correct}/{t.attempted}</span>
                      <Pill tone={band(t.pct)}>{t.pct}%</Pill>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </section>

      {news.length > 0 && (
        <section>
          <div className="mb-2 flex items-baseline justify-between">
            <h2 className="font-semibold">Latest news</h2>
            <Link to="/announcements" className="text-sm text-brand-700">All news</Link>
          </div>
          <div className="space-y-2">
            {news.map((a) => (
              <div key={a.id} className={card}>
                <div className="flex items-center justify-between gap-2">
                  <b className="text-sm">{a.title}</b>
                  <span className="flex items-center gap-2">{a.pinned && <Pill tone="brand">Pinned</Pill>}<span className="text-xs text-stone-400">{fmtDate(a.created_at)}</span></span>
                </div>
                <p className="mt-1 line-clamp-2 text-sm text-stone-600">{a.body}</p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
