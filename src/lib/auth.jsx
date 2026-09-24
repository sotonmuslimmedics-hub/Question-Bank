import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from './supabase'

const AuthContext = createContext(null)
const RANK = { student: 0, teacher: 1, lead: 2, admin: 3 }

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [recovering, setRecovering] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      if (!data.session) setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === 'PASSWORD_RECOVERY') setRecovering(true)
      setSession(s)
      if (!s) {
        setProfile(null)
        setLoading(false)
      }
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session) return
    let cancelled = false
    supabase
      .from('profiles')
      .select('id,email,full_name,role,is_admin')
      .eq('id', session.user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) {
          setProfile(data)
          setLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [session])

  const role = profile?.role || 'student'
  const at = (min) => RANK[role] >= RANK[min]

  const value = {
    session,
    user: session?.user ?? null,
    profile,
    role,
    isTeacher: at('teacher'), // student teacher or above
    isLead: at('lead'), // academic lead or above
    isAdmin: at('admin'),
    loading,
    recovering,
    clearRecovering: () => setRecovering(false),
    signOut: () => supabase.auth.signOut(),
    refreshProfile: async () => {
      if (!session) return
      const { data } = await supabase.from('profiles').select('id,email,full_name,role,is_admin').eq('id', session.user.id).maybeSingle()
      setProfile(data)
    },
  }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
