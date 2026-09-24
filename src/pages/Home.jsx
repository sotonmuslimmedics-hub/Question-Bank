import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { SITE_TAGLINE } from '../config'
import { btnDark, card, Pill } from '../components/ui'
import { fmtDate } from './Announcements'

// What this site does that other banks don't. Only claims that are true of this build.
const FEATURES = [
  { t: 'Photo stations', d: 'Practical questions with an image and two short typed answers, marked instantly.' },
  { t: 'Practise by topic', d: 'Pick any level of the syllabus, from a whole year down to a single topic.' },
  { t: 'Near-peer teachers', d: 'Student teachers write questions, which are reviewed by academic leads before going live.' },
  { t: 'Teaching slides', d: 'Turn questions into PowerPoint teaching slides in one click.' },
  { t: 'Built for phones', d: 'Designed thumb-first, so revision works on the bus as well as at a desk.' },
  { t: 'Yours to reshape', d: 'Committees can rename modules and restructure topics without a developer.' },
]

export default function Home() {
  const { profile, user } = useAuth()
  const [stats, setStats] = useState(null)
  const [news, setNews] = useState([])

  useEffect(() => {
    ;(async () => {
      const [a, p, n] = await Promise.all([
        supabase.from('attempts').select('is_correct', { count: 'exact' }).eq('user_id', user.id).limit(5000),
        supabase.from('part_attempts').select('is_correct', { count: 'exact' }).eq('user_id', user.id).limit(5000),
        supabase.from('announcements').select('id,title,body,pinned,created_at').order('pinned', { ascending: false }).order('created_at', { ascending: false }).limit(3),
      ])
      const rows = [...(a.data || []), ...(p.data || [])]
      setStats({ done: rows.length, correct: rows.filter((r) => r.is_correct).length })
      setNews(n.data || [])
    })()
  }, [user.id])

  const first = (profile?.full_name || '').split(' ')[0]
  const pct = stats?.done ? Math.round((stats.correct / stats.done) * 100) : null

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

      <section>
        <h2 className="mb-2 font-semibold">What's different here</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.t} className={card}>
              <b className="text-sm">{f.t}</b>
              <p className="mt-1 text-sm text-stone-600">{f.d}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
