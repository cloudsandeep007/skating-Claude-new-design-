import { useQuery } from '@tanstack/react-query'

import { supabase } from '@/shared/lib/supabase'

import type { BatchListItem } from '../types'

interface BatchRow {
  id: string
  name: string
  level_range: string | null
  coach_id: string | null
  start_time: string
  end_time: string
  days_of_week: number[]
  venue: string | null
  capacity: number
  status: BatchListItem['status']
  coach: { profile: { full_name: string } } | null
  student_batches: { status: string }[]
}

async function fetchBatches(): Promise<BatchListItem[]> {
  const { data, error } = await supabase
    .from('batches')
    .select(
      `id, name, level_range, coach_id, start_time, end_time, days_of_week, venue, capacity, status,
       coach:coaches(profile:profiles(full_name)),
       student_batches(status)`,
    )
    .order('start_time')
    .overrideTypes<BatchRow[], { merge: false }>()
  if (error) throw error

  return data.map((row) => ({
    id: row.id,
    name: row.name,
    levelRange: row.level_range,
    coachId: row.coach_id,
    coachName: row.coach?.profile.full_name ?? null,
    startTime: row.start_time,
    endTime: row.end_time,
    daysOfWeek: row.days_of_week,
    venue: row.venue,
    capacity: row.capacity,
    enrolledCount: row.student_batches.filter((sb) => sb.status === 'active').length,
    status: row.status,
  }))
}

export function useBatches() {
  return useQuery({ queryKey: ['batches'], queryFn: fetchBatches })
}
