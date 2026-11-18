import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { imageUrl } from '../lib/images'
import { LETTERS, outlineBtn, fmtClock } from '../lib/mock'
import { Modal, Notice, btnDark, btnPrimary, btnGhost } from '../components/ui'

// The timed exam screen.
//  * The deadline lives on the server. This page only displays a countdown against the server's clock,
//    so refreshing, closing the tab or changing device never resets or extends the time.
//  * Answers are saved as you go (batched, retried if the connection drops) and marked by the database
//    on submit. The correct answers are never sent to this page.
export default function MockExam() {
  const { attemptId } = useParams()
  const nav = useNavigate()
  const [exam, setExam] = useState(null)
  const [answers, setAnswers] = useState({}) // question id -> { s: option index | null, f: flagged }
  const [index, setIndex] = useState(0)
  const [left, setLeft] = useState(null) // seconds remaining
  const [saveState, setSaveState] = useState('saved') // saved | saving | retry
  const [error, setError] = useState('')
  const [showNav, setShowNav] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const offsetRef = useRef(0) // server clock minus this device's clock, in ms
  const deadlineRef = useRef(0) // server time of the deadline, ms since epoch
  const answersRef = useRef({})
  const pending = useRef(new Map()) // question id -> latest unsaved { q, s, f }
  const flushing = useRef(null)
  const debounce = useRef(null)
  const submittedRef = useRef(false)

  // ---- load ---------------------------------------------------------------
  useEffect(() => {
    let cancelled = false
    supabase.rpc('mock_get', { p_attempt: attemptId }).then(({ data, error: err }) => {
      if (cancelled) return
      if (err) return setError(err.message)
      if (data.submitted) return nav(`/mocks/${attemptId}/results`, { replace: true })
      offsetRef.current = Date.parse(data.server_now) - Date.now()
      deadlineRef.current = Date.parse(data.deadline_at)
      const saved = Object.fromEntries(Object.entries(data.answers || {}).map(([q, a]) => [q, { s: a.selected, f: a.flagged }]))
      answersRef.current = saved
      setAnswers(saved)
      setExam(data)
      setLeft((deadlineRef.current - (Date.now() + offsetRef.current)) / 1000)
    })
    return () => { cancelled = true }
  }, [attemptId, nav])

  // ---- saving -------------------------------------------------------------
  const flush = useCallback(() => {
    if (flushing.current) return flushing.current
    flushing.current = (async () => {
      while (pending.current.size) {
        const batch = [...pending.current.values()]
        setSaveState('saving')
        const { error: err } = await supabase.rpc('mock_save', { p_attempt: attemptId, p_answers: batch })
        if (err) {
          if (/finished|Time is up/i.test(err.message)) {
            pending.current.clear() // too late to save; submit/auto-submit will take what is already stored
            setSaveState('saved')
          } else setSaveState('retry')
          return
        }
        // forget only what has not changed again while the request was in flight
        for (const b of batch) if (pending.current.get(b.q) === b) pending.current.delete(b.q)
      }
      setSaveState('saved')
    })().finally(() => { flushing.current = null })
    return flushing.current
  }, [attemptId])

  // retry unsaved answers every few seconds (e.g. after the phone loses signal)
  useEffect(() => {
    const t = setInterval(() => { if (pending.current.size) flush() }, 4000)
    return () => clearInterval(t)
  }, [flush])

  function setAnswer(qid, patch) {
    const cur = answersRef.current[qid] || { s: null, f: false }
    const next = { ...cur, ...patch }
    answersRef.current = { ...answersRef.current, [qid]: next }
    setAnswers(answersRef.current)
    pending.current.set(qid, { q: qid, s: next.s, f: next.f })
    setSaveState('saving')
    clearTimeout(debounce.current)
    debounce.current = setTimeout(flush, 300)
  }

  // ---- submit -------------------------------------------------------------
  const submit = useCallback(async () => {
    if (submittedRef.current) return
    submittedRef.current = true
    setSubmitting(true)
    setError('')
    clearTimeout(debounce.current)
    for (let i = 0; i < 3 && pending.current.size; i++) {
      await flush()
      if (pending.current.size) await new Promise((r) => setTimeout(r, 800))
    }
    const { error: err } = await supabase.rpc('mock_submit', { p_attempt: attemptId })
    if (err) {
      submittedRef.current = false
      setSubmitting(false)
      setConfirming(false)
      return setError(`${err.message} Your answers are saved. Check your connection and press Submit again.`)
    }
    nav(`/mocks/${attemptId}/results`, { replace: true })
  }, [attemptId, flush, nav])

  // ---- countdown ----------------------------------------------------------
  useEffect(() => {
    if (!exam) return
    const tick = () => {
      const s = (deadlineRef.current - (Date.now() + offsetRef.current)) / 1000
      setLeft(s)
      if (s <= 0) submit() // time is up: submit for them
    }
    tick()
    const t = setInterval(tick, 1000)
    const onVisible = () => { if (document.visibilityState === 'visible') tick() } // background tabs throttle timers
    document.addEventListener('visibilitychange', onVisible)
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', onVisible) }
  }, [exam, submit])

  // ---- keyboard: A–E to choose, arrows to move ------------------------------
  const n = exam?.questions.length || 0
  useEffect(() => {
    if (!exam || showNav || confirming || submitting) return
    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === 'ArrowRight') setIndex((i) => Math.min(n - 1, i + 1))
      else if (e.key === 'ArrowLeft') setIndex((i) => Math.max(0, i - 1))
      else {
        const k = LETTERS.indexOf(e.key.toUpperCase())
        const q = exam.questions[index]
        if (k >= 0 && e.key.length === 1 && k < (q.options?.length || 0)) setAnswer(q.id, { s: k })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exam, index, showNav, confirming, submitting, n])

  if (error && !exam) {
    return (
      <div className="mx-auto max-w-2xl">
        <Notice tone="error">{error}</Notice>
        <Link to="/mocks" className="text-sm font-medium text-brand-600 underline">← Back to mock exams</Link>
      </div>
    )
  }
  if (!exam) return <p className="p-8 text-center text-sm text-stone-400">Loading…</p>

  const q = exam.questions[index]
  const a = answers[q.id] || { s: null, f: false }
  const answeredCount = exam.questions.filter((x) => answers[x.id]?.s != null).length
  const flaggedCount = exam.questions.filter((x) => answers[x.id]?.f).length
  const urgent = left !== null && left < 60
  const warn = left !== null && left < 600
  const last = index === n - 1

  return (
    <div className="mx-auto max-w-2xl pb-28">
      {/* timer strip, stays under the site header while scrolling */}
      <div className="sticky top-[3.3rem] z-20 -mx-4 mb-4 border-b border-stone-200 bg-paper/95 px-4 py-2 backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate text-xs font-semibold text-stone-500">{exam.paper.title}</div>
            <div className="text-sm font-bold">Question {index + 1} of {n}</div>
          </div>
          {/* fixed width, so the box never resizes when the save message below it changes */}
          <div className="w-28 shrink-0 text-center">
            <div
              className={`rounded-xl px-3 py-1 text-lg font-bold tabular-nums ${urgent ? 'animate-pulse bg-red-600 text-white' : warn ? 'bg-amber-100 text-amber-800' : 'bg-stone-900 text-white'}`}
              role="timer"
              aria-label="Time remaining"
            >
              {fmtClock(left ?? 0)}
            </div>
            <div className={`mt-0.5 h-4 whitespace-nowrap text-[11px] ${saveState === 'retry' ? 'font-semibold text-red-600' : 'text-stone-400'}`}>
              {saveState === 'saved' && 'Saved ✓'}
              {saveState === 'saving' && 'Saving…'}
              {saveState === 'retry' && 'Retrying…'}
            </div>
          </div>
        </div>
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-stone-200">
          <div className="h-full bg-brand-500 transition-all" style={{ width: `${(answeredCount / n) * 100}%` }} />
        </div>
      </div>

      <Notice tone="error" onClose={() => setError('')}>{error}</Notice>

      <div className="rounded-2xl border border-stone-200 bg-white p-5 text-[15px] leading-relaxed shadow-sm">
        <p className="whitespace-pre-line">{q.stem}</p>
        {q.image_path && <img key={q.id} src={imageUrl(q.image_path)} alt="Question" className="mx-auto mt-3 max-h-[28rem] w-auto max-w-full rounded-xl" />}
      </div>

      <div className="mt-3 space-y-2">
        {(q.options || []).map((opt, i) => {
          const on = a.s === i
          return (
            <button
              key={i}
              type="button"
              onClick={() => setAnswer(q.id, { s: i })}
              aria-pressed={on}
              className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3.5 text-left text-sm ${on ? 'border-brand-600 bg-brand-50' : 'border-stone-200 bg-white active:bg-stone-50'}`}
            >
              <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold ${on ? 'bg-brand-600 text-white' : 'bg-stone-100 text-stone-500'}`}>{LETTERS[i]}</span>
              <span>{opt}</span>
            </button>
          )
        })}
      </div>

      <div className="mt-3 flex items-center justify-between text-sm">
        <button
          type="button"
          onClick={() => setAnswer(q.id, { f: !a.f })}
          className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${a.f ? 'border-gold-500 bg-gold-50 text-gold-600' : 'border-stone-300 bg-white text-stone-600'}`}
        >
          {a.f ? '⚑ Flagged for review' : '⚐ Flag for review'}
        </button>
        {a.s != null && (
          <button type="button" onClick={() => setAnswer(q.id, { s: null })} className="text-xs text-stone-400 underline hover:text-stone-600">
            Clear my answer
          </button>
        )}
      </div>

      {/* bottom bar sits on top of the phone tab bar, like the practice quiz */}
      <div className="fixed inset-x-0 bottom-[var(--nav-h,0px)] z-20 border-t border-stone-200 bg-white px-4 py-3">
        <div className="mx-auto flex max-w-2xl items-stretch justify-between gap-2">
          <button type="button" disabled={index === 0} onClick={() => setIndex(index - 1)} className={`${outlineBtn} shrink-0`}>← Back</button>
          <button type="button" onClick={() => setShowNav(true)} className={`${outlineBtn} flex-1 sm:flex-none`}>
            ☰ {answeredCount}/{n}{flaggedCount > 0 && <span className="ml-1.5 text-gold-600">⚑{flaggedCount}</span>}
          </button>
          {last ? (
            <button type="button" onClick={() => setConfirming(true)} className={`${btnPrimary} shrink-0`}>Review & submit</button>
          ) : (
            <button type="button" onClick={() => setIndex(index + 1)} className={`${btnDark} shrink-0`}>Next →</button>
          )}
        </div>
      </div>

      {showNav && (
        <Modal title="All questions" onClose={() => setShowNav(false)}>
          <div className="grid grid-cols-6 gap-2 sm:grid-cols-8">
            {exam.questions.map((x, i) => {
              const ans = answers[x.id]
              const done = ans?.s != null
              return (
                <button
                  key={x.id}
                  type="button"
                  onClick={() => { setIndex(i); setShowNav(false) }}
                  className={`relative h-10 rounded-lg border text-sm font-semibold ${done ? 'border-brand-600 bg-brand-600 text-white' : 'border-stone-300 bg-white text-stone-700'} ${i === index ? 'ring-2 ring-gold-500 ring-offset-1' : ''}`}
                  aria-label={`Question ${i + 1}${done ? ', answered' : ', not answered'}${ans?.f ? ', flagged' : ''}`}
                >
                  {i + 1}
                  {ans?.f && <span className="absolute -right-1 -top-1 text-[11px] text-gold-600">⚑</span>}
                </button>
              )
            })}
          </div>
          <p className="mt-3 text-xs text-stone-500">Filled = answered · ⚑ = flagged · gold ring = where you are now.</p>
          <div className="mt-4 flex justify-end gap-2">
            <button className={btnGhost} onClick={() => setShowNav(false)}>Keep going</button>
            <button className={btnPrimary} onClick={() => { setShowNav(false); setConfirming(true) }}>Submit paper…</button>
          </div>
        </Modal>
      )}

      {confirming && (
        <Modal title="Submit this paper?" onClose={() => !submitting && setConfirming(false)}>
          <p className="text-sm text-stone-600">
            You have answered <b>{answeredCount}</b> of <b>{n}</b> questions.
            {n - answeredCount > 0 && <> <b className="text-red-600">{n - answeredCount} unanswered</b> will count as wrong.</>}
            {flaggedCount > 0 && <> {flaggedCount} flagged for review.</>}
            {left > 0 && <> You still have {fmtClock(left)} left.</>}
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <button className={btnGhost} disabled={submitting} onClick={() => setConfirming(false)}>Keep going</button>
            <button className={btnPrimary} disabled={submitting} onClick={submit}>{submitting ? 'Submitting…' : 'Submit now'}</button>
          </div>
        </Modal>
      )}

      {submitting && !confirming && (
        <Modal title="Submitting…" onClose={() => {}}>
          <p className="text-sm text-stone-600">Saving your answers and marking the paper. This takes a moment.</p>
        </Modal>
      )}
    </div>
  )
}
