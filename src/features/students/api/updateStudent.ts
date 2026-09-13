import { useMutation, useQueryClient } from '@tanstack/react-query'

import { emptyToNull } from '@/shared/lib/emptyToNull'
import { supabase } from '@/shared/lib/supabase'

import type { StudentEdit } from '../types'
import { uploadStudentPhoto } from './uploadStudentPhoto'

interface UpdateStudentInput {
  academyId: string
  studentId: string
  form: StudentEdit
  photoFile: File | null
}

async function updateStudent({ academyId, studentId, form, photoFile }: UpdateStudentInput) {
  let photoPath: string | undefined
  if (photoFile) {
    photoPath = await uploadStudentPhoto(academyId, studentId, photoFile)
  }

  const { error } = await supabase
    .from('students')
    .update({
      full_name: form.fullName,
      date_of_birth: emptyToNull(form.dateOfBirth),
      gender: form.gender,
      current_level_id: emptyToNull(form.currentLevelId),
      emergency_contact: form.emergencyContact,
      medical_notes: emptyToNull(form.medicalNotes),
      ...(photoPath ? { photo_url: photoPath } : {}),
    })
    .eq('id', studentId)
  if (error) throw error

  const { error: batchError } = await supabase
    .from('student_batches')
    .update({ batch_id: form.batchId })
    .eq('student_id', studentId)
    .eq('status', 'active')
  if (batchError) throw batchError
}

export function useUpdateStudent() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: updateStudent,
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['students'] })
      void queryClient.invalidateQueries({ queryKey: ['students', 'detail', variables.studentId] })
    },
  })
}
