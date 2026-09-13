import { createContext } from 'react'

import type { Session } from '@supabase/supabase-js'

import type { Profile } from '../types'

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated'

export interface AuthContextValue {
  status: AuthStatus
  session: Session | null
  profile: Profile | null
  /** True for one render after an auto-refresh failure signed the user out —
   * consumed once by <SessionExpiredToast/> to show the "session expired" toast. */
  sessionExpired: boolean
  clearSessionExpired: () => void
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)
