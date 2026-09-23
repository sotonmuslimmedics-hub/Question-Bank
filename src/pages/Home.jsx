import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'

export default function Home() {
  const { profile, user } = useAuth()
  const [stats, setStats] = useState(null)

  useEffect(() => {
    supabase
      .from('attempts')
      .select('is_correct,question_id')
      .then(({ data }) => {
        const rows = data || []
        const answered = new Set(rows.map((r) => r.question_id)).size
        const correct = rows.filter((r) => r.is_correct).length
        setStats({
          total: rows.length,
          answered,
          accuracy: rows.length ? Math.round((correct / rows.length) * 100) : null,
        })
      })
  }, [])

  const first = (profile?.full_name || user?.email || '').split(/[ @]/)[0]

  return (
    <div>
      <h1 className="text-2xl font-bold">Welcome{first ? `, ${first}` : ''}</h1>
      <p className="mt-1 text-slate-500">Practise questions by module and week, with instant marking and explanations.</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Stat label="Questions answered" value={stats ? stats.total : '–'} />
        <Stat label="Unique questions" value={stats ? stats.answered : '–'} />
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
