import { useMutation, useQueryClient } from '@tanstack/react-query'

import { emptyToNull } from '@/shared/lib/emptyToNull'
import { supabase } from '@/shared/lib/supabase'

import type { CoachEdit } from '../types'
import { uploadCoachPhoto } from './uploadCoachPhoto'

interface UpdateCoachInput {
  academyId: string
  coachId: string
  profileId: string
  form: CoachEdit
  photoFile: File | null
}

async function updateCoach({ academyId, coachId, profileId, form, photoFile }: UpdateCoachInput) {
  const { error: profileError } = await supabase
    .from('profiles')
    .update({ full_name: form.fullName, phone: form.phone })
    .eq('id', profileId)
  if (profileError) throw profileError

  const photoPath = photoFile ? await uploadCoachPhoto(academyId, coachId, photoFile) : undefined

  const { error: coachError } = await supabase
    .from('coaches')
    .update({
      specialization: emptyToNull(form.specialization),
      ...(photoPath !== undefined ? { photo_url: photoPath } : {}),
    })
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
