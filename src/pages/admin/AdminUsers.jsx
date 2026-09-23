import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'

const btn = 'rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium hover:bg-slate-50'
const input = 'rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none'

export default function AdminUsers() {
  const { user } = useAuth()
  const [people, setPeople] = useState([])
  const [domains, setDomains] = useState([])
  const [newDomain, setNewDomain] = useState('')
  const [search, setSearch] = useState('')
  const [msg, setMsg] = useState('')

  async function load() {
    const [p, d] = await Promise.all([
      supabase.from('profiles').select('id,email,full_name,is_admin,created_at').order('created_at', { ascending: false }),
      supabase.from('allowed_email_domains').select('domain').order('domain'),
    ])
    setPeople(p.data || [])
    setDomains(d.data || [])
  }
  useEffect(() => { load() }, [])

  async function toggleAdmin(p) {
    const { error } = await supabase.rpc('set_admin', { target: p.id, make_admin: !p.is_admin })
    setMsg(error ? `Error: ${error.message}` : `${p.email} is ${p.is_admin ? 'no longer' : 'now'} an admin`)
    load()
  }

  async function addDomain() {
    const d = newDomain.trim().toLowerCase().replace(/^@/, '')
    if (!d) return
    const { error } = await supabase.from('allowed_email_domains').insert({ domain: d })
    setMsg(error ? `Error: ${error.message}` : 'Domain added')
    setNewDomain('')
    load()
  }

  async function removeDomain(domain) {
    const { error } = await supabase.from('allowed_email_domains').delete().eq('domain', domain)
    setMsg(error ? `Error: ${error.message}` : domains.length === 1 ? 'Domain removed — sign-up is now open to any email address' : 'Domain removed')
    load()
  }

  const shown = people.filter((p) => `${p.email} ${p.full_name}`.toLowerCase().includes(search.toLowerCase()))

  return (
    <div>
      <h1 className="text-2xl font-bold">Admins and sign-up</h1>
      <p className="mt-1 text-slate-500">Choose who can manage the question bank, and which email domains can sign up.</p>
      {msg && <p className="mt-3 rounded-lg bg-slate-100 px-3 py-2 text-sm">{msg}</p>}

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="font-semibold">Allowed sign-up domains</h2>
        <p className="text-xs text-slate-500">If this list is empty, anyone with any email address can sign up.</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {domains.map((d) => (
            <span key={d.domain} className="flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-sm">
              @{d.domain}
              <button onClick={() => removeDomain(d.domain)} className="text-slate-400 hover:text-red-600" aria-label={`Remove ${d.domain}`}>×</button>
            </span>
          ))}
        </div>
        <div className="mt-3 flex gap-2">
          <input className={`${input} flex-1`} placeholder="e.g. soton.ac.uk" value={newDomain} onChange={(e) => setNewDomain(e.target.value)} />
          <button className={btn} onClick={addDomain}>Add domain</button>
        </div>
      </section>

      <section className="mt-6">
        <input className={`${input} w-full`} placeholder="Search people by name or email" value={search} onChange={(e) => setSearch(e.target.value)} />
        <ul className="mt-3 divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white">
          {shown.map((p) => (
            <li key={p.id} className="flex items-center gap-3 px-4 py-3 text-sm">
              <div className="flex-1">
                <div className="font-medium">{p.full_name || '—'}</div>
                <div className="text-xs text-slate-500">{p.email}</div>
              </div>
              {p.is_admin && <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">Admin</span>}
              <button className={btn} disabled={p.id === user?.id} onClick={() => toggleAdmin(p)}>
                {p.is_admin ? 'Remove admin' : 'Make admin'}
              </button>
            </li>
          ))}
          {shown.length === 0 && <li className="px-4 py-3 text-sm text-slate-400">No one found.</li>}
        </ul>
      </section>
    </div>
  )
}
