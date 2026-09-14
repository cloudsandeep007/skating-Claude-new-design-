import { useQuery } from '@tanstack/react-query'

import { todayIso } from '@/shared/lib/format'
import { supabase } from '@/shared/lib/supabase'

import type { BatchDetail } from '../types'

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
  status: BatchDetail['status']
  coach: { profile: { full_name: string } } | null
  student_batches: {
    status: string
    enrolled_date: string
    student: { id: string; full_name: string; current_level: { name: string } | null }
  }[]
}

async function fetchBatch(id: string): Promise<BatchDetail> {
  const today = todayIso()

  const [batchResult, sessionsResult] = await Promise.all([
    supabase
      .from('batches')
      .select(
        `id, name, level_range, coach_id, start_time, end_time, days_of_week, venue, capacity, status,
         coach:coaches(profile:profiles(full_name)),
         student_batches(status, enrolled_date,
           student:students(id, full_name, current_level:levels(name)))`,
      )
      .eq('id', id)
      .single()
      .overrideTypes<BatchRow, { merge: false }>(),
    supabase
      .from('schedule_sessions')
      .select('id, session_date, start_time, end_time, status, cancellation_reason')
      .eq('batch_id', id)
      .gte('session_date', today)
      .order('session_date')
      .order('start_time')
      .limit(20),
  ])
  if (batchResult.error) throw batchResult.error
  if (sessionsResult.error) throw sessionsResult.error

  const row = batchResult.data
  const activeEnrollments = row.student_batches.filter((sb) => sb.status === 'active')

  return {
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
    enrolledCount: activeEnrollments.length,
    status: row.status,
    roster: activeEnrollments
      .map((sb) => ({
        studentId: sb.student.id,
        fullName: sb.student.full_name,
        levelName: sb.student.current_level?.name ?? null,
        enrolledDate: sb.enrolled_date,
      }))
      .sort((a, b) => a.fullName.localeCompare(b.fullName)),
    upcomingSessions: sessionsResult.data.map((s) => ({
      id: s.id,
      sessionDate: s.session_date,
      startTime: s.start_time,
      endTime: s.end_time,
      status: s.status,
      cancellationReason: s.cancellation_reason,
    })),
  }
}

export function useBatch(id: string) {
  return useQuery({ queryKey: ['batches', 'detail', id], queryFn: () => fetchBatch(id) })
}
