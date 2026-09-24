import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { imageUrl } from '../lib/images'
import { checkAnswer } from '../lib/answers'
import { buildTree, pathOf, fetchAll } from '../lib/sections'
import { Pill, btnDark, btnPrimary, btnGhost, inputCls } from '../components/ui'

const LETTERS = 'ABCDEFGH'
const DIFF = { 1: 'Easier', 2: 'Medium', 3: 'Harder' }

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
  const sectionIds = useMemo(() => (params.get('s') || '').split(',').filter(Boolean), [params])
  const limit = Number(params.get('n')) || 0
  const subjectIds = useMemo(() => (params.get('subject') || '').split(',').filter(Boolean), [params])
  const [questions, setQuestions] = useState([])
  const [paths, setPaths] = useState(new Map())
  const [index, setIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [score, setScore] = useState({ done: 0, correct: 0 })
  const [error, setError] = useState('')

  const [chosen, setChosen] = useState(null)
  const [typed, setTyped] = useState(['', ''])
  const [checked, setChecked] = useState(false)
  const [marks, setMarks] = useState([false, false])
  const [autoMarks, setAutoMarks] = useState([false, false])

  useEffect(() => {
    if (sectionIds.length === 0) return setLoading(false)
    ;(async () => {
      try {
        const [data, secs] = await Promise.all([
          fetchAll(() => {
            let q = supabase
              .from('questions')
              .select('id,stem,options,correct_option,explanation,section_id,question_type,image_path,author_name,difficulty,question_parts(id,part_number,prompt,accepted_answers)')
              .in('section_id', sectionIds)
              .eq('is_published', true)
            if (subjectIds.length) q = q.in('subject_id', subjectIds)
            return q.order('id')
          }),
          fetchAll(() => supabase.from('sections').select('id,parent_id,name,sort_order').order('id')),
        ])
        const prepared = data.map((q) => ({
          ...q,
          question_parts: [...(q.question_parts || [])].sort((a, b) => a.part_number - b.part_number),
        }))
        let list = shuffle(prepared)
        if (limit > 0) list = list.slice(0, limit)
        setQuestions(list)
        const { nodes } = buildTree(secs)
        setPaths(new Map(list.map((q) => [q.id, pathOf(nodes, q.section_id)])))
      } catch (e) {
        setError(e.message)
      }
      setLoading(false)
    })()
  }, [sectionIds, limit, subjectIds])

  const q = questions[index]
  const isStation = q?.question_type === 'station'
  const finished = !loading && questions.length > 0 && index >= questions.length
  const answered = isStation ? checked : chosen !== null

  useEffect(() => {
    const nextQ = questions[index + 1]
    if (nextQ?.image_path) new Image().src = imageUrl(nextQ.image_path)
  }, [index, questions])

  async function choose(i) {
    if (answered || saving) return
    setChosen(i)
    setSaving(true)
    const ok = i === q.correct_option
    setScore((s) => ({ done: s.done + 1, correct: s.correct + (ok ? 1 : 0) }))
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

  if (loading) return <p className="text-stone-500">Loading questions…</p>
  if (sectionIds.length === 0 || questions.length === 0)
    return (
      <div>
        <p className="text-stone-600">{error || 'No questions found for that selection.'}</p>
        <Link to="/practice" className="mt-3 inline-block text-sm font-medium text-brand-700">← Back to Practise</Link>
      </div>
    )

  if (finished)
    return (
      <div className="mx-auto max-w-md rounded-3xl border border-stone-200 bg-white p-8 text-center">
        <h1 className="text-2xl font-bold">Session complete</h1>
        <p className="mt-2 text-5xl font-bold text-brand-700">{score.correct}<span className="text-2xl text-stone-400"> / {score.done}</span></p>
        <p className="mt-1 text-stone-500">{score.done ? Math.round((score.correct / score.done) * 100) : 0}% correct</p>
        <Link to="/practice" className={`${btnDark} mt-6`}>Back to Practise</Link>
      </div>
    )

  const pct = (index / questions.length) * 100
  const allRight = isStation && marks.every(Boolean)

  return (
    <div className="mx-auto max-w-2xl pb-24">
      <div className="flex items-center justify-between text-sm">
        <Link to="/practice" className="text-stone-400 hover:text-stone-600">← Exit</Link>
        <span className="font-semibold text-stone-500">{index + 1} / {questions.length}</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-stone-200">
        <div className="h-full bg-brand-500 transition-all" style={{ width: `${pct}%` }} />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-stone-500">
        <span className="truncate">{paths.get(q.id)}</span>
        {q.difficulty && <Pill tone="amber">{DIFF[q.difficulty] || q.difficulty}</Pill>}
      </div>

      <div className="mt-2 rounded-2xl border border-stone-200 bg-white p-5 text-[15px] leading-relaxed shadow-sm">{q.stem}</div>

      {isStation && q.image_path && (
        <div className="mt-3 overflow-hidden rounded-2xl border border-stone-200 bg-white p-2">
          <img key={q.id} src={imageUrl(q.image_path)} alt="Question" className="mx-auto max-h-[28rem] w-auto max-w-full rounded-xl" />
        </div>
      )}

      {!isStation && (
        <div className="mt-3 space-y-2">
          {q.options.map((opt, i) => {
            let style = 'border-stone-200 bg-white active:bg-stone-50'
            let badge = 'bg-stone-100 text-stone-500'
            if (answered) {
              if (i === q.correct_option) {
                style = 'border-emerald-500 bg-emerald-50'
                badge = 'bg-emerald-600 text-white'
              } else if (i === chosen) {
                style = 'border-red-400 bg-red-50'
                badge = 'bg-red-500 text-white'
              } else style = 'border-stone-200 bg-white opacity-60'
            }
            return (
              <button key={i} disabled={answered} onClick={() => choose(i)} className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3.5 text-left text-sm ${style}`}>
                <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold ${badge}`}>{LETTERS[i]}</span>
                <span>{opt}</span>
              </button>
            )
          })}
        </div>
      )}

      {isStation && (
        <div className="mt-3 space-y-3">
          {q.question_parts.map((p, i) => {
            const good = marks[i]
            return (
              <div key={p.id} className={`rounded-2xl border p-4 ${checked ? (good ? 'border-emerald-500 bg-emerald-50' : 'border-red-400 bg-red-50') : 'border-stone-200 bg-white'}`}>
                <label className="block text-sm font-semibold"><span className="mr-2 text-stone-400">{i + 1}.</span>{p.prompt}</label>
                <input
                  className={`${inputCls} mt-2`}
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
                    <div className={`font-semibold ${good ? 'text-emerald-700' : 'text-red-700'}`}>
                      {good ? 'Correct' : 'Incorrect'}
                      {autoMarks[i] !== good && <span className="ml-2 text-xs font-normal text-stone-500">(marked by you)</span>}
                    </div>
                    <div className="mt-1 text-stone-700">
                      <span className="text-xs font-bold uppercase tracking-wide text-stone-400">Model answer </span>
                      {p.accepted_answers[0]}
                      {p.accepted_answers.length > 1 && <span className="text-stone-500"> (also accepted: {p.accepted_answers.slice(1).join('; ')})</span>}
                    </div>
                    <button type="button" onClick={() => setMarks((m) => m.map((v, j) => (j === i ? !v : v)))} className={`${btnGhost} mt-2`}>
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
        <div className={`mt-4 rounded-2xl border p-4 ${chosen === q.correct_option ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'}`}>
          <div className={`font-bold ${chosen === q.correct_option ? 'text-emerald-700' : 'text-red-700'}`}>
            {chosen === q.correct_option ? 'Correct' : `Not quite. The answer is ${LETTERS[q.correct_option]}.`}
          </div>
          {q.explanation && <Explanation text={q.explanation} />}
        </div>
      )}
      {isStation && checked && (
        <div className={`mt-4 rounded-2xl border p-4 ${allRight ? 'border-emerald-200 bg-emerald-50' : 'border-stone-200 bg-white'}`}>
          <div className="font-bold">{marks.filter(Boolean).length} of {marks.length} correct</div>
          {q.explanation && <Explanation text={q.explanation} />}
        </div>
      )}

      {answered && q.author_name && <p className="mt-2 text-right text-xs text-stone-400">Question by {q.author_name}</p>}
      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      <div className="safe-bottom fixed inset-x-0 bottom-[3.9rem] z-20 border-t border-stone-200 bg-white/95 px-4 py-3 sm:bottom-0">
        <div className="mx-auto flex max-w-2xl justify-end">
          {isStation && !checked ? (
            <button onClick={checkStation} className={`${btnPrimary} w-full sm:w-auto`}>Check answers</button>
          ) : (
            <button disabled={!answered || saving} onClick={next} className={`${btnDark} w-full sm:w-auto`}>
              {index + 1 === questions.length ? 'Finish' : 'Next →'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function Explanation({ text }) {
  return (
    <div className="mt-3 rounded-xl bg-white p-3 text-sm leading-relaxed">
      <div className="mb-1 text-xs font-bold uppercase tracking-wide text-stone-400">Why</div>
      {text}
    </div>
  )
}
