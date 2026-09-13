import { useMutation } from '@tanstack/react-query'

import { supabase } from '@/shared/lib/supabase'

import type { ForgotPassword } from '../types'

export function useRequestPasswordReset() {
  return useMutation({
    mutationFn: async ({ email }: ForgotPassword) => {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      })
      if (error) throw error
    },
  })
}
