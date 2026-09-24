import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { SITE_NAME, SITE_TAGLINE, SHORT_NAME } from '../config'
import { inputCls, btnDark, Notice } from '../components/ui'

export default function Login() {
  const { session, recovering } = useAuth()
  const [mode, setMode] = useState('signin') // signin | signup | forgot
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [busy, setBusy] = useState(false)

  if (recovering) return <Navigate to="/reset-password" replace />
  if (session) return <Navigate to="/" replace />

  const switchMode = (m) => {
    setMode(m)
    setError('')
    setInfo('')
  }

  async function submit(e) {
    e.preventDefault()
    setError('')
    setInfo('')
    setBusy(true)
    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      } else if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: fullName } } })
        if (error) throw error
        if (!data.session) setInfo('Check your email to confirm your account, then sign in.')
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` })
        if (error) throw error
        setInfo('If that email has an account, a reset link is on its way. Check junk mail too.')
      }
    } catch (err) {
      setError(err.message || 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  const heading = { signin: 'Welcome back', signup: 'Create your account', forgot: 'Reset your password' }[mode]

  return (
    <div className="grid min-h-screen place-items-center px-4 py-8">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <img src="/logo-mark.png" alt={SHORT_NAME} className="mx-auto mb-3 h-16 w-16 object-contain" />
          <h1 className="text-2xl font-bold tracking-tight">{SITE_NAME}</h1>
          <p className="mt-1 text-sm text-stone-500">{SITE_TAGLINE}</p>
        </div>
        <form onSubmit={submit} className="space-y-3 rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">{heading}</h2>
          <Notice tone="error">{error}</Notice>
          <Notice tone="ok">{info}</Notice>
          {mode === 'signup' && (
            <input className={inputCls} placeholder="Full name" autoComplete="name" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
          )}
          <input className={inputCls} type="email" placeholder="University email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          {mode !== 'forgot' && (
            <input
              className={inputCls}
              type="password"
              placeholder="Password"
              minLength={8}
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          )}
          <button disabled={busy} className={`${btnDark} w-full`}>
            {busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : mode === 'signup' ? 'Sign up' : 'Send reset link'}
          </button>
          <div className="flex justify-between text-sm text-stone-500">
            {mode === 'signin' ? (
              <>
                <button type="button" onClick={() => switchMode('forgot')} className="underline">Forgot password?</button>
                <button type="button" onClick={() => switchMode('signup')} className="underline">Create account</button>
              </>
            ) : (
              <button type="button" onClick={() => switchMode('signin')} className="underline">Back to sign in</button>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}
