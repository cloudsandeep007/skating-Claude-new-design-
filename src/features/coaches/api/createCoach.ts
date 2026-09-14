import { useMutation, useQueryClient } from '@tanstack/react-query'

import { invokeFunction } from '@/shared/lib/invokeFunction'
import { supabase } from '@/shared/lib/supabase'

import type { CoachForm } from '../types'
import { uploadCoachPhoto } from './uploadCoachPhoto'

interface InviteResponse {
  profile_id: string
  coach_id: string
}

interface CreateCoachInput {
  academyId: string
  form: CoachForm
  photoFile: File | null
}

async function createCoach({ academyId, form, photoFile }: CreateCoachInput) {
  const response = await invokeFunction<InviteResponse>('invite-user', {
    role: 'coach',
    email: form.email,
    full_name: form.fullName,
    phone: form.phone,
    specialization: form.specialization,
  })

  if (photoFile) {
    const path = await uploadCoachPhoto(academyId, response.coach_id, photoFile)
    await supabase.from('coaches').update({ photo_url: path }).eq('id', response.coach_id)
  }

  return response
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
