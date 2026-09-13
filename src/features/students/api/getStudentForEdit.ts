import { useQuery } from '@tanstack/react-query'

import { supabase } from '@/shared/lib/supabase'

import type { StudentEdit } from '../types'

async function fetchStudentForEdit(id: string): Promise<StudentEdit & { photoUrl: string | null }> {
  const { data, error } = await supabase
    .from('students')
    .select(
      `full_name, date_of_birth, gender, current_level_id, medical_notes, photo_url, emergency_contact,
       student_batches!inner(status, batch_id)`,
    )
    .eq('id', id)
    .eq('student_batches.status', 'active')
    .single()
  if (error) throw error

  const contact = data.emergency_contact as { name?: string; phone?: string; relationship?: string }

  return {
    fullName: data.full_name,
    dateOfBirth: data.date_of_birth ?? '',
    gender: data.gender ?? undefined,
    batchId: data.student_batches[0]?.batch_id ?? '',
    currentLevelId: data.current_level_id ?? '',
    emergencyContact: {
      name: contact.name ?? '',
      phone: contact.phone ?? '',
      relationship: contact.relationship ?? '',
    },
    medicalNotes: data.medical_notes ?? '',
    photoUrl: data.photo_url,
  }
}

export function useStudentForEdit(id: string) {
  return useQuery({
    queryKey: ['students', 'edit', id],
    queryFn: () => fetchStudentForEdit(id),
  })
}
