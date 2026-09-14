import { useQuery } from '@tanstack/react-query'

import { todayIso } from '@/shared/lib/format'
import { supabase } from '@/shared/lib/supabase'
import type { Enums } from '@/shared/types'

export interface ChildProfile {
  id: string
  fullName: string
  dateOfBirth: string | null
  joinedDate: string
  levelName: string | null
  batches: {
    id: string
    name: string
    venue: string | null
    daysOfWeek: number[]
    startTime: string
    endTime: string
    coachName: string | null
  }[]
  emergencyContact: { name?: string; phone?: string; relationship?: string } | null
  medicalNotes: string | null
}

interface ProfileRow {
  id: string
  full_name: string
  date_of_birth: string | null
  joined_date: string
  medical_notes: string | null
  emergency_contact: unknown
  current_level: { name: string } | null
  student_batches: {
    status: string
    batch: {
      id: string
      name: string
      venue: string | null
      days_of_week: number[]
      start_time: string
      end_time: string
      coach: { profile: { full_name: string } } | null
    }
  }[]
}

export function useChildProfile(studentId: string | null) {
  return useQuery({
    queryKey: ['parent', 'child', studentId],
    enabled: studentId !== null,
    queryFn: async (): Promise<ChildProfile> => {
      const { data, error } = await supabase
        .from('students')
        .select(
          `id, full_name, date_of_birth, joined_date, medical_notes, emergency_contact,
           current_level:levels(name),
           student_batches(status, batch:batches(id, name, venue, days_of_week, start_time, end_time,
             coach:coaches(profile:profiles(full_name))))`,
        )
        .eq('id', studentId ?? '')
        .single()
        .overrideTypes<ProfileRow, { merge: false }>()
      if (error) throw error
      return {
        id: data.id,
        fullName: data.full_name,
        dateOfBirth: data.date_of_birth,
        joinedDate: data.joined_date,
        levelName: data.current_level?.name ?? null,
        batches: data.student_batches
          .filter((sb) => sb.status === 'active')
          .map((sb) => ({
            id: sb.batch.id,
            name: sb.batch.name,
            venue: sb.batch.venue,
            daysOfWeek: sb.batch.days_of_week,
            startTime: sb.batch.start_time,
            endTime: sb.batch.end_time,
            coachName: sb.batch.coach?.profile.full_name ?? null,
          })),
        emergencyContact: data.emergency_contact as ChildProfile['emergencyContact'],
        medicalNotes: data.medical_notes,
      }
    },
  })
}

export interface UpcomingSession {
  id: string
  sessionDate: string
  startTime: string
  endTime: string
  batchName: string
  venue: string | null
  coachName: string | null
  status: Enums<'session_status'>
  cancellationReason: string | null
}

interface SessionRow {
  id: string
  session_date: string
  start_time: string
  end_time: string
  status: UpcomingSession['status']
  cancellation_reason: string | null
  batch: { name: string; venue: string | null }
  coach: { profile: { full_name: string } } | null
}

/** Next sessions for all of the child's active batches, cancelled ones
 * included (with the reason) so a parent isn't surprised at the rink. */
export function useChildUpcomingSessions(studentId: string | null, limit = 20) {
  return useQuery({
    queryKey: ['parent', 'upcoming', studentId, limit],
    enabled: studentId !== null,
    queryFn: async (): Promise<UpcomingSession[]> => {
      const { data: enrollments, error: enrollError } = await supabase
        .from('student_batches')
        .select('batch_id')
        .eq('student_id', studentId ?? '')
        .eq('status', 'active')
      if (enrollError) throw enrollError
      if (enrollments.length === 0) return []

      const { data, error } = await supabase
        .from('schedule_sessions')
        .select(
          `id, session_date, start_time, end_time, status, cancellation_reason,
           batch:batches(name, venue), coach:coaches(profile:profiles(full_name))`,
        )
        .in(
          'batch_id',
          enrollments.map((e) => e.batch_id),
        )
        .gte('session_date', todayIso())
        .order('session_date')
        .order('start_time')
        .limit(limit)
        .overrideTypes<SessionRow[], { merge: false }>()
      if (error) throw error
      return data.map((s) => ({
        id: s.id,
        sessionDate: s.session_date,
        startTime: s.start_time,
        endTime: s.end_time,
        batchName: s.batch.name,
        venue: s.batch.venue,
        coachName: s.coach?.profile.full_name ?? null,
        status: s.status,
        cancellationReason: s.cancellation_reason,
      }))
    },
  })
}

export interface ChildFeeStatus {
  status: Enums<'fee_status'>
  amount: number
  dueDate: string
  periodStart: string
  periodEnd: string
  planName: string | null
}

/** The child's most recent fee by due date — what "fee status" means on the home card. */
export function useChildFeeStatus(studentId: string | null) {
  return useQuery({
    queryKey: ['parent', 'fee', studentId],
    enabled: studentId !== null,
    queryFn: async (): Promise<ChildFeeStatus | null> => {
      const { data, error } = await supabase
        .from('student_fees')
        .select('status, amount, due_date, period_start, period_end, plan:fee_plans(name)')
        .eq('student_id', studentId ?? '')
        .order('due_date', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (error) throw error
      if (!data) return null
      return {
        status: data.status,
        amount: data.amount,
        dueDate: data.due_date,
        periodStart: data.period_start,
        periodEnd: data.period_end,
        planName: data.plan?.name ?? null,
      }
    },
  })
}
