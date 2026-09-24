import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { supabase } from './supabase'
import { useAuth } from './auth'

const EPOCH = '1970-01-01T00:00:00Z'
const Ctx = createContext(null)

// Tracks the signed-in user's last visit to the News page, so new announcements can be
// highlighted (and a badge shown in the nav) until they've been seen.
export function AnnouncementReadsProvider({ children }) {
  const { user } = useAuth()
  const [lastSeenAt, setLastSeenAt] = useState(null) // null while loading
  const [unreadCount, setUnreadCount] = useState(0)

  const refresh = useCallback(async () => {
    if (!user) return
    const { data } = await supabase.from('announcement_reads').select('last_seen_at').eq('user_id', user.id).maybeSingle()
    const seen = data?.last_seen_at || EPOCH
    setLastSeenAt(seen)
    const { count } = await supabase.from('announcements').select('id', { count: 'exact', head: true }).gt('created_at', seen)
    setUnreadCount(count || 0)
  }, [user])

  useEffect(() => { refresh() }, [refresh])

  // Called once the News page has used lastSeenAt to decide what to highlight.
  const markSeen = useCallback(async () => {
    if (!user) return
    const now = new Date().toISOString()
    const { error } = await supabase.from('announcement_reads').upsert({ user_id: user.id, last_seen_at: now })
    if (!error) {
      setLastSeenAt(now)
      setUnreadCount(0)
    }
  }, [user])

  return <Ctx.Provider value={{ lastSeenAt, unreadCount, markSeen }}>{children}</Ctx.Provider>
}

export const useAnnouncementReads = () => useContext(Ctx)
