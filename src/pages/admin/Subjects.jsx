import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useSubjects } from '../../lib/useSubjects'
import { PageHeader, Notice, Empty, Modal, inputCls, btnDark, btnGhost, btnDanger, useConfirm } from '../../components/ui'

// A flat, admin-managed list (anatomy, physiology, pharmacology, ...). Leads pick from this
// list on every question instead of typing a free-text tag, so names stay consistent.
export default function Subjects() {
  const sub = useSubjects()
  const [confirmDialog, askConfirm] = useConfirm()
  const [msg, setMsg] = useState({ text: '', tone: 'ok' })
  const [dlg, setDlg] = useState(null) // {kind:'add'|'rename', row?}
  const [name, setName] = useState('')
  const fail = (e) => setMsg({ text: e.message, tone: 'error' })

  // Keeps the page from jumping back to the top after every reorder/edit
  // (each one reloads the whole list from scratch).
  async function reloadKeepScroll() {
    const y = window.scrollY
    await sub.reload()
    requestAnimationFrame(() => window.scrollTo(0, y))
  }

  async function run(p, ok) {
    const { error } = await p
    if (error) return fail(error)
    if (ok) setMsg({ text: ok, tone: 'ok' })
    await reloadKeepScroll()
  }

  async function shift(row, dir) {
    const rows = sub.rows
    const i = rows.findIndex((r) => r.id === row.id)
    const j = i + dir
    if (j < 0 || j >= rows.length) return
    const order = [...rows]
    ;[order[i], order[j]] = [order[j], order[i]]
    const results = await Promise.all(order.map((r, k) => supabase.from('subjects').update({ sort_order: k }).eq('id', r.id)))
    const bad = results.find((r) => r.error)
    if (bad) fail(bad.error)
    await reloadKeepScroll()
  }

  async function submit(e) {
    e.preventDefault()
    if (dlg.kind === 'add') {
      await run(supabase.from('subjects').insert({ name: name.trim(), sort_order: sub.rows.length }), 'Added')
    } else {
      await run(supabase.from('subjects').update({ name: name.trim() }).eq('id', dlg.row.id), 'Renamed')
    }
    setDlg(null)
  }

  async function del(row) {
    const ok = await askConfirm(`Delete "${row.name}"? Questions using it keep their other details but lose this subject.`)
    if (!ok) return
    run(supabase.from('subjects').delete().eq('id', row.id), 'Deleted')
  }

  return (
    <div>
      <PageHeader title="Subjects" actions={<button className={btnDark} onClick={() => { setName(''); setDlg({ kind: 'add' }) }}>Add subject</button>}>
        The subjects leads choose from when writing a question — anatomy, physiology, pharmacology and so on. Keeping this as a managed list (rather than free text) stops names drifting into "Anatomy", "anatomy" and "Anat".
      </PageHeader>
      <Notice tone={msg.tone} onClose={() => setMsg({ text: '' })}>{msg.text}</Notice>
      <Notice tone="error">{sub.error}</Notice>
      {sub.loading && <p className="text-sm text-stone-400">Loading…</p>}
      {!sub.loading && sub.rows.length === 0 && <Empty>No subjects yet. Add the first one.</Empty>}
      <ul className="rounded-2xl border border-stone-200 bg-white p-2">
        {sub.rows.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center gap-2 rounded-xl px-2 py-2 hover:bg-stone-50">
            <span className="min-w-0 flex-1 truncate text-sm">{r.name}</span>
            <div className="flex flex-wrap gap-1">
              <button type="button" className={btnGhost} onClick={() => shift(r, -1)} aria-label="Move up">↑</button>
              <button type="button" className={btnGhost} onClick={() => shift(r, 1)} aria-label="Move down">↓</button>
              <button type="button" className={btnGhost} onClick={() => { setName(r.name); setDlg({ kind: 'rename', row: r }) }}>Rename</button>
              <button type="button" className={btnDanger} onClick={() => del(r)}>Delete</button>
            </div>
          </li>
        ))}
      </ul>

      {dlg && (
        <Modal title={dlg.kind === 'add' ? 'Add subject' : 'Rename subject'} onClose={() => setDlg(null)}>
          <form onSubmit={submit} className="space-y-3">
            <input className={inputCls} autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Pharmacology" required maxLength={80} />
            <button className={`${btnDark} w-full`}>Save</button>
          </form>
        </Modal>
      )}
      {confirmDialog}
    </div>
  )
}
