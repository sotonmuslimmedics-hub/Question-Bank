import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { SITE_NAME } from '../config'
import { inputCls, btnDark, Notice } from '../components/ui'

export default function ResetPassword() {
  const { session, recovering, clearRecovering, loading } = useAuth()
  const nav = useNavigate()
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setErr('')
    if (pw.length < 8) return setErr('Use at least 8 characters.')
    if (pw !== pw2) return setErr('The two passwords do not match.')
    setBusy(true)
    const { error } = await supabase.auth.updateUser({ password: pw })
    setBusy(false)
    if (error) return setErr(error.message)
    clearRecovering()
    nav('/', { replace: true })
  }

  return (
    <div className="grid min-h-screen place-items-center px-4">
      <form onSubmit={submit} className="w-full max-w-sm rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-bold">Choose a new password</h1>
        <p className="mb-4 text-sm text-stone-500">{SITE_NAME}</p>
        {!loading && !session && !recovering ? (
          <Notice tone="warn">This link has expired or was already used. Go back to sign in and request a new one.</Notice>
        ) : (
          <>
            <Notice tone="error">{err}</Notice>
            <label className="mb-3 block text-sm font-medium">
              New password
              <input type="password" autoComplete="new-password" className={`${inputCls} mt-1`} value={pw} onChange={(e) => setPw(e.target.value)} required />
            </label>
            <label className="mb-4 block text-sm font-medium">
              Repeat it
              <input type="password" autoComplete="new-password" className={`${inputCls} mt-1`} value={pw2} onChange={(e) => setPw2(e.target.value)} required />
            </label>
            <button className={`${btnDark} w-full`} disabled={busy}>{busy ? 'Saving…' : 'Save password'}</button>
          </>
        )}
        <a href="/login" className="mt-4 block text-center text-sm text-stone-500 underline">Back to sign in</a>
      </form>
    </div>
  )
}
