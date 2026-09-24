import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { ROLES } from '../../config'
import { PageHeader, Notice, inputCls, btnGhost, card } from '../../components/ui'
import { fetchAll } from '../../lib/sections'

export default function People() {
  const { user } = useAuth()
  const [people, setPeople] = useState([])
  const [domains, setDomains] = useState([])
  const [newDomain, setNewDomain] = useState('')
  const [search, setSearch] = useState('')
  const [role, setRole] = useState('all')
  const [msg, setMsg] = useState({ text: '', tone: 'ok' })

  async function load() {
    const [p, d] = await Promise.all([
      fetchAll(() => supabase.from('profiles').select('id,email,full_name,role,created_at').order('created_at', { ascending: false })),
      supabase.from('allowed_email_domains').select('domain').order('domain'),
    ])
    setPeople(p)
    setDomains(d.data || [])
  }
  useEffect(() => { load().catch((e) => setMsg({ text: e.message, tone: 'error' })) }, [])

  async function changeRole(p, newRole) {
    const { error } = await supabase.rpc('set_role', { target: p.id, new_role: newRole })
    setMsg(error ? { text: error.message, tone: 'error' } : { text: `${p.email} is now ${ROLES.find((r) => r.value === newRole).label.toLowerCase()}`, tone: 'ok' })
    load()
  }

  async function addDomain() {
    const d = newDomain.trim().toLowerCase().replace(/^@/, '')
    if (!d) return
    const { error } = await supabase.from('allowed_email_domains').insert({ domain: d })
    setMsg(error ? { text: error.message, tone: 'error' } : { text: 'Domain added', tone: 'ok' })
    setNewDomain('')
    load()
  }

  async function removeDomain(domain) {
    const { error } = await supabase.from('allowed_email_domains').delete().eq('domain', domain)
    setMsg(error ? { text: error.message, tone: 'error' } : { text: domains.length === 1 ? 'Domain removed. Sign-up is now open to any email address.' : 'Domain removed', tone: 'ok' })
    load()
  }

  const shown = people.filter((p) => (role === 'all' || p.role === role) && `${p.email} ${p.full_name}`.toLowerCase().includes(search.toLowerCase()))

  return (
    <div>
      <PageHeader title="People">Give people roles and control which email domains can sign up.</PageHeader>
      <Notice tone={msg.tone} onClose={() => setMsg({ text: '' })}>{msg.text}</Notice>

      <section className={`${card} mb-5`}>
        <h2 className="font-semibold">Roles</h2>
        <ul className="mt-1 space-y-0.5 text-xs text-stone-500">
          {ROLES.map((r) => <li key={r.value}><b className="text-stone-700">{r.label}</b> · {r.help}</li>)}
        </ul>
      </section>

      <section className={`${card} mb-5`}>
        <h2 className="font-semibold">Allowed sign-up domains</h2>
        <p className="text-xs text-stone-500">If this list is empty, anyone can sign up with any email address.</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {domains.map((d) => (
            <span key={d.domain} className="flex items-center gap-2 rounded-full bg-stone-100 px-3 py-1 text-sm">
              @{d.domain}
              <button onClick={() => removeDomain(d.domain)} className="text-stone-400 hover:text-red-600" aria-label={`Remove ${d.domain}`}>×</button>
            </span>
          ))}
        </div>
        <div className="mt-3 flex gap-2">
          <input className={`${inputCls} flex-1`} placeholder="e.g. soton.ac.uk" value={newDomain} onChange={(e) => setNewDomain(e.target.value)} />
          <button className={btnGhost} onClick={addDomain}>Add</button>
        </div>
      </section>

      <div className="mb-3 flex gap-2">
        <input className={`${inputCls} flex-1`} placeholder="Search name or email" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className={`${inputCls} !w-auto`} value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="all">All roles</option>
          {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
      </div>
      <ul className="divide-y divide-stone-100 rounded-2xl border border-stone-200 bg-white">
        {shown.map((p) => (
          <li key={p.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium">{p.full_name || '—'}</div>
              <div className="truncate text-xs text-stone-500">{p.email}</div>
            </div>
            <select className={`${inputCls} !w-auto !py-1.5`} value={p.role} disabled={p.id === user?.id} onChange={(e) => changeRole(p, e.target.value)} aria-label={`Role for ${p.email}`}>
              {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </li>
        ))}
        {!shown.length && <li className="px-4 py-3 text-sm text-stone-400">No one found.</li>}
      </ul>
    </div>
  )
}
