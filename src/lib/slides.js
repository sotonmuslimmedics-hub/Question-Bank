import { imageUrl } from './images'

const LETTERS = 'ABCDEFGH'
const INK = '1C1917'
const BRAND = '4F46E5'
const MUTED = '78716C'

async function toDataUrl(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error('Could not load a question photo for the slides.')
  const blob = await res.blob()
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result)
    r.onerror = reject
    r.readAsDataURL(blob)
  })
}

async function imageSize(dataUrl) {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight })
    img.onerror = () => resolve({ w: 4, h: 3 })
    img.src = dataUrl
  })
}

// Fits an image inside a box, centred.
function fit(size, box) {
  const s = Math.min(box.w / size.w, box.h / size.h)
  const w = size.w * s
  const h = size.h * s
  return { x: box.x + (box.w - w) / 2, y: box.y + (box.h - h) / 2, w, h }
}

/**
 * Builds and downloads a .pptx.
 * options: { title, subtitle, answers: 'after'|'none', explanations: boolean, pathOf: (q)=>string }
 * questions: rows shaped like the questions table plus question_parts.
 */
export async function makeSlides(questions, options = {}) {
  const { default: PptxGenJS } = await import('pptxgenjs')
  const { title = 'Teaching session', subtitle = '', answers = 'after', explanations = true, pathOf } = options
  const pptx = new PptxGenJS()
  pptx.layout = 'LAYOUT_WIDE' // 13.33 x 7.5 in
  pptx.title = title

  const title1 = pptx.addSlide()
  title1.background = { color: INK }
  title1.addText(title, { x: 0.8, y: 2.4, w: 11.7, h: 1.4, fontSize: 40, bold: true, color: 'FFFFFF', fontFace: 'Calibri' })
  if (subtitle) title1.addText(subtitle, { x: 0.8, y: 3.9, w: 11.7, h: 0.8, fontSize: 20, color: 'D6D3D1', fontFace: 'Calibri' })
  title1.addText(`${questions.length} question${questions.length === 1 ? '' : 's'}`, { x: 0.8, y: 6.4, w: 6, h: 0.5, fontSize: 14, color: 'A8A29E' })

  for (let n = 0; n < questions.length; n++) {
    const q = questions[n]
    const parts = [...(q.question_parts || [])].sort((a, b) => a.part_number - b.part_number)
    const label = `Question ${n + 1}`
    const where = pathOf ? pathOf(q) : ''
    const isStation = q.question_type === 'station'
    let img = null
    if (isStation && q.image_path) {
      const data = await toDataUrl(imageUrl(q.image_path))
      img = { data, size: await imageSize(data) }
    }

    const header = (s, tag) => {
      s.background = { color: 'FFFFFF' }
      s.addShape('rect', { x: 0, y: 0, w: 13.33, h: 0.12, fill: { color: BRAND } })
      s.addText(`${label}${tag ? ' · ' + tag : ''}`, { x: 0.6, y: 0.3, w: 8, h: 0.4, fontSize: 14, bold: true, color: BRAND })
      if (where) s.addText(where, { x: 6, y: 0.3, w: 6.8, h: 0.4, fontSize: 11, color: MUTED, align: 'right' })
    }

    const build = (showAnswer) => {
      const s = pptx.addSlide()
      header(s, showAnswer ? 'Answer' : '')
      if (!isStation) {
        s.addText(q.stem, { x: 0.6, y: 0.9, w: 12.1, h: 2, fontSize: 24, color: INK, valign: 'top', fit: 'shrink' })
        const opts = q.options || []
        opts.forEach((o, i) => {
          const right = showAnswer && i === q.correct_option
          s.addText(`${LETTERS[i]}.  ${o}`, {
            x: 0.6, y: 3 + i * 0.75, w: 12.1, h: 0.65, fontSize: 20, valign: 'middle', margin: [0, 12, 0, 12],
            color: right ? 'FFFFFF' : INK,
            fill: { color: right ? '059669' : 'F5F5F4' },
            bold: right,
          })
        })
        if (showAnswer && explanations && q.explanation) {
          s.addText(q.explanation, { x: 0.6, y: 3 + opts.length * 0.75 + 0.1, w: 12.1, h: 0.9, fontSize: 14, italic: true, color: MUTED, fit: 'shrink', valign: 'top' })
        }
      } else {
        s.addText(q.stem, { x: 0.6, y: 0.85, w: 12.1, h: 0.9, fontSize: 20, color: INK, valign: 'top', fit: 'shrink' })
        if (img) {
          const box = fit(img.size, { x: 0.6, y: 1.8, w: 7.2, h: 5.2 })
          s.addImage({ data: img.data, ...box })
        }
        const lines = []
        parts.forEach((p, i) => {
          lines.push({ text: `${i + 1}. ${p.prompt}`, options: { bold: true, fontSize: 18, color: INK, breakLine: true } })
          if (showAnswer) lines.push({ text: (p.accepted_answers || [])[0] || '', options: { fontSize: 18, color: '059669', bold: true, breakLine: true } })
          lines.push({ text: ' ', options: { fontSize: 8, breakLine: true } })
        })
        s.addText(lines, { x: 8.1, y: 1.8, w: 4.7, h: 5, valign: 'top', fit: 'shrink' })
        if (showAnswer && explanations && q.explanation) {
          s.addText(q.explanation, { x: 0.6, y: 6.9, w: 12.1, h: 0.5, fontSize: 12, italic: true, color: MUTED, fit: 'shrink' })
        }
      }
      return s
    }

    build(false)
    if (answers === 'after') build(true)
  }

  const safe = title.replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-') || 'teaching-slides'
  await pptx.writeFile({ fileName: `${safe}.pptx` })
}
