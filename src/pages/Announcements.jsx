import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { useAnnouncementReads } from '../lib/announcementReads'
import { PageHeader, Notice, Empty, Pill, Modal, inputCls, btnDark, btnGhost, btnDanger, card, useConfirm } from '../components/ui'

export function fmtDate(d) {
  return new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

// Lightweight formatting for announcements, without allowing arbitrary HTML:
//  - [link text](https://...)  -> a link with a friendly label, e.g. for a
//    tidy resource list ("Google Drive: Google Drive folder")
//  - **bold**                  -> emphasis, e.g. for a label before a link
//  - a bare http(s)/www. URL   -> auto-linked as-is, so pasting a plain link
//    still just works with no special syntax needed
function linkify(text) {
  const re = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|\*\*([^*]+)\*\*|(https?:\/\/[^\s]+|www\.[^\s]+)/g
  const nodes = []
  let lastIndex = 0
  let m
  let key = 0
  while ((m = re.exec(text))) {
    if (m.index > lastIndex) nodes.push(text.slice(lastIndex, m.index))
    if (m[1] !== undefined) {
      // [label](url)
      nodes.push(
        <a key={key++} href={m[2]} target="_blank" rel="noopener noreferrer" className="text-brand-700 underline break-all">
          {m[1]}
        </a>,
      )
    } else if (m[3] !== undefined) {
      // **bold**
      nodes.push(<strong key={key++}>{m[3]}</strong>)
    } else {
      // bare URL
      let url = m[4]
      // trailing punctuation is usually sentence punctuation, not part of the link
      const trailing = url.match(/[).,;:!?\]]+$/)?.[0] || ''
      if (trailing) url = url.slice(0, -trailing.length)
      const href = url.startsWith('www.') ? `https://${url}` : url
      nodes.push(
        <a key={key++} href={href} target="_blank" rel="noopener noreferrer" className="text-brand-700 underline break-all">
          {url}
        </a>,
      )
      if (trailing) nodes.push(trailing)
    }
    lastIndex = m.index + m[0].length
  }
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex))
  return nodes
}

export default function Announcements() {
  const { isLead, user } = useAuth()
  const { lastSeenAt, markSeen } = useAnnouncementReads() || {}
  const [confirmDialog, askConfirm] = useConfirm()
  const [rows, setRows] = useState(null)
  const [error, setError] = useState('')
  const [edit, setEdit] = useState(null) // {id?, title, body, pinned}
  const [linkForm, setLinkForm] = useState(null) // {text, url, pos}
  const bodyRef = useRef(null)

  function insertLink() {
    const text = linkForm.text.trim()
    let url = linkForm.url.trim()
    if (!text || !url) return
    if (!/^https?:\/\//.test(url)) url = `https://${url}` // leads often paste without the https://
    const md = `[${text}](${url})`
    const pos = linkForm.pos
    setEdit((e) => ({ ...e, body: e.body.slice(0, pos) + md + e.body.slice(pos) }))
    setLinkForm(null)
  }
  // Snapshot the "last seen" cutoff the moment we have it, so marking things seen
  // (which resets it to now) doesn't make the highlight disappear mid-visit.
  const seenAtRef = useRef(null)
  if (seenAtRef.current === null && lastSeenAt) seenAtRef.current = lastSeenAt

  async function load() {
    const { data, error } = await supabase.from('announcements').select('*').order('pinned', { ascending: false }).order('created_at', { ascending: false })
    if (error) setError(error.message)
    setRows(data || [])
  }
  useEffect(() => { load() }, [])

  // Once the page has rendered with the snapshot in hand, mark everything as seen.
  useEffect(() => {
    if (rows && lastSeenAt !== null && markSeen) markSeen()
  }, [rows, lastSeenAt, markSeen])

  async function save(e) {
    e.preventDefault()
    const payload = { title: edit.title.trim(), body: edit.body.trim(), pinned: !!edit.pinned }
    const { error } = edit.id
      ? await supabase.from('announcements').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', edit.id)
      : await supabase.from('announcements').insert({ ...payload, created_by: user.id })
    if (error) return setError(error.message)
    setEdit(null)
    load()
  }

  async function remove(id) {
    const ok = await askConfirm('Delete this announcement?')
    if (!ok) return
    const { error } = await supabase.from('announcements').delete().eq('id', id)
    if (error) setError(error.message)
    load()
  }

  return (
    <div>
      <PageHeader title="News" actions={isLead && <button className={btnDark} onClick={() => setEdit({ title: '', body: '', pinned: false })}>New announcement</button>}>
        Updates from the committee and academic leads.
      </PageHeader>
      <Notice tone="error" onClose={() => setError('')}>{error}</Notice>
      {rows && rows.length === 0 && <Empty>No announcements yet.</Empty>}
      <div className="space-y-3">
        {(rows || []).map((a) => {
          const isUnread = seenAtRef.current && new Date(a.created_at) > new Date(seenAtRef.current)
          return (
          <article key={a.id} className={`${card} ${isUnread ? 'border-brand-300 bg-brand-50/50 ring-1 ring-brand-200' : ''}`}>
            <div className="flex items-start justify-between gap-3">
              <h2 className="flex items-center gap-2 font-semibold">
                {a.title}
                {isUnread && <Pill tone="brand">New</Pill>}
              </h2>
              <div className="flex shrink-0 items-center gap-2">
                {a.pinned && <Pill tone="brand">Pinned</Pill>}
                <span className="text-xs text-stone-400">{fmtDate(a.created_at)}</span>
              </div>
            </div>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-stone-700">{linkify(a.body)}</p>
            {isLead && (
              <div className="mt-3 flex gap-2">
                <button className={btnGhost} onClick={() => setEdit(a)}>Edit</button>
                <button className={btnDanger} onClick={() => remove(a.id)}>Delete</button>
              </div>
            )}
          </article>
          )
        })}
      </div>

      {edit && (
        <Modal title={edit.id ? 'Edit announcement' : 'New announcement'} onClose={() => setEdit(null)}>
          <form onSubmit={save} className="space-y-3">
            <input className={inputCls} placeholder="Title" value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} required maxLength={120} />
            <textarea ref={bodyRef} className={inputCls} rows={6} placeholder="What do people need to know?" value={edit.body} onChange={(e) => setEdit({ ...edit, body: e.target.value })} required />
            <div className="flex items-center justify-between">
              <button
                type="button"
                className={btnGhost}
                onClick={() => setLinkForm({ text: '', url: '', pos: bodyRef.current?.selectionStart ?? edit.body.length })}
              >
                + Insert link
              </button>
              <p className="text-xs text-stone-400">A pasted link becomes clickable automatically too.</p>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={!!edit.pinned} onChange={(e) => setEdit({ ...edit, pinned: e.target.checked })} /> Pin to the top
            </label>
            <button className={`${btnDark} w-full`}>Save</button>
          </form>
        </Modal>
      )}
      {linkForm && (
        <Modal title="Insert link" onClose={() => setLinkForm(null)}>
          <div className="space-y-3">
            <label className="block text-sm font-medium">
              Link text <span className="font-normal text-stone-400">(what people see, e.g. "Google Drive folder")</span>
              <input
                className={`${inputCls} mt-1`}
                autoFocus
                value={linkForm.text}
                onChange={(e) => setLinkForm({ ...linkForm, text: e.target.value })}
              />
            </label>
            <label className="block text-sm font-medium">
              URL
              <input
                className={`${inputCls} mt-1`}
                placeholder="https://…"
                value={linkForm.url}
                onChange={(e) => setLinkForm({ ...linkForm, url: e.target.value })}
                onKeyDown={(e) => e.key === 'Enter' && insertLink()}
              />
            </label>
            <button type="button" className={`${btnDark} w-full`} disabled={!linkForm.text.trim() || !linkForm.url.trim()} onClick={insertLink}>
              Insert
            </button>
          </div>
        </Modal>
      )}
      {confirmDialog}
    </div>
  )
}
