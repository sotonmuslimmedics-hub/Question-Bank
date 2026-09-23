// Minimal CSV parser: handles quoted fields, escaped quotes ("") and newlines inside quotes.
export function parseCsv(text) {
  const rows = []
  let row = []
  let field = ''
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++ }
      else if (c === '"') inQuotes = false
      else field += c
    } else if (c === '"') inQuotes = true
    else if (c === ',') { row.push(field); field = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(field); field = ''
      if (row.some((f) => f.trim() !== '')) rows.push(row)
      row = []
    } else field += c
  }
  row.push(field)
  if (row.some((f) => f.trim() !== '')) rows.push(row)
  return rows
}

// Expected header: stem,option_a,option_b,option_c,option_d,option_e,correct,explanation
// "correct" is a letter (A-E). Empty option columns are ignored.
export function csvToQuestions(text) {
  const rows = parseCsv(text)
  if (rows.length < 2) throw new Error('The file needs a header row and at least one question.')
  const header = rows[0].map((h) => h.trim().toLowerCase())
  const col = (name) => header.indexOf(name)
  const required = ['stem', 'option_a', 'option_b', 'correct']
  for (const r of required) if (col(r) === -1) throw new Error(`Missing column: ${r}`)
  const optionCols = ['option_a', 'option_b', 'option_c', 'option_d', 'option_e', 'option_f', 'option_g', 'option_h'].filter((n) => col(n) !== -1)

  return rows.slice(1).map((r, idx) => {
    const line = idx + 2
    const stem = (r[col('stem')] || '').trim()
    const options = optionCols.map((n) => (r[col(n)] || '').trim()).filter(Boolean)
    const letter = (r[col('correct')] || '').trim().toUpperCase()
    const correct = 'ABCDEFGH'.indexOf(letter)
    if (!stem) throw new Error(`Row ${line}: missing question text`)
    if (options.length < 2) throw new Error(`Row ${line}: needs at least two options`)
    if (correct < 0 || correct >= options.length) throw new Error(`Row ${line}: "correct" must be a letter matching one of the options`)
    return { stem, options, correct_option: correct, explanation: col('explanation') === -1 ? null : (r[col('explanation')] || '').trim() || null }
  })
}
