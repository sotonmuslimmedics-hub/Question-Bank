import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { useAnnouncementReads } from '../lib/announcementReads'
import { PageHeader, Notice, Empty, Pill, Modal, inputCls, btnDark, btnGhost, btnDanger, card, useConfirm } from '../components/ui'

export function fmtDate(d) {
  return new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function Announcements() {
  const { isLead, user } = useAuth()
  const { lastSeenAt, markSeen } = useAnnouncementReads() || {}
  const [confirmDialog, askConfirm] = useConfirm()
  const [rows, setRows] = useState(null)
  const [error, setError] = useState('')
  const [edit, setEdit] = useState(null) // {id?, title, body, pinned}
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
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-stone-700">{a.body}</p>
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
            <textarea className={inputCls} rows={6} placeholder="What do people need to know?" value={edit.body} onChange={(e) => setEdit({ ...edit, body: e.target.value })} required />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={!!edit.pinned} onChange={(e) => setEdit({ ...edit, pinned: e.target.checked })} /> Pin to the top
            </label>
            <button className={`${btnDark} w-full`}>Save</button>
          </form>
        </Modal>
      )}
      {confirmDialog}
    </div>
  )
}
