import { useMutation } from '@tanstack/react-query'

import { supabase } from '@/shared/lib/supabase'

import type { SignInToken } from '../hooks/inviteLink'

/** Turns the one-time token from a /welcome link into a session. Both
 * 'invite' (fresh account) and 'recovery' (existing account, new link) end
 * the same way: signed in, ready to set a password. */
export function useAcceptSignInLink() {
  return useMutation({
    mutationFn: async ({ tokenHash, tokenType }: SignInToken) => {
      const { data, error } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: tokenType,
      })
      if (error) throw error
      return data.user
    },
  })
}

/** After the first password is set, the profile stops being "invited". */
export async function markProfileActive(profileId: string) {
  await supabase.from('profiles').update({ status: 'active' }).eq('id', profileId)
}
