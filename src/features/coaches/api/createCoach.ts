import { useMutation, useQueryClient } from '@tanstack/react-query'

import { invokeFunction } from '@/shared/lib/invokeFunction'

import type { CoachForm } from '../types'

interface InviteResponse {
  profile_id: string
  coach_id: string
}

function createCoach(form: CoachForm) {
  return invokeFunction<InviteResponse>('invite-user', {
    role: 'coach',
    email: form.email,
    full_name: form.fullName,
    phone: form.phone,
    specialization: form.specialization,
  })
}

export function useCreateCoach() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createCoach,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['coaches'] })
    },
  })
}
