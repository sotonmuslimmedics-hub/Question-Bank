import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'

export default function Login() {
  const { session } = useAuth()
  const [mode, setMode] = useState('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [busy, setBusy] = useState(false)

  if (session) return <Navigate to="/" replace />

  async function submit(e) {
    e.preventDefault()
    setError('')
    setInfo('')
    setBusy(true)
    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName } },
        })
        if (error) throw error
        if (!data.session) setInfo('Check your email to confirm your account, then sign in.')
      }
    } catch (err) {
      setError(err.message || 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  const input = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100'

  return (
    <div className="grid min-h-screen place-items-center px-4">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="text-center">
          <div className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-xl bg-brand-600 text-xl font-bold text-white">+</div>
          <h1 className="text-xl font-bold">Question Bank</h1>
          <p className="text-sm text-slate-500">{mode === 'signin' ? 'Sign in to practise' : 'Create your account'}</p>
        </div>
        {mode === 'signup' && (
          <input className={input} placeholder="Full name" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
        )}
        <input className={input} type="email" placeholder="University email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input className={input} type="password" placeholder="Password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} required />
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        {info && <p className="rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-700">{info}</p>}
        <button disabled={busy} className="w-full rounded-lg bg-brand-600 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60">
          {busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Sign up'}
        </button>
        <button
          type="button"
          onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(''); setInfo('') }}
          className="w-full text-center text-sm text-slate-500 hover:text-slate-800"
        >
          {mode === 'signin' ? 'No account? Sign up' : 'Have an account? Sign in'}
        </button>
      </form>
    </div>
  )
}
