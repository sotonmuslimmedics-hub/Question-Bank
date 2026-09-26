import { useEffect, useRef, useState } from 'react'
import { btnDark, btnGhost } from './ui'

const TOOLS = [
  ['freehand', '✎', 'Freehand'],
  ['arrow', '↗', 'Arrow'],
  ['circle', '◯', 'Circle'],
  ['text', 'T', 'Text'],
]
const COLORS = ['#ef4444', '#facc15', '#3b82f6', '#18181b', '#ffffff']
// Large pasted images (e.g. retina screenshots) can exceed the canvas pixel
// limits some mobile browsers allow, which blanks the whole page instead of
// erroring. Cap the working canvas to a safe max dimension.
const MAX_DIM = 2000

// Draws one committed shape (or the in-progress one) onto the canvas.
function drawShape(ctx, shape, lineWidth) {
  ctx.strokeStyle = shape.color
  ctx.fillStyle = shape.color
  ctx.lineWidth = lineWidth
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  if (shape.type === 'freehand') {
    if (shape.points.length < 2) return
    ctx.beginPath()
    ctx.moveTo(shape.points[0].x, shape.points[0].y)
    for (const p of shape.points.slice(1)) ctx.lineTo(p.x, p.y)
    ctx.stroke()
  } else if (shape.type === 'arrow') {
    const { x1, y1, x2, y2 } = shape
    ctx.beginPath()
    ctx.moveTo(x1, y1)
    ctx.lineTo(x2, y2)
    ctx.stroke()
    const angle = Math.atan2(y2 - y1, x2 - x1)
    const head = Math.max(10, lineWidth * 4)
    ctx.beginPath()
    ctx.moveTo(x2, y2)
    ctx.lineTo(x2 - head * Math.cos(angle - Math.PI / 7), y2 - head * Math.sin(angle - Math.PI / 7))
    ctx.moveTo(x2, y2)
    ctx.lineTo(x2 - head * Math.cos(angle + Math.PI / 7), y2 - head * Math.sin(angle + Math.PI / 7))
    ctx.stroke()
  } else if (shape.type === 'circle') {
    const cx = (shape.x1 + shape.x2) / 2
    const cy = (shape.y1 + shape.y2) / 2
    const rx = Math.abs(shape.x2 - shape.x1) / 2
    const ry = Math.abs(shape.y2 - shape.y1) / 2
    if (rx < 1 || ry < 1) return
    ctx.beginPath()
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2)
    ctx.stroke()
  } else if (shape.type === 'text') {
    ctx.font = `${Math.max(16, lineWidth * 8)}px ui-sans-serif, system-ui, sans-serif`
    ctx.textBaseline = 'top'
    ctx.fillText(shape.text, shape.x, shape.y)
  }
}

// A small canvas-based markup tool: freehand pen, arrow, hollow circle, and text,
// laid over a picture the user just pasted, dropped, or chose. Flattens to a PNG on Done.
export default function ImageAnnotator({ src, onDone, onCancel }) {
  const canvasRef = useRef(null)
  const wrapRef = useRef(null)
  const imgRef = useRef(null)
  const [tool, setTool] = useState('freehand')
  const [color, setColor] = useState(COLORS[0])
  const [shapes, setShapes] = useState([])
  const [ready, setReady] = useState(false)
  const drawingRef = useRef(null) // shape in progress
  const [, forceRedraw] = useState(0)
  const [textInput, setTextInput] = useState(null) // {x, y, clientX, clientY, value}

  const lineWidth = () => {
    const c = canvasRef.current
    return c ? Math.max(3, Math.round(c.width / 260)) : 4
  }

  const redraw = () => {
    const canvas = canvasRef.current
    const img = imgRef.current
    if (!canvas || !img) return
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    const lw = lineWidth()
    for (const s of shapes) drawShape(ctx, s, lw)
    if (drawingRef.current) drawShape(ctx, drawingRef.current, lw)
  }

  useEffect(() => {
    const img = new Image()
    img.onload = () => {
      imgRef.current = img
      const canvas = canvasRef.current
      const scale = Math.min(1, MAX_DIM / Math.max(img.naturalWidth, img.naturalHeight))
      canvas.width = Math.round(img.naturalWidth * scale)
      canvas.height = Math.round(img.naturalHeight * scale)
      setReady(true)
    }
    img.src = src
  }, [src])

  useEffect(() => { if (ready) redraw() })

  function toCanvasPoint(e) {
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY }
  }

  function onPointerDown(e) {
    if (!ready) return
    const p = toCanvasPoint(e)
    if (tool === 'text') {
      const rect = canvasRef.current.getBoundingClientRect()
      setTextInput({ x: p.x, y: p.y, clientX: e.clientX - rect.left, clientY: e.clientY - rect.top, value: '' })
      return
    }
    canvasRef.current.setPointerCapture(e.pointerId)
    if (tool === 'freehand') drawingRef.current = { type: 'freehand', color, points: [p] }
    else drawingRef.current = { type: tool, color, x1: p.x, y1: p.y, x2: p.x, y2: p.y }
    forceRedraw((n) => n + 1)
  }

  function onPointerMove(e) {
    if (!drawingRef.current) return
    const p = toCanvasPoint(e)
    if (drawingRef.current.type === 'freehand') drawingRef.current.points.push(p)
    else {
      drawingRef.current.x2 = p.x
      drawingRef.current.y2 = p.y
    }
    redraw()
  }

  function onPointerUp() {
    if (!drawingRef.current) return
    setShapes((s) => [...s, drawingRef.current])
    drawingRef.current = null
  }

  function commitText() {
    if (textInput && textInput.value.trim()) {
      setShapes((s) => [...s, { type: 'text', color, x: textInput.x, y: textInput.y, text: textInput.value.trim() }])
    }
    setTextInput(null)
  }

  function undo() {
    setShapes((s) => s.slice(0, -1))
  }

  function clearAll() {
    setShapes([])
  }

  function done() {
    redraw()
    canvasRef.current.toBlob((blob) => {
      if (blob) onDone(blob)
    }, 'image/png')
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {TOOLS.map(([id, icon, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTool(id)}
            title={label}
            className={`grid h-9 w-9 place-items-center rounded-lg border text-base font-semibold ${tool === id ? 'border-stone-900 bg-stone-900 text-white' : 'border-stone-300 bg-white hover:bg-stone-50'}`}
          >
            {icon}
          </button>
        ))}
        <div className="mx-1 h-6 w-px bg-stone-200" />
        {COLORS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setColor(c)}
            aria-label={`Colour ${c}`}
            className={`h-7 w-7 rounded-full border-2 ${color === c ? 'border-stone-900' : 'border-stone-200'}`}
            style={{ backgroundColor: c }}
          />
        ))}
        <div className="mx-1 h-6 w-px bg-stone-200" />
        <button type="button" className={btnGhost} onClick={undo} disabled={!shapes.length}>Undo</button>
        <button type="button" className={btnGhost} onClick={clearAll} disabled={!shapes.length}>Clear</button>
      </div>

      <div ref={wrapRef} className="relative overflow-auto rounded-xl border border-stone-200 bg-stone-100" style={{ maxHeight: '60vh' }}>
        <canvas
          ref={canvasRef}
          className="max-w-full touch-none"
          style={{ display: ready ? 'block' : 'none' }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
        />
        {!ready && <p className="p-8 text-center text-sm text-stone-400">Loading image…</p>}
        {textInput && (
          <input
            autoFocus
            value={textInput.value}
            onChange={(e) => setTextInput((t) => ({ ...t, value: e.target.value }))}
            onKeyDown={(e) => { if (e.key === 'Enter') commitText(); if (e.key === 'Escape') setTextInput(null) }}
            onBlur={commitText}
            placeholder="Label…"
            className="absolute z-10 rounded border-2 px-1 text-sm"
            style={{ left: textInput.clientX, top: textInput.clientY, borderColor: color, color, minWidth: 80 }}
          />
        )}
      </div>

      <p className="mt-2 text-xs text-stone-400">Pick a tool and colour, then draw directly on the image. Click with the text tool to drop a label.</p>

      <div className="mt-3 flex gap-2">
        <button type="button" className={btnDark} onClick={done} disabled={!ready}>Use this image</button>
        <button type="button" className={btnGhost} onClick={onCancel}>Cancel</button>
      </div>
    </div>
  )
}
