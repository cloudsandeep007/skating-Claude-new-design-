import { useQuery } from '@tanstack/react-query'

import { supabase } from '@/shared/lib/supabase'

import type { CoachListItem } from '../types'

interface CoachRow {
  id: string
  specialization: string | null
  status: CoachListItem['status']
  profile: { id: string; full_name: string; email: string | null; phone: string | null } | null
  batches: { id: string }[]
}

async function fetchCoaches(): Promise<CoachListItem[]> {
  const { data, error } = await supabase
    .from('coaches')
    .select(
      `id, specialization, status,
       profile:profiles(id, full_name, email, phone),
       batches(id)`,
    )
    .order('created_at')
    .overrideTypes<CoachRow[], { merge: false }>()
  if (error) throw error

  const batchIds = data.flatMap((c) => c.batches.map((b) => b.id))
  const studentCounts = await fetchStudentCountsByBatch(batchIds)

  return data.map((coach) => ({
    id: coach.id,
    profileId: coach.profile?.id ?? '',
    fullName: coach.profile?.full_name ?? 'Unknown',
    email: coach.profile?.email ?? null,
    phone: coach.profile?.phone ?? null,
    specialization: coach.specialization,
    status: coach.status,
    batchCount: coach.batches.length,
    studentCount: coach.batches.reduce((sum, b) => sum + (studentCounts.get(b.id) ?? 0), 0),
  }))
}

async function fetchStudentCountsByBatch(batchIds: string[]) {
  const map = new Map<string, number>()
  if (batchIds.length === 0) return map
  const { data } = await supabase
    .from('student_batches')
    .select('batch_id')
    .eq('status', 'active')
    .in('batch_id', batchIds)
  for (const row of data ?? []) map.set(row.batch_id, (map.get(row.batch_id) ?? 0) + 1)
  return map
}

export function useCoaches() {
  return useQuery({ queryKey: ['coaches'], queryFn: fetchCoaches })
}
