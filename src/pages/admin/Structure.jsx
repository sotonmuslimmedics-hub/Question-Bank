import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useSections } from '../../lib/useSections'
import { descendantIds } from '../../lib/sections'
import { PageHeader, Notice, Modal, inputCls, btnDark, btnGhost, btnDanger, Pill } from '../../components/ui'

// Any depth, any names. Levels aren't fixed: a committee can use Year > Module > Topic, or add/skip levels.
export default function Structure() {
  const sec = useSections()
  const [msg, setMsg] = useState({ text: '', tone: 'ok' })
  const [dlg, setDlg] = useState(null) // {kind:'add'|'rename'|'move', node?}
  const [name, setName] = useState('')
  const [parent, setParent] = useState('')
  const fail = (e) => setMsg({ text: e.message, tone: 'error' })

  // Reordering (and every other edit here) reloads the whole tree from
  // scratch, which was leaving the page scrolled back to the top each time —
  // jarring when you're working several levels deep in a long syllabus.
  // Reloading in place and restoring the scroll position keeps you where
  // you were.
  async function reloadKeepScroll() {
    const y = window.scrollY
    await sec.reload()
    requestAnimationFrame(() => window.scrollTo(0, y))
  }

  async function run(p, ok) {
    const { error } = await p
    if (error) return fail(error)
    if (ok) setMsg({ text: ok, tone: 'ok' })
    await reloadKeepScroll()
  }

  function siblingsOf(n) {
    return n.parent_id ? sec.nodes.get(n.parent_id)?.children || [] : sec.roots
  }

  async function shift(n, dir) {
    const sibs = siblingsOf(n)
    const i = sibs.findIndex((s) => s.id === n.id)
    const j = i + dir
    if (j < 0 || j >= sibs.length) return
    const order = [...sibs]
    ;[order[i], order[j]] = [order[j], order[i]]
    // renumber the whole sibling group so ties never leave the order ambiguous
    const results = await Promise.all(order.map((s, k) => supabase.from('sections').update({ sort_order: k }).eq('id', s.id)))
    const bad = results.find((r) => r.error)
    if (bad) fail(bad.error)
    await reloadKeepScroll()
  }

  async function submit(e) {
    e.preventDefault()
    const { kind, node } = dlg
    if (kind === 'add') {
      const sibs = node ? node.children : sec.roots
      await run(supabase.from('sections').insert({ name: name.trim(), parent_id: node?.id ?? null, sort_order: sibs.length, is_locked: true }), 'Added. It starts locked so students see "coming soon" until you unlock it.')
    } else if (kind === 'rename') {
      await run(supabase.from('sections').update({ name: name.trim() }).eq('id', node.id), 'Renamed')
    } else if (kind === 'move') {
      await run(supabase.from('sections').update({ parent_id: parent || null }).eq('id', node.id), 'Moved')
    }
    setDlg(null)
  }

  async function del(n) {
    if (!confirm(`Delete "${n.name}"${n.children.length ? ' and everything under it' : ''}? This is blocked while any questions are inside.`)) return
    run(supabase.from('sections').delete().eq('id', n.id), 'Deleted')
  }

  function Row({ n, depth }) {
    return (
      <li>
        <div className="flex flex-wrap items-center gap-2 rounded-xl px-2 py-2 hover:bg-stone-50" style={{ marginLeft: depth * 16 }}>
          <span className={`min-w-0 flex-1 truncate text-sm ${depth === 0 ? 'font-semibold' : ''}`}>{n.name}</span>
          {n.is_locked && <Pill tone="amber">Locked</Pill>}
          {n.is_hidden && <Pill>Hidden</Pill>}
          <div className="flex flex-wrap gap-1">
            <button type="button" className={btnGhost} onClick={() => shift(n, -1)} aria-label="Move up">↑</button>
            <button type="button" className={btnGhost} onClick={() => shift(n, 1)} aria-label="Move down">↓</button>
            <button type="button" className={btnGhost} onClick={() => { setName(''); setDlg({ kind: 'add', node: n }) }}>+ Child</button>
            <button type="button" className={btnGhost} onClick={() => { setName(n.name); setDlg({ kind: 'rename', node: n }) }}>Rename</button>
            <button type="button" className={btnGhost} onClick={() => { setParent(n.parent_id || ''); setDlg({ kind: 'move', node: n }) }}>Move</button>
            <button type="button" className={btnGhost} onClick={() => run(supabase.from('sections').update({ is_locked: !n.is_locked }).eq('id', n.id))}>{n.is_locked ? 'Unlock' : 'Lock'}</button>
            <button type="button" className={btnGhost} onClick={() => run(supabase.from('sections').update({ is_hidden: !n.is_hidden }).eq('id', n.id))}>{n.is_hidden ? 'Show' : 'Hide'}</button>
            <button type="button" className={btnDanger} onClick={() => del(n)}>Delete</button>
          </div>
        </div>
        {n.children.length > 0 && <ul>{n.children.map((c) => <Row key={c.id} n={c} depth={depth + 1} />)}</ul>}
      </li>
    )
  }

  const blocked = dlg?.kind === 'move' ? new Set(descendantIds(dlg.node)) : new Set()

  return (
    <div>
      <PageHeader title="Structure" actions={<button className={btnDark} onClick={() => { setName(''); setDlg({ kind: 'add' }) }}>Add top-level section</button>}>
        Shape the syllabus however you like: rename things, add levels, reorder, or move a topic to another module. Locked sections show as "coming soon". Hidden ones disappear for students.
      </PageHeader>
      <Notice tone={msg.tone} onClose={() => setMsg({ text: '' })}>{msg.text}</Notice>
      <Notice tone="error">{sec.error}</Notice>
      {sec.loading && <p className="text-sm text-stone-400">Loading…</p>}
      <ul className="rounded-2xl border border-stone-200 bg-white p-2">
        {sec.roots.map((r) => <Row key={r.id} n={r} depth={0} />)}
      </ul>

      {dlg && (
        <Modal title={dlg.kind === 'add' ? (dlg.node ? `Add under "${dlg.node.name}"` : 'Add top-level section') : dlg.kind === 'rename' ? 'Rename' : `Move "${dlg.node.name}"`} onClose={() => setDlg(null)}>
          <form onSubmit={submit} className="space-y-3">
            {dlg.kind === 'move' ? (
              <select className={inputCls} value={parent} onChange={(e) => setParent(e.target.value)}>
                <option value="">Top level</option>
                {sec.flat.filter((s) => !blocked.has(s.id)).map((s) => <option key={s.id} value={s.id}>{s.pathLabel}</option>)}
              </select>
            ) : (
              <input className={inputCls} autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" required maxLength={120} />
            )}
            <button className={`${btnDark} w-full`}>Save</button>
          </form>
        </Modal>
      )}
    </div>
  )
}
