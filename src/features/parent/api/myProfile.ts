import { useMutation, useQueryClient } from '@tanstack/react-query'

import { supabase } from '@/shared/lib/supabase'

import type { ProfileForm } from '../types'

/** Own name/phone only — role and academy are protected by RLS. */
export function useUpdateMyProfile() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ profileId, form }: { profileId: string; form: ProfileForm }) => {
      const { error } = await supabase
        .from('profiles')
        .update({ full_name: form.fullName, phone: form.phone })
        .eq('id', profileId)
      if (error) throw error
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['parent'] })
    },
  })
}

export function useChangePassword() {
  return useMutation({
    mutationFn: async (password: string) => {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
    },
  })
}
