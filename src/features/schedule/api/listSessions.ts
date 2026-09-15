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
  makeup_for_session_id: string | null
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
       makeup_for_session_id,
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
  const cancelledIds = data.filter((s) => s.status === 'cancelled').map((s) => s.id)
  const originalIds = [...new Set(data.map((s) => s.makeup_for_session_id).filter((id) => id != null))]
  const [counts, marked, makeupScheduled, originalDates, booked] = await Promise.all([
    fetchStudentCounts(batchIds),
    fetchMarkedCounts(data.map((s) => s.id)),
    fetchMakeupScheduledDates(cancelledIds),
    fetchOriginalDates(originalIds),
    fetchBookedCounts(data.map((s) => s.id)),
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
    makeupForDate: row.makeup_for_session_id
      ? (originalDates.get(row.makeup_for_session_id) ?? null)
      : null,
    makeupScheduledDate: makeupScheduled.get(row.id) ?? null,
    bookedCount: booked.get(row.id) ?? 0,
  }))
}

async function fetchBookedCounts(sessionIds: string[]) {
  const map = new Map<string, number>()
  if (sessionIds.length === 0) return map
  const { data } = await supabase
    .from('class_bookings')
    .select('session_id')
    .eq('status', 'booked')
    .in('session_id', sessionIds)
  for (const row of data ?? []) map.set(row.session_id, (map.get(row.session_id) ?? 0) + 1)
  return map
}

/** For cancelled sessions: the date of the make-up session already scheduled
 * for it, if any — the make-up may fall outside the calendar's current week,
 * so this is looked up independently of the date range being viewed. */
async function fetchMakeupScheduledDates(cancelledSessionIds: string[]) {
  const map = new Map<string, string>()
  if (cancelledSessionIds.length === 0) return map
  const { data } = await supabase
    .from('schedule_sessions')
    .select('makeup_for_session_id, session_date')
    .in('makeup_for_session_id', cancelledSessionIds)
  for (const row of data ?? []) {
    if (row.makeup_for_session_id) map.set(row.makeup_for_session_id, row.session_date)
  }
  return map
}

/** For make-up sessions: the date of the original cancelled session they replace. */
async function fetchOriginalDates(originalSessionIds: string[]) {
  const map = new Map<string, string>()
  if (originalSessionIds.length === 0) return map
  const { data } = await supabase
    .from('schedule_sessions')
    .select('id, session_date')
    .in('id', originalSessionIds)
  for (const row of data ?? []) map.set(row.id, row.session_date)
  return map
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
