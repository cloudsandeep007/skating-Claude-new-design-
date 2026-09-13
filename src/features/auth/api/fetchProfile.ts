import { supabase } from '@/shared/lib/supabase'

import type { Profile } from '../types'

/** Plain fetcher (not a TanStack Query hook) — used by useAuthSession while bootstrapping
 * the session, which runs outside any component's render lifecycle. */
export async function fetchProfile(userId: string): Promise<Profile> {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single()

  if (error) throw error
  return data
}
