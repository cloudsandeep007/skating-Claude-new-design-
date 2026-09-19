import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { invalidateForTable } from '@/shared/hooks/useLiveSync'
import { supabase } from '@/shared/lib/supabase'

import type { AttendanceHistoryRow, AttendanceStatus } from '../types'

export interface SessionSummary {
  id: string
  batchId: string
  batchName: string
  startTime: string
  endTime: string
  status: 'scheduled' | 'completed' | 'cancelled'
  studentCount: number
  markedCount: number
}

interface SessionRow {
  id: string
  batch_id: string
  start_time: string
  end_time: string
  status: SessionSummary['status']
  batch: { name: string }
}

/** All sessions on one day, for the admin "by date" view. */
export function useSessionsOnDate(date: string) {
  return useQuery({
    queryKey: ['attendance', 'by-date', date],
    queryFn: async (): Promise<SessionSummary[]> => {
      const { data, error } = await supabase
        .from('schedule_sessions')
        .select('id, batch_id, start_time, end_time, status, batch:batches(name)')
        .eq('session_date', date)
        .order('start_time')
        .overrideTypes<SessionRow[], { merge: false }>()
      if (error) throw error
      if (data.length === 0) return []

      const [enrollments, marks] = await Promise.all([
        supabase
          .from('student_batches')
          .select('batch_id')
          .eq('status', 'active')
          .in('batch_id', [...new Set(data.map((s) => s.batch_id))]),
        supabase
          .from('attendance')
          .select('session_id')
          .in(
            'session_id',
            data.map((s) => s.id),
          ),
      ])
      const studentCounts = new Map<string, number>()
      for (const row of enrollments.data ?? [])
        studentCounts.set(row.batch_id, (studentCounts.get(row.batch_id) ?? 0) + 1)
      const markedCounts = new Map<string, number>()
      for (const row of marks.data ?? [])
        markedCounts.set(row.session_id, (markedCounts.get(row.session_id) ?? 0) + 1)

      return data.map((s) => ({
        id: s.id,
        batchId: s.batch_id,
        batchName: s.batch.name,
        startTime: s.start_time,
        endTime: s.end_time,
        status: s.status,
        studentCount: studentCounts.get(s.batch_id) ?? 0,
        markedCount: markedCounts.get(s.id) ?? 0,
      }))
    },
  })
}

export interface StudentPct {
  studentId: string
  fullName: string
  counted: number
  attended: number
  absent: number
  late: number
  excused: number
  pct: number | null
}

/** Attendance % per student over a range (optionally one batch) — the
 * attendance_summary_for_range() RPC, same rule as the dashboard views. */
export function useAttendanceSummary(from: string, to: string, batchId: string | null) {
  return useQuery({
    queryKey: ['attendance', 'summary', from, to, batchId],
    queryFn: async (): Promise<StudentPct[]> => {
      const { data, error } = await supabase.rpc('attendance_summary_for_range', {
        p_from: from,
        p_to: to,
        ...(batchId ? { p_batch_id: batchId } : {}),
      })
      if (error) throw error
      return data.map((r) => ({
        studentId: r.student_id,
        fullName: r.full_name,
        counted: r.counted_sessions,
        attended: r.attended_sessions,
        absent: r.absent_sessions,
        late: r.late_sessions,
        excused: r.excused_sessions,
        pct: r.attendance_pct,
      }))
    },
  })
}

interface HistorySessionRow {
  id: string
  session_date: string
  start_time: string
  batch: { name: string }
}

/** Every non-cancelled session of the student's batches in the range, with
 * their mark (or null if unmarked). Used by the admin "by student" view and
 * the parent view — RLS scopes it either way. */
export function useStudentHistory(studentId: string | null, from: string, to: string) {
  return useQuery({
    queryKey: ['attendance', 'history', studentId, from, to],
    enabled: studentId !== null,
    queryFn: async (): Promise<AttendanceHistoryRow[]> => {
      if (!studentId) return []
      const { data: enrollments, error: enrollError } = await supabase
        .from('student_batches')
        .select('batch_id, enrolled_date')
        .eq('student_id', studentId)
      if (enrollError) throw enrollError
      if (enrollments.length === 0) return []

      const [sessionsResult, marksResult] = await Promise.all([
        supabase
          .from('schedule_sessions')
          .select('id, session_date, start_time, batch:batches(name)')
          .in(
            'batch_id',
            enrollments.map((e) => e.batch_id),
          )
          .neq('status', 'cancelled')
          .gte('session_date', from)
          .lte('session_date', to)
          .order('session_date', { ascending: false })
          .order('start_time')
          .overrideTypes<HistorySessionRow[], { merge: false }>(),
        supabase.from('attendance').select('id, session_id, status').eq('student_id', studentId),
      ])
      if (sessionsResult.error) throw sessionsResult.error
      if (marksResult.error) throw marksResult.error

      const markBySession = new Map(marksResult.data.map((m) => [m.session_id, m]))
      return sessionsResult.data.map((s) => {
        const mark = markBySession.get(s.id)
        return {
          attendanceId: mark?.id ?? null,
          sessionId: s.id,
          sessionDate: s.session_date,
          startTime: s.start_time,
          batchName: s.batch.name,
          status: mark?.status ?? null,
        }
      })
    },
  })
}

interface OverrideInput {
  academyId: string
  sessionId: string
  studentId: string
  status: AttendanceStatus
  notes?: string
}

/** Admin override. Goes straight to the table (the admin policy has no
 * time lock) — the audit_attendance trigger records who changed what. */
export function useOverrideAttendance() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ academyId, sessionId, studentId, status, notes }: OverrideInput) => {
      const { data: user } = await supabase.auth.getUser()
      const { error } = await supabase.from('attendance').upsert(
        {
          academy_id: academyId,
          session_id: sessionId,
          student_id: studentId,
          status,
          notes: notes ?? null,
          marked_by: user.user?.id ?? null,
          marked_at: new Date().toISOString(),
        },
        { onConflict: 'session_id,student_id' },
      )
      if (error) throw error
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['attendance'] })
      void queryClient.invalidateQueries({ queryKey: ['students'] })
      invalidateForTable(queryClient, 'attendance')
    },
  })
}
