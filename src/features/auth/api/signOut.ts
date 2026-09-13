import { useMutation } from '@tanstack/react-query'

import { supabase } from '@/shared/lib/supabase'

export function useSignOut() {
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
    },
  })
}
