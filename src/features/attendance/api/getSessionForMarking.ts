import { useQuery } from '@tanstack/react-query'

import { addDays, todayIso } from '@/shared/lib/format'
import { supabase } from '@/shared/lib/supabase'

import type { Marks, RosterStudent, SessionForMarking } from '../types'

export interface MarkingData {
  session: SessionForMarking
  roster: RosterStudent[]
  /** What's already saved on the server for this session. */
  saved: Marks
}

interface SessionRow {
  id: string
  batch_id: string
  session_date: string
  start_time: string
  end_time: string
  status: SessionForMarking['status']
  batch: { name: string; venue: string | null }
}

interface RosterRow {
  student: {
    id: string
    full_name: string
    photo_url: string | null
    current_level: { name: string } | null
  }
}

async function fetchMarkingData(sessionId: string): Promise<MarkingData> {
  const { data: session, error } = await supabase
    .from('schedule_sessions')
    .select('id, batch_id, session_date, start_time, end_time, status, batch:batches(name, venue)')
    .eq('id', sessionId)
    .single()
    .overrideTypes<SessionRow, { merge: false }>()
  if (error) throw error

  const [editableResult, rosterResult, marksResult] = await Promise.all([
    supabase.rpc('session_is_editable', { p_session_id: sessionId }),
    supabase
      .from('student_batches')
      .select('student:students(id, full_name, photo_url, current_level:levels(name))')
      .eq('batch_id', session.batch_id)
      .eq('status', 'active')
      .overrideTypes<RosterRow[], { merge: false }>(),
    supabase.from('attendance').select('student_id, status').eq('session_id', sessionId),
  ])
  if (rosterResult.error) throw rosterResult.error
  if (marksResult.error) throw marksResult.error

  const saved: Marks = {}
  for (const row of marksResult.data) saved[row.student_id] = row.status

  return {
    session: {
      id: session.id,
      batchId: session.batch_id,
      batchName: session.batch.name,
      venue: session.batch.venue,
      sessionDate: session.session_date,
      startTime: session.start_time,
      endTime: session.end_time,
      status: session.status,
      // The DB rule is authoritative (and enforced by RLS on save). If the
      // RPC isn't available yet, approximate it: today or yesterday.
      editable: editableResult.error
        ? session.session_date >= addDays(todayIso(), -1) && session.session_date <= todayIso()
        : editableResult.data,
    },
    roster: rosterResult.data
      .map((r) => ({
        id: r.student.id,
        fullName: r.student.full_name,
        photoUrl: r.student.photo_url,
        levelName: r.student.current_level?.name ?? null,
      }))
      .sort((a, b) => a.fullName.localeCompare(b.fullName)),
    saved,
  }
}

export function useSessionForMarking(sessionId: string) {
  return useQuery({
    queryKey: ['attendance', 'session', sessionId],
    queryFn: () => fetchMarkingData(sessionId),
  })
}
