import { parseCsv } from './csv'
import { normalise } from './answers'

const LEVELS = ['year', 'module', 'topic', 'subtopic']

const DIFF = { easy: 1, easier: 1, '1': 1, medium: 2, moderate: 2, '2': 2, hard: 3, harder: 3, '3': 3 }

function headerIndex(rows) {
  const header = rows[0].map((h) => h.trim().toLowerCase().replace(/[\s-]+/g, '_'))
  const find = (...names) => {
    for (const n of names) {
      const i = header.indexOf(n)
      if (i !== -1) return i
    }
    return -1
  }
  return { header, find }
}

function pathFrom(r, find) {
  return LEVELS.map((l) => (r[find(l)] ?? '').trim()).filter(Boolean)
}

function common(r, find) {
  const d = (r[find('difficulty')] ?? '').trim().toLowerCase()
  const status = (r[find('status')] ?? '').trim().toLowerCase()
  return {
    explanation: (r[find('explanation', 'rationale')] ?? '').trim() || null,
    difficulty: DIFF[d] ?? null,
    author_name: (r[find('author')] ?? '').trim() || null,
    published: status === 'published' || status === 'live',
  }
}

// Multiple-choice rows. Expected columns (any order, extra columns ignored):
// year, module, topic, subtopic (all optional), question, a-e (or option_a..), correct, explanation, difficulty, author, status
export function parseMcq(text) {
  const rows = parseCsv(text)
  if (rows.length < 2) throw new Error('The file needs a header row and at least one question.')
  const { find } = headerIndex(rows)
  const qi = find('question', 'stem')
  if (qi === -1) throw new Error('Missing a "question" column.')
  const letters = 'abcdefgh'
  const optIdx = [...letters].map((l) => find(l, `option_${l}`)).filter((i) => i !== -1)
  if (optIdx.length < 2) throw new Error('Missing option columns (a, b, c, d, e).')
  const ci = find('correct', 'answer', 'correct_answer')
  if (ci === -1) throw new Error('Missing a "correct" column.')

  const out = []
  const errors = []
  const seen = new Set()
  let dupes = 0
  rows.slice(1).forEach((r, idx) => {
    const line = idx + 2
    const stem = (r[qi] ?? '').trim()
    if (!stem) return
    const raw = optIdx.map((i) => (r[i] ?? '').trim())
    const options = raw.filter(Boolean)
    const rawCorrect = (r[ci] ?? '').trim()
    let correct = -1
    if (/^[a-h]$/i.test(rawCorrect)) {
      const col = letters.indexOf(rawCorrect.toLowerCase())
      // position among the filled options, so blank columns don't shift the answer
      correct = raw[col] ? raw.slice(0, col).filter(Boolean).length : -1
    } else if (rawCorrect) {
      correct = options.findIndex((o) => normalise(o) === normalise(rawCorrect))
    }
    if (options.length < 2) return errors.push(`Row ${line}: needs at least two options`)
    if (correct < 0) return errors.push(`Row ${line}: could not tell which option is correct ("${rawCorrect}")`)
    const path = pathFrom(r, find)
    const key = normalise(stem) + '|' + path.join('/').toLowerCase()
    if (seen.has(key)) return dupes++
    seen.add(key)
    out.push({ line, path, stem, options, correct_option: correct, ...common(r, find) })
  })
  return { rows: out, errors, dupes }
}

// Photo-station rows: year, module, topic, subtopic, prompt/question, q1, a1, q2, a2, image_url (optional), explanation...
// Answers may hold several accepted answers separated by ; or /
export function parsePractical(text) {
  const rows = parseCsv(text)
  if (rows.length < 2) throw new Error('The file needs a header row and at least one question.')
  const { find } = headerIndex(rows)
  const pi = find('prompt', 'stem', 'question', 'station')
  const q1 = find('q1', 'question_1', 'part_1', 'part1')
  const a1 = find('a1', 'answer_1', 'answer1')
  const q2 = find('q2', 'question_2', 'part_2', 'part2')
  const a2 = find('a2', 'answer_2', 'answer2')
  if (q1 === -1 || a1 === -1) throw new Error('Missing q1 / a1 columns.')
  const ui = find('image_url', 'image', 'photo', 'url')
  const out = []
  const errors = []
  rows.slice(1).forEach((r, idx) => {
    const line = idx + 2
    const acc = (s) => (s ?? '').split(/[;\n]|\s\/\s/).map((x) => x.trim()).filter(Boolean)
    const parts = [
      { prompt: (r[q1] ?? '').trim(), accepted_answers: acc(r[a1]) },
      q2 !== -1 ? { prompt: (r[q2] ?? '').trim(), accepted_answers: acc(r[a2]) } : null,
    ].filter((p) => p && p.prompt)
    if (!parts.length) return
    if (parts.some((p) => !p.accepted_answers.length)) return errors.push(`Row ${line}: a part has no answer`)
    out.push({
      line,
      path: pathFrom(r, find),
      stem: (pi !== -1 && (r[pi] ?? '').trim()) || 'What does this image show?',
      parts,
      source_url: ui !== -1 ? (r[ui] ?? '').trim() || null : null,
      ...common(r, find),
    })
  })
  return { rows: out, errors, dupes: 0 }
}

export const MCQ_TEMPLATE = 'year,module,topic,subtopic,question,a,b,c,d,e,correct,explanation,difficulty,author,status\n'
export const PRACTICAL_TEMPLATE = 'year,module,topic,subtopic,prompt,q1,a1,q2,a2,image_url,explanation\n'
