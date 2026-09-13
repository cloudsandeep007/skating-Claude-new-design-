import { useMutation } from '@tanstack/react-query'

import { supabase } from '@/shared/lib/supabase'

export function useUpdatePassword() {
  return useMutation({
    mutationFn: async (password: string) => {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
    },
  })
}
