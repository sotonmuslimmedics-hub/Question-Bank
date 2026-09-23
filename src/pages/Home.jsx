import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'

export default function Home() {
  const { profile, user } = useAuth()
  const [stats, setStats] = useState(null)

  useEffect(() => {
    Promise.all([
      supabase.from('attempts').select('is_correct,question_id'),
      supabase.from('part_attempts').select('is_correct,part_id'),
    ]).then(([a, p]) => {
      const mcq = a.data || []
      const parts = p.data || []
      const total = mcq.length + parts.length
      const correct = mcq.filter((r) => r.is_correct).length + parts.filter((r) => r.is_correct).length
      const unique = new Set(mcq.map((r) => r.question_id)).size + new Set(parts.map((r) => r.part_id)).size
      setStats({
        total,
        answered: unique,
        accuracy: total ? Math.round((correct / total) * 100) : null,
      })
    })
  }, [])

  const first = (profile?.full_name || user?.email || '').split(/[ @]/)[0]

  return (
    <div>
      <h1 className="text-2xl font-bold">Welcome{first ? `, ${first}` : ''}</h1>
      <p className="mt-1 text-slate-500">Practise questions by module and week, with instant marking and explanations.</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Stat label="Answers submitted" value={stats ? stats.total : '–'} />
        <Stat label="Unique items answered" value={stats ? stats.answered : '–'} />
        <Stat label="Accuracy" value={stats?.accuracy != null ? `${stats.accuracy}%` : '–'} />
      </div>

      <Link to="/banks" className="mt-8 inline-block rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700">
        Browse question banks
      </Link>
    </div>
  )
}

function Stat({ label, value }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs text-slate-500">{label}</div>
    </div>
  )
}
