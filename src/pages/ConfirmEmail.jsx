import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { SHORT_NAME } from '../config'
import { btnDark, Notice } from '../components/ui'

// Confirmation lands here instead of Supabase's own /auth/v1/verify link.
// That link confirms the account the instant it's *visited* — no click
// needed — which means mail-security scanners (Microsoft 365 Safe Links,
// in particular, which most @soton.ac.uk mail goes through) silently use it
// up before the student ever opens the email, so their own click then fails
// with "Email not confirmed". Confirming only on an explicit button press
// here means a scanner that just fetches this page does nothing.
export default function ConfirmEmail() {
  const [params] = useSearchParams()
  const nav = useNavigate()
  const tokenHash = params.get('token_hash')
  const type = params.get('type') || 'signup'
  const [status, setStatus] = useState('idle') // idle | busy | error | done
  const [error, setError] = useState('')

  async function confirm() {
    setStatus('busy')
    setError('')
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
    if (error) {
      setStatus('error')
      setError(error.message)
      return
    }
    setStatus('done')
    setTimeout(() => nav('/', { replace: true }), 1200)
  }

  return (
    <div className="grid min-h-screen place-items-center px-4 py-8">
      <div className="w-full max-w-sm text-center">
        <img src="/logo-mark.png" alt={SHORT_NAME} className="mx-auto mb-3 h-16 w-16 object-contain" />
        <div className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
          {!tokenHash ? (
            <>
              <h1 className="text-lg font-semibold">Link incomplete</h1>
              <p className="mt-2 text-sm text-stone-500">
                This confirmation link is missing some information — it may have been altered by an email app. Try
                signing up again, or ask a committee admin for a fresh invite.
              </p>
              <Link to="/login" className="mt-4 inline-block text-sm underline">Back to sign in</Link>
            </>
          ) : status === 'done' ? (
            <>
              <h1 className="text-lg font-semibold">Email confirmed 🎉</h1>
              <p className="mt-2 text-sm text-stone-500">Taking you in…</p>
            </>
          ) : (
            <>
              <h1 className="text-lg font-semibold">Confirm your email</h1>
              <p className="mt-2 text-sm text-stone-500">Tap below to finish setting up your account.</p>
              <Notice tone="error">{error}</Notice>
              <button className={`${btnDark} mt-4 w-full`} onClick={confirm} disabled={status === 'busy'}>
                {status === 'busy' ? 'Confirming…' : 'Confirm my email'}
              </button>
              {status === 'error' && (
                <Link to="/login" className="mt-3 inline-block text-sm underline">Back to sign in</Link>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
