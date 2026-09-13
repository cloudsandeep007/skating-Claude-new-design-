import { useCallback, useEffect, useRef, useState } from 'react'

import type { Session } from '@supabase/supabase-js'

import { supabase } from '@/shared/lib/supabase'

import { fetchProfile } from '../api/fetchProfile'
import { useSignOut } from '../api/signOut'
import type { Profile } from '../types'
import type { AuthContextValue, AuthStatus } from './auth-context'

/** All the session-handling business logic behind <AuthProvider/>: loads the
 * initial session, subscribes to auth state changes (sign-in, sign-out, token
 * auto-refresh), loads the matching profile row, and tells apart a deliberate
 * sign-out from one caused by a failed token refresh (an expired session). */
export function useAuthSession(): AuthContextValue {
  const [status, setStatus] = useState<AuthStatus>('loading')
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [sessionExpired, setSessionExpired] = useState(false)
  const signOutMutation = useSignOut()
  const signingOutRef = useRef(false)

  useEffect(() => {
    let cancelled = false

    async function applySession(nextSession: Session | null) {
      if (!nextSession) {
        if (cancelled) return
        setSession(null)
        setProfile(null)
        setStatus('unauthenticated')
        return
      }

      try {
        const nextProfile = await fetchProfile(nextSession.user.id)
        if (cancelled) return
        setSession(nextSession)
        setProfile(nextProfile)
        setStatus('authenticated')
      } catch {
        // A session with no matching profile row shouldn't happen for a real
        // account, but treat it as signed-out rather than crash the app.
        if (cancelled) return
        setSession(null)
        setProfile(null)
        setStatus('unauthenticated')
      }
    }

    void supabase.auth.getSession().then(({ data }) => {
      void applySession(data.session)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event === 'SIGNED_OUT' && !signingOutRef.current) {
        setSessionExpired(true)
      }
      signingOutRef.current = false
      void applySession(nextSession)
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [])

  const signOut = useCallback(async () => {
    signingOutRef.current = true
    await signOutMutation.mutateAsync()
  }, [signOutMutation])

  const clearSessionExpired = useCallback(() => {
    setSessionExpired(false)
  }, [])

  return { status, session, profile, sessionExpired, clearSessionExpired, signOut }
}
