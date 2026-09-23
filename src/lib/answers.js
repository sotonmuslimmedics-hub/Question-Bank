// Typed short answers are compared after tidying: lower case, no punctuation,
// single spaces. Students can still override the auto-check when they were right
// but worded it differently.
export function normalise(text) {
  return (text || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function checkAnswer(typed, accepted) {
  const t = normalise(typed)
  if (!t) return false
  return (accepted || []).some((a) => normalise(a) === t)
}

// Admin input: one accepted answer per line (or separated by semicolons).
export function parseAccepted(text) {
  return (text || '')
    .split(/[\n;]/)
    .map((s) => s.trim())
    .filter(Boolean)
}
