import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useSections } from '../../lib/useSections'
import { useSubjects } from '../../lib/useSubjects'
import { pathOf } from '../../lib/sections'
import QuestionEditor from '../../components/QuestionEditor'
import { PageHeader, Notice, Empty, Pill, Modal, btnGhost, card, inputCls } from '../../components/ui'

// Same column list as the Questions page, so the editor opens with every field filled in.
const FULL_SELECT =
  'id,stem,options,correct_option,explanation,explanation_image_path,section_id,subject_id,question_type,image_path,is_published,difficulty,author_name,created_by,created_at,exam_tag,question_parts(id,part_number,prompt,accepted_answers)'

const MIN_STUDENTS = 5

// Cohort-level view for academic leads: which topics and questions the year group
// finds hard. Everything here comes from database functions that return aggregates only —
// no names, and nothing about any topic or question answered by fewer than
// MIN_STUDENTS different people — so it can't be used to look up an individual.
export default function Insights() {
  const sec = useSections()
  const sub = useSubjects()
  const [summary, setSummary] = useState(null)
  const [topics, setTopics] = useState(null)
  const [questions, setQuestions] = useState(null)
  const [error, setError] = useState('')
  const [order, setOrder] = useState('hardest')
  const [editing, setEditing] = useState(null)

  async function load() {
    const [s, t, q] = await Promise.all([
      supabase.rpc('insights_summary'),
      supabase.rpc('insights_topics', { p_min: MIN_STUDENTS }),
      supabase.rpc('insights_questions', { p_min: MIN_STUDENTS }),
    ])
    const err = s.error || t.error || q.error
    if (err) setError(err.message)
    setSummary(s.data?.[0] || null)
    setTopics(t.data || [])
    setQuestions(q.data || [])
  }
  useEffect(() => { load() }, [])

  async function openEditor(id) {
    const { data, error } = await supabase.from('questions').select(FULL_SELECT).eq('id', id).single()
    if (error) return setError(error.message)
    setEditing(data)
  }

  const sortedTopics = useMemo(() => [...(topics || [])].sort((a, b) => a.pct_correct - b.pct_correct), [topics])
  const sortedQuestions = useMemo(
    () => [...(questions || [])].sort((a, b) => (order === 'hardest' ? a.pct_correct - b.pct_correct : b.pct_correct - a.pct_correct)),
    [questions, order],
  )

  const loading = topics === null || sec.loading

  return (
    <div>
      <PageHeader title="Insights">
        How the cohort is getting on: which topics and questions students find hardest, so you know what to revise or reword. Figures are combined across students — no names — and a topic or question only appears once at least {MIN_STUDENTS} different students have answered it.
      </PageHeader>
      <Notice tone="error" onClose={() => setError('')}>{error}</Notice>

      {summary && (
        <div className="mb-5 grid grid-cols-3 gap-2 sm:gap-3">
          <Tile label="Active this week" value={summary.students_7d} />
          <Tile label="Active this month" value={summary.students_30d} />
          <Tile label="Answers this month" value={summary.answers_30d} />
        </div>
      )}

      {loading && <p className="text-sm text-stone-400">Loading…</p>}

      {!loading && (
        <>
          <h2 className="mb-2 text-sm font-semibold text-stone-700">Topics, hardest first</h2>
          {sortedTopics.length === 0 ? (
            <Empty>Not enough answers yet. Topics show up here once {MIN_STUDENTS} or more students have answered questions in them.</Empty>
          ) : (
            <ul className={`${card} mb-6 divide-y divide-stone-100 !p-0`}>
              {sortedTopics.map((t) => (
                <li key={t.section_id} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{pathOf(sec.nodes, t.section_id)}</div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-stone-100">
                      <div className={`h-full ${barColour(t.pct_correct)}`} style={{ width: `${t.pct_correct}%` }} />
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-sm font-semibold tabular-nums">{Number(t.pct_correct).toFixed(0)}%</div>
                    <div className="text-xs text-stone-400">{t.students} students · {t.answers} answers</div>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className="mb-2 flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-stone-700">Questions</h2>
            <select className={`${inputCls} !w-auto`} value={order} onChange={(e) => setOrder(e.target.value)} aria-label="Sort questions">
              <option value="hardest">Hardest first</option>
              <option value="easiest">Easiest first</option>
            </select>
          </div>
          {sortedQuestions.length === 0 ? (
            <Empty>No question has been answered by {MIN_STUDENTS} or more students yet. This fills in as more people practise.</Empty>
          ) : (
            <ul className="space-y-2">
              {sortedQuestions.map((q) => (
                <li key={q.question_id} className={`${card} !p-3 sm:!p-4`}>
                  <div className="flex items-start justify-between gap-3">
                    <p className="line-clamp-2 min-w-0 text-sm font-medium">{q.stem}</p>
                    <Pill tone={q.pct_correct < 40 ? 'red' : q.pct_correct < 70 ? 'amber' : 'green'}>{Number(q.pct_correct).toFixed(0)}% right</Pill>
                  </div>
                  <div className="mt-1 truncate text-xs text-stone-400">
                    {pathOf(sec.nodes, q.section_id)} · {q.students} students · {q.answers} answers
                  </div>
                  {q.top_wrong_text && (
                    <p className="mt-2 text-xs text-stone-600">
                      Most common wrong answer: <b>{q.top_wrong_text}</b> ({Number(q.top_wrong_share).toFixed(0)}% of wrong answers)
                    </p>
                  )}
                  <div className="mt-2">
                    <button type="button" className={btnGhost} onClick={() => openEditor(q.question_id)}>Edit question</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {editing && (
        <Modal title="Edit question" onClose={() => setEditing(null)} wide>
          <QuestionEditor
            initial={editing}
            sections={sec.flat}
            subjects={sub.rows}
            canPublish
            onCancel={() => setEditing(null)}
            onSaved={() => { setEditing(null); load() }}
          />
        </Modal>
      )}
    </div>
  )
}

function Tile({ label, value }) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-3 text-center shadow-sm">
      <div className="text-2xl font-bold tabular-nums text-brand-700">{value}</div>
      <div className="mt-0.5 text-xs text-stone-500">{label}</div>
    </div>
  )
}

function barColour(pct) {
  return pct < 40 ? 'bg-red-400' : pct < 70 ? 'bg-amber-400' : 'bg-emerald-500'
}
