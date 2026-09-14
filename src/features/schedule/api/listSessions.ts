import { keepPreviousData, useQuery } from '@tanstack/react-query'

import { supabase } from '@/shared/lib/supabase'

import type { SessionItem } from '../types'

interface SessionRow {
  id: string
  batch_id: string
  coach_id: string | null
  session_date: string
  start_time: string
  end_time: string
  status: SessionItem['status']
  cancellation_reason: string | null
  batch: { name: string; venue: string | null }
  coach: { profile: { full_name: string } } | null
}

interface SessionFilters {
  from: string
  to: string
  /** Restrict to one coach (the coach's own "today" view). */
  coachId?: string
}

async function fetchSessions({ from, to, coachId }: SessionFilters): Promise<SessionItem[]> {
  let query = supabase
    .from('schedule_sessions')
    .select(
      `id, batch_id, coach_id, session_date, start_time, end_time, status, cancellation_reason,
       batch:batches(name, venue),
       coach:coaches(profile:profiles(full_name))`,
    )
    .gte('session_date', from)
    .lte('session_date', to)
    .order('session_date')
    .order('start_time')

  if (coachId) query = query.eq('coach_id', coachId)

  const { data, error } = await query.overrideTypes<SessionRow[], { merge: false }>()
  if (error) throw error

  const batchIds = [...new Set(data.map((s) => s.batch_id))]
  const [counts, marked] = await Promise.all([
    fetchStudentCounts(batchIds),
    fetchMarkedCounts(data.map((s) => s.id)),
  ])

  return data.map((row) => ({
    id: row.id,
    batchId: row.batch_id,
    batchName: row.batch.name,
    venue: row.batch.venue,
    coachId: row.coach_id,
    coachName: row.coach?.profile.full_name ?? null,
    sessionDate: row.session_date,
    startTime: row.start_time,
    endTime: row.end_time,
    status: row.status,
    cancellationReason: row.cancellation_reason,
    studentCount: counts.get(row.batch_id) ?? 0,
    markedCount: marked.get(row.id) ?? 0,
  }))
}

async function fetchMarkedCounts(sessionIds: string[]) {
  const map = new Map<string, number>()
  if (sessionIds.length === 0) return map
  const { data } = await supabase
    .from('attendance')
    .select('session_id')
    .in('session_id', sessionIds)
  for (const row of data ?? []) map.set(row.session_id, (map.get(row.session_id) ?? 0) + 1)
  return map
}

async function fetchStudentCounts(batchIds: string[]) {
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

export function useSessions(filters: SessionFilters) {
  return useQuery({
    queryKey: ['sessions', filters],
    queryFn: () => fetchSessions(filters),
    placeholderData: keepPreviousData,
  })
}
