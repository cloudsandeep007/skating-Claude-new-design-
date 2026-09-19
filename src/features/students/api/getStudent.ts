import { useQuery } from '@tanstack/react-query'

import { supabase } from '@/shared/lib/supabase'

export interface StudentDetail {
  id: string
  fullName: string
  photoUrl: string | null
  status: 'active' | 'inactive' | 'archived'
  dateOfBirth: string | null
  gender: string | null
  joinedDate: string
  medicalNotes: string | null
  emergencyContact: { name?: string; phone?: string; relationship?: string } | null
  levelName: string | null
  batchName: string | null
  coachName: string | null
  attendancePct: number | null
  parents: {
    id: string
    fullName: string
    phone: string | null
    email: string | null
    /** 'invited' until they open their sign-in link and set a password. */
    status: 'active' | 'invited' | 'inactive'
  }[]
}

async function fetchStudent(id: string): Promise<StudentDetail> {
  const { data: student, error } = await supabase
    .from('students')
    .select(
      `id, full_name, photo_url, status, date_of_birth, gender, joined_date, medical_notes,
       emergency_contact,
       current_level:levels(name),
       student_batches!inner(status, batch:batches(name, coach:coaches(profile:profiles(full_name))))`,
    )
    .eq('id', id)
    .eq('student_batches.status', 'active')
    .single()
  if (error) throw error

  const { data: parentLinks } = await supabase
    .from('parents_students')
    .select('parent:profiles(id, full_name, phone, email, status)')
    .eq('student_id', id)

  const { data: attendance } = await supabase
    .from('student_attendance_summary')
    .select('attendance_pct')
    .eq('student_id', id)
    .maybeSingle()

  // The !inner join above guarantees at least one active enrollment row.
  const batch = student.student_batches[0].batch

  return {
    id: student.id,
    fullName: student.full_name,
    photoUrl: student.photo_url,
    status: student.status,
    dateOfBirth: student.date_of_birth,
    gender: student.gender,
    joinedDate: student.joined_date,
    medicalNotes: student.medical_notes,
    emergencyContact: student.emergency_contact as StudentDetail['emergencyContact'],
    levelName: student.current_level?.name ?? null,
    batchName: batch.name,
    coachName: batch.coach?.profile.full_name ?? null,
    attendancePct: attendance?.attendance_pct ?? null,
    parents: (parentLinks ?? []).map((link) => ({
      id: link.parent.id,
      fullName: link.parent.full_name,
      phone: link.parent.phone,
      status: link.parent.status,
      email: link.parent.email,
    })),
  }
}

export function useStudent(id: string) {
  return useQuery({
    queryKey: ['students', 'detail', id],
    queryFn: () => fetchStudent(id),
    // A wrong id (old bookmark, deleted skater) is a not-found, not a blip:
    // don't retry it three times before admitting it.
    retry: (count, error) => !isNotFound(error) && count < 2,
  })
}

/** PostgREST's "no rows" from .single(), or a malformed uuid. */
export function isNotFound(error: unknown): boolean {
  const code = (error as { code?: string } | null)?.code
  return code === 'PGRST116' || code === '22P02'
}
