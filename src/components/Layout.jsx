import { useState } from 'react'
import { NavLink, Outlet, Link, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { useAnnouncementReads } from '../lib/announcementReads'
import { SITE_NAME, SHORT_NAME } from '../config'

// One list drives both the desktop top bar and the phone tab bar.
function useNav() {
  const { isTeacher, isLead, isAdmin } = useAuth()
  const items = [
    { to: '/', label: 'Home', icon: '⌂', end: true, primary: true },
    { to: '/practice', label: 'Practise', icon: '✎', primary: true },
    { to: '/tracker', label: 'Topics', icon: '✓', primary: true },
    { to: '/announcements', label: 'News', icon: '✉', primary: true },
  ]
  if (isTeacher) {
    items.push({ to: '/teach', label: 'Teach', icon: '▤', primary: true, group: 'Teaching' })
    items.push({ to: '/portfolio', label: 'Portfolio', icon: '☰', group: 'Teaching' })
  }
  if (isLead) {
    items.push({ to: '/manage/questions', label: 'Questions', icon: '?', group: 'Manage' })
    items.push({ to: '/manage/teaching', label: 'Teaching sessions', icon: '☑', group: 'Manage' })
  }
  if (isAdmin) {
    items.push({ to: '/manage/structure', label: 'Structure', icon: '⌥', group: 'Manage' })
    items.push({ to: '/manage/subjects', label: 'Subjects', icon: '§', group: 'Manage' })
    items.push({ to: '/manage/people', label: 'People', icon: '☺', group: 'Manage' })
    items.push({ to: '/manage/tools', label: 'Tools', icon: '⚙', group: 'Manage' })
  }
  return items
}

const desktopLink = ({ isActive }) =>
  `rounded-lg px-3 py-1.5 text-sm font-medium ${isActive ? 'bg-stone-900 text-white' : 'text-stone-600 hover:bg-stone-200'}`

export default function Layout() {
  const { profile, user, signOut, role } = useAuth()
  const items = useNav()
  const { unreadCount } = useAnnouncementReads() || {}
  const [more, setMore] = useState(false)
  const loc = useLocation()
  const tabs = items.filter((i) => i.primary)
  const rest = items.filter((i) => !i.primary)
  const showMore = rest.length > 0
  const moreActive = rest.some((i) => loc.pathname.startsWith(i.to))

  return (
    <div className="min-h-screen pb-20 sm:pb-0">
      <header className="sticky top-0 z-30 border-b border-stone-200 bg-paper/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2.5">
          <Link to="/" className="flex items-center gap-2 font-bold tracking-tight">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-stone-900 text-xs text-white">{SHORT_NAME}</span>
            <span className="hidden sm:inline">{SITE_NAME}</span>
          </Link>
          <nav className="ml-2 hidden flex-1 flex-wrap gap-1 sm:flex">
            {items.map((i) => (
              <NavLink key={i.to} to={i.to} end={i.end} className={desktopLink}>
                <span className="relative inline-flex items-center">
                  {i.label}
                  {i.to === '/announcements' && !!unreadCount && (
                    <span className="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-600 px-1 text-[10px] font-semibold text-white">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </span>
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3 text-sm sm:ml-0">
            <span className="hidden text-right leading-tight lg:block">
              <span className="block text-xs text-stone-500">{profile?.full_name || user?.email}</span>
              <span className="block text-[11px] uppercase tracking-wide text-stone-400">{role}</span>
            </span>
            <button onClick={signOut} className="rounded-lg border border-stone-300 px-3 py-1.5 text-xs font-medium hover:bg-stone-100">
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>

      {/* Phone tab bar */}
      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-stone-200 bg-white sm:hidden" aria-label="Main">
        <ul className="flex">
          {tabs.map((i) => (
            <li key={i.to} className="flex-1">
              <NavLink
                to={i.to}
                end={i.end}
                className={({ isActive }) =>
                  `flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${isActive ? 'text-brand-600' : 'text-stone-500'}`
                }
              >
                <span className="relative text-lg leading-none">
                  {i.icon}
                  {i.to === '/announcements' && !!unreadCount && (
                    <span className="absolute -right-1.5 -top-1 h-2 w-2 rounded-full bg-brand-600" />
                  )}
                </span>
                {i.label}
              </NavLink>
            </li>
          ))}
          {showMore && (
            <li className="flex-1">
              <button
                onClick={() => setMore(true)}
                className={`flex w-full flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${moreActive ? 'text-brand-600' : 'text-stone-500'}`}
              >
                <span className="text-lg leading-none">⋯</span>
                More
              </button>
            </li>
          )}
        </ul>
      </nav>

      {more && (
        <div className="fixed inset-0 z-40 flex items-end bg-black/40 sm:hidden" onClick={() => setMore(false)}>
          <div className="safe-bottom w-full rounded-t-3xl bg-white p-5" onClick={(e) => e.stopPropagation()}>
            {[...new Set(rest.map((i) => i.group))].map((g) => (
              <div key={g} className="mb-3">
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-stone-400">{g}</p>
                <div className="grid grid-cols-2 gap-2">
                  {rest
                    .filter((i) => i.group === g)
                    .map((i) => (
                      <Link
                        key={i.to}
                        to={i.to}
                        onClick={() => setMore(false)}
                        className="rounded-xl border border-stone-200 px-3 py-3 text-sm font-medium hover:bg-stone-50"
                      >
                        <span className="mr-2">{i.icon}</span>
                        {i.label}
                      </Link>
                    ))}
                </div>
              </div>
            ))}
            <p className="mt-2 truncate text-xs text-stone-400">{profile?.full_name || user?.email}</p>
          </div>
        </div>
      )}
    </div>
  )
}
