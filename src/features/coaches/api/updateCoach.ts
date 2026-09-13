import { useMutation, useQueryClient } from '@tanstack/react-query'

import { emptyToNull } from '@/shared/lib/emptyToNull'
import { supabase } from '@/shared/lib/supabase'

import type { CoachEdit } from '../types'

interface UpdateCoachInput {
  coachId: string
  profileId: string
  form: CoachEdit
}

async function updateCoach({ coachId, profileId, form }: UpdateCoachInput) {
  const { error: profileError } = await supabase
    .from('profiles')
    .update({ full_name: form.fullName, phone: form.phone })
    .eq('id', profileId)
  if (profileError) throw profileError

  const { error: coachError } = await supabase
    .from('coaches')
    .update({ specialization: emptyToNull(form.specialization) })
    .eq('id', coachId)
  if (coachError) throw coachError
}

export function useUpdateCoach() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: updateCoach,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['coaches'] })
    },
  })
}
