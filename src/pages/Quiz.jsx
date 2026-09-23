import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { imageUrl } from '../lib/images'
import { checkAnswer } from '../lib/answers'

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
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [score, setScore] = useState({ done: 0, correct: 0 })
  const [error, setError] = useState('')

  // multiple-choice state
  const [chosen, setChosen] = useState(null)
  // photo-question state
  const [typed, setTyped] = useState(['', ''])
  const [checked, setChecked] = useState(false)
  const [marks, setMarks] = useState([false, false]) // final correct/incorrect per part (student can override)
  const [autoMarks, setAutoMarks] = useState([false, false])

  useEffect(() => {
    if (weekIds.length === 0) {
      setLoading(false)
      return
    }
    supabase
      .from('questions')
      .select('id,stem,options,correct_option,explanation,week_id,question_type,image_path,question_parts(id,part_number,prompt,accepted_answers)')
      .in('week_id', weekIds)
      .eq('is_published', true)
      .then(({ data, error }) => {
        if (error) setError(error.message)
        const prepared = (data || []).map((q) => ({
          ...q,
          question_parts: [...(q.question_parts || [])].sort((a, b) => a.part_number - b.part_number),
        }))
        setQuestions(shuffle(prepared))
        setLoading(false)
      })
  }, [weekIds])

  const q = questions[index]
  const isStation = q?.question_type === 'station'
  const finished = !loading && questions.length > 0 && index >= questions.length
  const answered = isStation ? checked : chosen !== null

  // warm the browser cache with the next photo so it appears instantly
  useEffect(() => {
    const nextQ = questions[index + 1]
    if (nextQ?.image_path) new Image().src = imageUrl(nextQ.image_path)
  }, [index, questions])

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

  function checkStation() {
    const auto = q.question_parts.map((p, i) => checkAnswer(typed[i], p.accepted_answers))
    setAutoMarks(auto)
    setMarks(auto)
    setChecked(true)
  }

  function toggleMark(i) {
    setMarks((m) => m.map((v, j) => (j === i ? !v : v)))
  }

  async function next() {
    if (isStation) {
      setSaving(true)
      const rows = q.question_parts.map((p, i) => ({ part_id: p.id, answer_text: typed[i] || '', is_correct: marks[i] }))
      const { error } = await supabase.from('part_attempts').insert(rows)
      if (error) setError('Your answers could not be saved: ' + error.message)
      setScore((s) => ({ done: s.done + rows.length, correct: s.correct + marks.filter(Boolean).length }))
      setSaving(false)
    }
    setChosen(null)
    setTyped(['', ''])
    setChecked(false)
    setMarks([false, false])
    setAutoMarks([false, false])
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
  const allRight = isStation && marks.every(Boolean)

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

      {isStation && q.image_path && (
        <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white p-2">
          <img key={q.id} src={imageUrl(q.image_path)} alt="Question image" className="mx-auto max-h-[28rem] w-auto max-w-full rounded-lg" />
        </div>
      )}

      {!isStation && (
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
      )}

      {isStation && (
        <div className="mt-4 space-y-3">
          {q.question_parts.map((p, i) => {
            const good = marks[i]
            return (
              <div key={p.id} className={`rounded-xl border bg-white p-4 ${checked ? (good ? 'border-green-500 bg-green-50' : 'border-red-400 bg-red-50') : 'border-slate-200'}`}>
                <label className="block text-sm font-semibold">
                  <span className="mr-2 text-slate-400">{i + 1}.</span>{p.prompt}
                </label>
                <input
                  className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none disabled:bg-slate-50"
                  placeholder="Type your answer"
                  value={typed[i]}
                  disabled={checked}
                  maxLength={300}
                  autoComplete="off"
                  onChange={(e) => setTyped((t) => t.map((v, j) => (j === i ? e.target.value : v)))}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !checked && i === q.question_parts.length - 1) checkStation() }}
                />
                {checked && (
                  <div className="mt-3 text-sm">
                    <div className={`font-semibold ${good ? 'text-green-700' : 'text-red-700'}`}>
                      {good ? 'Correct' : 'Incorrect'}
                      {autoMarks[i] !== good && <span className="ml-2 text-xs font-normal text-slate-500">(you marked this yourself)</span>}
                    </div>
                    <div className="mt-1 text-slate-700">
                      <span className="text-xs font-bold uppercase tracking-wide text-slate-400">Model answer </span>
                      {p.accepted_answers[0]}
                      {p.accepted_answers.length > 1 && (
                        <span className="text-slate-500"> (also accepted: {p.accepted_answers.slice(1).join('; ')})</span>
                      )}
                    </div>
                    <button type="button" onClick={() => toggleMark(i)} className="mt-2 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium hover:bg-slate-50">
                      {good ? 'Actually I got this wrong' : 'My answer was right (different wording)'}
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {!isStation && answered && (
        <div className={`mt-6 rounded-xl border p-5 ${chosen === q.correct_option ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
          <div className={`font-bold ${chosen === q.correct_option ? 'text-green-700' : 'text-red-700'}`}>
            {chosen === q.correct_option ? 'Correct!' : `Incorrect — the answer is ${LETTERS[q.correct_option]}.`}
          </div>
          {q.explanation && <Explanation text={q.explanation} />}
        </div>
      )}

      {isStation && checked && (
        <div className={`mt-6 rounded-xl border p-5 ${allRight ? 'border-green-200 bg-green-50' : 'border-slate-200 bg-white'}`}>
          <div className="font-bold">{marks.filter(Boolean).length} of {marks.length} correct</div>
          {q.explanation && <Explanation text={q.explanation} />}
        </div>
      )}

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      <div className="mt-6 flex justify-end gap-3">
        {isStation && !checked && (
          <button onClick={checkStation} className="rounded-lg bg-brand-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-brand-700">Check answers</button>
        )}
        {(!isStation || checked) && (
          <button disabled={!answered || saving} onClick={next} className="rounded-lg bg-slate-900 px-6 py-2.5 text-sm font-semibold text-white disabled:bg-slate-200 disabled:text-slate-400">
            {index + 1 === questions.length ? 'Finish' : 'Next question →'}
          </button>
        )}
      </div>
    </div>
  )
}

function Explanation({ text }) {
  return (
    <div className="mt-3 rounded-lg bg-white p-4 text-sm">
      <div className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-400">Explanation</div>
      {text}
    </div>
  )
}
