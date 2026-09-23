import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../lib/auth'

const linkClass = ({ isActive }) =>
  `block rounded-lg px-3 py-2 text-sm font-medium ${
    isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-100'
  }`

export default function Layout() {
  const { profile, user, isAdmin, signOut } = useAuth()
  const name = profile?.full_name || user?.email || ''

  return (
    <div className="min-h-screen md:flex">
      <aside className="border-b border-slate-200 bg-white md:min-h-screen md:w-60 md:border-b-0 md:border-r">
        <div className="flex items-center gap-2 px-4 py-4">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-brand-600 text-lg font-bold text-white">+</div>
          <div className="text-sm font-semibold leading-tight">Question Bank</div>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:block md:space-y-1">
          <NavLink to="/" end className={linkClass}>Home</NavLink>
          <NavLink to="/banks" className={linkClass}>Question banks</NavLink>
          {isAdmin && (
            <>
              <div className="hidden px-3 pt-4 pb-1 text-xs font-semibold uppercase tracking-wide text-slate-400 md:block">Admin</div>
              <NavLink to="/admin" end className={linkClass}>Structure</NavLink>
              <NavLink to="/admin/questions" className={linkClass}>Questions</NavLink>
              <NavLink to="/admin/users" className={linkClass}>Admins</NavLink>
            </>
          )}
        </nav>
        <div className="border-t border-slate-200 px-4 py-3 text-xs md:mt-auto">
          <div className="truncate font-medium text-slate-700">{name}</div>
          <button onClick={signOut} className="mt-1 text-slate-500 hover:text-slate-800">Sign out</button>
        </div>
      </aside>
      <main className="flex-1 px-4 py-8 md:px-10">
        <div className="mx-auto max-w-3xl">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
