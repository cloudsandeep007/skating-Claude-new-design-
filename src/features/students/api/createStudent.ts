import { useMutation, useQueryClient } from '@tanstack/react-query'

import { emptyToNull } from '@/shared/lib/emptyToNull'
import { supabase } from '@/shared/lib/supabase'

import type { StudentForm } from '../types'
import { linkParent } from './inviteParent'
import { uploadStudentPhoto } from './uploadStudentPhoto'

interface CreateStudentInput {
  academyId: string
  form: StudentForm
  photoFile: File | null
}

async function createStudent({ academyId, form, photoFile }: CreateStudentInput) {
  const { data: student, error } = await supabase
    .from('students')
    .insert({
      academy_id: academyId,
      full_name: form.fullName,
      date_of_birth: emptyToNull(form.dateOfBirth),
      gender: form.gender,
      current_level_id: emptyToNull(form.currentLevelId),
      fee_plan_id: emptyToNull(form.feePlanId),
      emergency_contact: form.emergencyContact,
      medical_notes: emptyToNull(form.medicalNotes),
    })
    .select('id')
    .single()
  if (error) throw error

  const { error: enrollError } = await supabase.from('student_batches').insert({
    academy_id: academyId,
    student_id: student.id,
    batch_id: form.batchId,
  })
  if (enrollError) throw enrollError

  await linkParent(academyId, student.id, form.parent)

  if (photoFile) {
    const path = await uploadStudentPhoto(academyId, student.id, photoFile)
    await supabase.from('students').update({ photo_url: path }).eq('id', student.id)
  }

  // Generate their first invoice right away rather than waiting for the
  // scheduled job.
  if (form.feePlanId) {
    await supabase.rpc('generate_upcoming_fees', { p_academy_id: academyId })
  }

  return student.id
}

export function useCreateStudent() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createStudent,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['students'] })
      void queryClient.invalidateQueries({ queryKey: ['fees'] })
    },
  })
}
