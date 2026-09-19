import { useMutation } from '@tanstack/react-query'

import { invokeFunction } from '@/shared/lib/invokeFunction'

import type { SignInToken } from '../hooks/inviteLink'

/** What invite-user returns for a created or re-linked account. */
export interface InviteOutcome {
  profileId: string
  token: SignInToken | null
  /** Supabase's mailer accepted an email; false when it refused (rate limit,
   * no SMTP) — the admin shares the link by hand instead. */
  emailed: boolean
  emailError: string | null
}

interface RawInvite {
  profile_id: string
  coach_id?: string
  token_hash: string | null
  token_type: 'invite' | 'recovery' | null
  emailed: boolean
  email_error?: string
}

export function toInviteOutcome(raw: RawInvite): InviteOutcome {
  return {
    profileId: raw.profile_id,
    token:
      raw.token_hash && raw.token_type
        ? { tokenHash: raw.token_hash, tokenType: raw.token_type }
        : null,
    emailed: raw.emailed,
    emailError: raw.email_error ?? null,
  }
}

/** invite-user { action: 'link' } — a fresh one-time sign-in link for an
 * account that already exists (lost invite, forgotten password), emailed
 * too when the mailer allows. */
export function useNewSignInLink() {
  return useMutation({
    mutationFn: async (profileId: string): Promise<InviteOutcome> => {
      const raw = await invokeFunction<RawInvite>('invite-user', {
        action: 'link',
        profile_id: profileId,
      })
      return toInviteOutcome(raw)
    },
  })
}
