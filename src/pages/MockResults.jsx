import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { imageUrl } from '../lib/images'
import { LETTERS, barColour, fmtClock, fmtDuration } from '../lib/mock'
import { Notice, Pill, card, btnDark } from '../components/ui'

// Score, topic breakdown and a full review (with explanations) of one finished sitting.
export default function MockResults() {
  const { attemptId } = useParams()
  const nav = useNavigate()
  const [res, setRes] = useState(null)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    supabase.rpc('mock_results', { p_attempt: attemptId }).then(({ data, error: err }) => {
      if (err) {
        // opened a sitting that is still running: send them back to it
        if (/submit the paper first/i.test(err.message)) return nav(`/mocks/${attemptId}`, { replace: true })
        return setError(err.message)
      }
      setRes(data)
    })
  }, [attemptId, nav])

  const counts = useMemo(() => {
    const qs = res?.questions || []
    return {
      all: qs.length,
      wrong: qs.filter((q) => q.selected != null && !q.is_correct).length,
      blank: qs.filter((q) => q.selected == null).length,
      flagged: qs.filter((q) => q.flagged).length,
    }
  }, [res])

  if (error) {
    return (
      <div className="mx-auto max-w-2xl">
        <Notice tone="error">{error}</Notice>
        <Link to="/mocks" className="text-sm font-medium text-brand-600 underline">← Back to mock exams</Link>
      </div>
    )
  }
  if (!res) return <p className="p-8 text-center text-sm text-stone-400">Loading…</p>

  const shown = res.questions
    .map((q, i) => ({ ...q, number: i + 1 }))
    .filter((q) => filter === 'all' || (filter === 'wrong' && q.selected != null && !q.is_correct) || (filter === 'blank' && q.selected == null) || (filter === 'flagged' && q.flagged))
  const subjects = [...res.by_subject].map((s) => ({ ...s, pct: s.total ? Math.round((100 * s.correct) / s.total) : 0 })).sort((x, y) => x.pct - y.pct)

  return (
    <div className="mx-auto max-w-2xl pb-8">
      <div className="mb-1 text-sm text-stone-400">
        <Link to="/mocks" className="hover:text-stone-600">← Mock exams</Link>
      </div>
      <h1 className="text-2xl font-bold tracking-tight">{res.paper.title}</h1>
      <p className="text-sm text-stone-500">Attempt {res.attempt_no} · {fmtClock(res.seconds_used)} used of {fmtDuration(res.paper.duration_minutes)}</p>

      <div className={`${card} mt-4 text-center`}>
        <div className="text-5xl font-bold tabular-nums text-brand-700">{res.pct}%</div>
        <div className="mt-1 text-sm text-stone-500">{res.score} of {res.total} correct{counts.blank > 0 && <> · {counts.blank} unanswered</>}</div>
        {res.cohort && (
          <p className="mt-3 text-sm text-stone-600">
            You scored higher than <b>{res.cohort.percentile}%</b> of students’ first attempts. The average was <b>{res.cohort.average_pct}%</b> ({res.cohort.students} students).
          </p>
        )}
      </div>

      {subjects.length > 1 && (
        <div className={`${card} mt-4`}>
          <h2 className="mb-2 text-sm font-semibold text-stone-700">By subject, weakest first</h2>
          <ul className="space-y-2.5">
            {subjects.map((s) => (
              <li key={s.subject}>
                <div className="flex items-baseline justify-between text-sm">
                  <span className="font-medium">{s.subject}</span>
                  <span className="tabular-nums text-stone-500">{s.correct}/{s.total} · {s.pct}%</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-stone-100">
                  <div className={`h-full ${barColour(s.pct)}`} style={{ width: `${s.pct}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <h2 className="mr-1 text-sm font-semibold text-stone-700">Review</h2>
        {[['all', 'All'], ['wrong', 'Wrong'], ['blank', 'Unanswered'], ['flagged', 'Flagged']].map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setFilter(k)}
            className={`rounded-full border px-3 py-1 text-xs font-medium ${filter === k ? 'border-stone-900 bg-stone-900 text-white' : 'border-stone-300 bg-white text-stone-600'}`}
          >
            {label} ({counts[k]})
          </button>
        ))}
      </div>

      <div className="mt-3 space-y-3">
        {shown.length === 0 && <p className="rounded-2xl border border-dashed border-stone-300 px-4 py-6 text-center text-sm text-stone-400">Nothing here.</p>}
        {shown.map((q) => (
          <div key={q.id} className={card}>
            <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-stone-500">
              <span className="font-bold text-stone-700">Q{q.number}</span>
              {q.subject && <Pill>{q.subject}</Pill>}
              {q.selected == null ? <Pill tone="amber">Unanswered</Pill> : q.is_correct ? <Pill tone="green">Correct</Pill> : <Pill tone="red">Wrong</Pill>}
              {q.flagged && <Pill tone="amber">⚑ Flagged</Pill>}
            </div>
            <p className="whitespace-pre-line text-[15px] leading-relaxed">{q.stem}</p>
            {q.image_path && <img src={imageUrl(q.image_path)} alt="Question" className="mx-auto mt-3 max-h-80 w-auto max-w-full rounded-xl" />}
            <div className="mt-3 space-y-1.5">
              {(q.options || []).map((opt, i) => {
                const isRight = i === q.correct_option
                const isMine = i === q.selected
                const style = isRight ? 'border-emerald-500 bg-emerald-50' : isMine ? 'border-red-400 bg-red-50' : 'border-stone-200 bg-white opacity-70'
                const badge = isRight ? 'bg-emerald-600 text-white' : isMine ? 'bg-red-500 text-white' : 'bg-stone-100 text-stone-500'
                return (
                  <div key={i} className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm ${style}`}>
                    <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold ${badge}`}>{LETTERS[i]}</span>
                    <span className="flex-1">{opt}</span>
                    {isMine && <span className="text-xs font-semibold text-stone-500">Your answer</span>}
                  </div>
                )
              })}
            </div>
            {(q.explanation || q.explanation_image_path) && (
              <div className="mt-3 rounded-xl bg-stone-50 p-3 text-sm leading-relaxed">
                <div className="mb-1 text-xs font-bold uppercase tracking-wide text-stone-400">Why</div>
                <p className="whitespace-pre-line">{q.explanation}</p>
                {q.explanation_image_path && <img src={imageUrl(q.explanation_image_path)} alt="Explanation" className="mx-auto mt-3 max-h-[28rem] w-auto max-w-full rounded-xl border border-stone-200" />}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-6 text-center">
        <Link to="/mocks" className={btnDark}>Back to mock exams</Link>
      </div>
    </div>
  )
}
