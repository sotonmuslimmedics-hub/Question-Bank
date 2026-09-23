import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const LETTERS = 'ABCDEFGH'

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export default function Quiz() {
  const [params] = useSearchParams()
  const weekIds = useMemo(() => (params.get('weeks') || '').split(',').filter(Boolean), [params])
  const [questions, setQuestions] = useState([])
  const [index, setIndex] = useState(0)
  const [chosen, setChosen] = useState(null)
  const [score, setScore] = useState({ done: 0, correct: 0 })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (weekIds.length === 0) {
      setLoading(false)
      return
    }
    supabase
      .from('questions')
      .select('id,stem,options,correct_option,explanation,week_id')
      .in('week_id', weekIds)
      .eq('is_published', true)
      .then(({ data, error }) => {
        if (error) setError(error.message)
        setQuestions(shuffle(data || []))
        setLoading(false)
      })
  }, [weekIds])

  const q = questions[index]
  const answered = chosen !== null
  const finished = !loading && questions.length > 0 && index >= questions.length

  async function choose(i) {
    if (answered || saving) return
    setChosen(i)
    setSaving(true)
    const isCorrect = i === q.correct_option
    setScore((s) => ({ done: s.done + 1, correct: s.correct + (isCorrect ? 1 : 0) }))
    const { error } = await supabase.from('attempts').insert({ question_id: q.id, selected_option: i })
    if (error) setError('Your answer could not be saved: ' + error.message)
    setSaving(false)
  }

  function next() {
    setChosen(null)
    setIndex((n) => n + 1)
  }

  if (loading) return <p className="text-slate-500">Loading questions…</p>
  if (weekIds.length === 0 || questions.length === 0)
    return (
      <div>
        <p className="text-slate-600">{error || 'No questions found for that selection.'}</p>
        <Link to="/banks" className="mt-3 inline-block text-sm font-medium text-brand-700">← Back to question banks</Link>
      </div>
    )

  if (finished)
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
        <h1 className="text-2xl font-bold">Session complete</h1>
        <p className="mt-2 text-4xl font-bold text-brand-700">{score.correct} / {score.done}</p>
        <p className="text-slate-500">{score.done ? Math.round((score.correct / score.done) * 100) : 0}% correct</p>
        <Link to="/banks" className="mt-6 inline-block rounded-lg bg-slate-900 px-5 py-2 text-sm font-semibold text-white">Back to question banks</Link>
      </div>
    )

  const pct = (index / questions.length) * 100

  return (
    <div>
      <div className="flex items-end justify-between">
        <div>
          <Link to="/banks" className="text-sm text-slate-400 hover:text-slate-600">← Question banks</Link>
          <h1 className="text-xl font-bold">Custom session · {weekIds.length} week{weekIds.length > 1 ? 's' : ''}</h1>
        </div>
        <div className="text-right text-sm font-semibold text-slate-500">Question {index + 1} of {questions.length}</div>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-200">
        <div className="h-full bg-brand-500 transition-all" style={{ width: `${pct}%` }} />
      </div>

      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">{q.stem}</div>

      <div className="mt-4 space-y-2">
        {q.options.map((opt, i) => {
          let style = 'border-slate-200 bg-white hover:border-slate-300'
          let badge = 'bg-slate-100 text-slate-500'
          if (answered) {
            if (i === q.correct_option) {
              style = 'border-green-500 bg-green-50'
              badge = 'bg-green-600 text-white'
            } else if (i === chosen) {
              style = 'border-red-400 bg-red-50'
              badge = 'bg-red-500 text-white'
            } else {
              style = 'border-slate-200 bg-white opacity-60'
            }
          }
          return (
            <button key={i} disabled={answered} onClick={() => choose(i)} className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm ${style}`}>
              <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold ${badge}`}>{LETTERS[i]}</span>
              <span>{opt}</span>
            </button>
          )
        })}
      </div>

      {answered && (
        <div className={`mt-6 rounded-xl border p-5 ${chosen === q.correct_option ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
          <div className={`font-bold ${chosen === q.correct_option ? 'text-green-700' : 'text-red-700'}`}>
            {chosen === q.correct_option ? 'Correct!' : `Incorrect — the answer is ${LETTERS[q.correct_option]}.`}
          </div>
          {q.explanation && (
            <div className="mt-3 rounded-lg bg-white p-4 text-sm">
              <div className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-400">Explanation</div>
              {q.explanation}
            </div>
          )}
        </div>
      )}

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      <div className="mt-6 flex justify-end">
        <button disabled={!answered} onClick={next} className="rounded-lg bg-slate-900 px-6 py-2.5 text-sm font-semibold text-white disabled:bg-slate-200 disabled:text-slate-400">
          {index + 1 === questions.length ? 'Finish' : 'Next question →'}
        </button>
      </div>
    </div>
  )
}
