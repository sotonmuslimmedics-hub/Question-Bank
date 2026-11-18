import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { fmtDate, fmtDuration } from '../lib/mock'
import { PageHeader, Notice, Empty, Pill, Modal, card, btnDark, btnPrimary, btnGhost } from '../components/ui'

// Student-facing list of timed mock papers.
export default function Mocks() {
  const { isLead } = useAuth()
  const nav = useNavigate()
  const [papers, setPapers] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState('')
  const [confirming, setConfirming] = useState(null) // paper about to be started

  useEffect(() => {
    supabase.rpc('mock_list').then(({ data, error: err }) => {
      if (err) setError(err.message)
      setPapers(data || [])
    })
  }, [])

  async function start(p) {
    setBusy(p.id)
    setError('')
    const { data, error: err } = await supabase.rpc('mock_start', { p_paper: p.id })
    setBusy('')
    setConfirming(null)
    if (err) return setError(err.message)
    nav(`/mocks/${data.attempt_id}`)
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Mock exams">
        Timed multiple-choice papers under exam conditions. The clock keeps running if you leave, you see no answers until you submit, and you can retake a paper as many times as you like.
      </PageHeader>
      <Notice tone="error" onClose={() => setError('')}>{error}</Notice>

      {papers === null && <p className="text-sm text-stone-400">Loading…</p>}
      {papers && papers.length === 0 && (
        <Empty>No mock exams are open right now. Check the News page for when the next one opens.</Empty>
      )}

      <div className="space-y-3">
        {(papers || []).map((p) => {
          const live = p.status === 'live'
          const resume = !!p.open_attempt_id
          return (
            <div key={p.id} className={card}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <h2 className="text-lg font-bold leading-tight">{p.title}</h2>
                {isLead && p.status !== 'live' && <Pill tone={p.status === 'draft' ? 'amber' : 'stone'}>{p.status === 'draft' ? 'Draft (leads only)' : 'Closed'}</Pill>}
                {!isLead && p.status === 'closed' && <Pill>Closed</Pill>}
              </div>
              {p.description && <p className="mt-1 text-sm text-stone-600">{p.description}</p>}
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-stone-500">
                <Pill tone="brand">{p.question_count} questions</Pill>
                <Pill tone="brand">{fmtDuration(p.duration_minutes)}</Pill>
                {p.closes_at && live && <span>Closes {fmtDate(p.closes_at)}</span>}
                {p.opens_at && new Date(p.opens_at) > new Date() && <span>Opens {fmtDate(p.opens_at)}</span>}
              </div>

              {p.attempts_done > 0 && (
                <p className="mt-3 text-sm text-stone-600">
                  Best score <b>{p.best_pct}%</b> · {p.attempts_done} attempt{p.attempts_done === 1 ? '' : 's'}
                  {p.last_attempt_id && (
                    <Link to={`/mocks/${p.last_attempt_id}/results`} className="ml-2 font-medium text-brand-600 underline">
                      Review last attempt
                    </Link>
                  )}
                </p>
              )}

              <div className="mt-3 flex flex-wrap gap-2">
                {resume ? (
                  <button className={btnPrimary} onClick={() => nav(`/mocks/${p.open_attempt_id}`)}>Resume (clock is running)</button>
                ) : p.can_start ? (
                  <button className={btnDark} disabled={busy === p.id} onClick={() => setConfirming(p)}>
                    {p.attempts_done > 0 ? 'Retake' : 'Start'}
                  </button>
                ) : isLead ? (
                  <button className={btnGhost} disabled={busy === p.id} onClick={() => setConfirming(p)}>Preview as a student</button>
                ) : (
                  <span className="text-sm text-stone-400">Not open for new attempts</span>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {isLead && (
        <p className="mt-6 text-center text-sm text-stone-500">
          Leads: create and manage papers on the <Link to="/manage/papers" className="font-medium text-brand-600 underline">Mock papers</Link> page.
        </p>
      )}

      {confirming && (
        <Modal title={`Start “${confirming.title}”?`} onClose={() => setConfirming(null)}>
          <ul className="list-disc space-y-1.5 pl-5 text-sm text-stone-600">
            <li>You have <b>{fmtDuration(confirming.duration_minutes)}</b> for <b>{confirming.question_count} questions</b>. The clock starts now.</li>
            <li>It keeps running if you close the page. Come back to this screen and tap Resume.</li>
            <li>You see no answers until you submit. When time runs out, it submits for you.</li>
            <li>Answers save as you go, so a dropped connection won’t lose them.</li>
          </ul>
          <div className="mt-5 flex justify-end gap-2">
            <button className={btnGhost} onClick={() => setConfirming(null)}>Not yet</button>
            <button className={btnPrimary} disabled={busy === confirming.id} onClick={() => start(confirming)}>
              {busy === confirming.id ? 'Starting…' : 'Start the clock'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
