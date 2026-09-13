import { useQuery } from '@tanstack/react-query'

import { supabase } from '@/shared/lib/supabase'

import type { CoachStatus } from '../types'

export interface CoachDetail {
  id: string
  profileId: string
  fullName: string
  email: string | null
  phone: string | null
  specialization: string | null
  status: CoachStatus
  joinedDate: string
  batches: { id: string; name: string; studentCount: number }[]
}

async function fetchCoach(id: string): Promise<CoachDetail> {
  const { data, error } = await supabase
    .from('coaches')
    .select(
      `id, specialization, status, joined_date,
       profile:profiles(id, full_name, email, phone),
       batches(id, name)`,
    )
    .eq('id', id)
    .single()
  if (error) throw error

  const batchIds = data.batches.map((b) => b.id)
  const counts = new Map<string, number>()
  if (batchIds.length > 0) {
    const { data: enrollments } = await supabase
      .from('student_batches')
      .select('batch_id')
      .eq('status', 'active')
      .in('batch_id', batchIds)
    for (const row of enrollments ?? [])
      counts.set(row.batch_id, (counts.get(row.batch_id) ?? 0) + 1)
  }

  return {
    id: data.id,
    profileId: data.profile.id,
    fullName: data.profile.full_name,
    email: data.profile.email,
    phone: data.profile.phone,
    specialization: data.specialization,
    status: data.status,
    joinedDate: data.joined_date,
    batches: data.batches.map((b) => ({
      id: b.id,
      name: b.name,
      studentCount: counts.get(b.id) ?? 0,
    })),
  }
}

export function useCoach(id: string) {
  return useQuery({ queryKey: ['coaches', 'detail', id], queryFn: () => fetchCoach(id) })
}
