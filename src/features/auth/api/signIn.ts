import { useMutation } from '@tanstack/react-query'

import { supabase } from '@/shared/lib/supabase'

import type { Login } from '../types'

export function useSignIn() {
  return useMutation({
    mutationFn: async ({ email, password }: Login) => {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      return data
    },
  })
}
