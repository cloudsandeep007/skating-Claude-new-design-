import { useMutation, useQueryClient } from '@tanstack/react-query'

import type { InviteOutcome } from '@/features/auth'
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

export async function createStudent({ academyId, form, photoFile }: CreateStudentInput) {
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

  // Everything after the insert is compensated: if enrolling or linking the
  // parent fails (an invite email that can't be sent, a duplicate parent
  // account…), the half-made skater is removed again so the admin can fix
  // the form and resubmit without leaving orphans behind.
  let invite: InviteOutcome | null = null
  try {
    const { error: enrollError } = await supabase.from('student_batches').insert({
      academy_id: academyId,
      student_id: student.id,
      batch_id: form.batchId,
    })
    if (enrollError) throw enrollError

    invite = await linkParent(academyId, student.id, form.parent)
  } catch (cause) {
    await supabase.from('students').delete().eq('id', student.id)
    throw cause
  }

  if (photoFile) {
    const path = await uploadStudentPhoto(academyId, student.id, photoFile)
    await supabase.from('students').update({ photo_url: path }).eq('id', student.id)
  }

  // Generate their first invoice right away rather than waiting for the
  // scheduled job.
  if (form.feePlanId) {
    await supabase.rpc('generate_upcoming_fees', { p_academy_id: academyId })
  }

  return { studentId: student.id, invite }
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
