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
    fee_plan: { batch_id: string | null } | null
  }
}

interface BookedRow {
  status: 'booked' | 'pending'
  student: {
    id: string
    full_name: string
    photo_url: string | null
    current_level: { name: string } | null
  }
}

/** A session's roster is every actively-enrolled student in the batch,
 * flagged with whether they booked this session. Booked skaters are who
 * the coach expects; the rest can still be marked — attendance is the
 * final word on credits, so a walk-in marked present spends a credit
 * exactly as if they'd booked. */
async function fetchMarkingData(sessionId: string): Promise<MarkingData> {
  const { data: session, error } = await supabase
    .from('schedule_sessions')
    .select('id, batch_id, session_date, start_time, end_time, status, batch:batches(name, venue)')
    .eq('id', sessionId)
    .single()
    .overrideTypes<SessionRow, { merge: false }>()
  if (error) throw error

  const [editableResult, enrolledResult, bookedResult, marksResult] = await Promise.all([
    supabase.rpc('session_is_editable', { p_session_id: sessionId }),
    supabase
      .from('student_batches')
      .select(
        'student:students(id, full_name, photo_url, current_level:levels(name), fee_plan:fee_plans(batch_id))',
      )
      .eq('batch_id', session.batch_id)
      .eq('status', 'active')
      .overrideTypes<RosterRow[], { merge: false }>(),
    supabase
      .from('class_bookings')
      .select('status, student:students(id, full_name, photo_url, current_level:levels(name))')
      .eq('session_id', sessionId)
      .in('status', ['booked', 'pending'])
      .overrideTypes<BookedRow[], { merge: false }>(),
    supabase.from('attendance').select('student_id, status').eq('session_id', sessionId),
  ])
  if (enrolledResult.error) throw enrolledResult.error
  if (bookedResult.error) throw bookedResult.error
  if (marksResult.error) throw marksResult.error

  const bookingById = new Map(bookedResult.data.map((r) => [r.student.id, r.status]))
  const rosterById = new Map<
    string,
    (RosterRow['student'] | BookedRow['student']) & {
      booked: boolean
      bookingStatus: 'booked' | 'pending' | null
      onCreditPlan: boolean
    }
  >()
  for (const r of enrolledResult.data) {
    const status = bookingById.get(r.student.id) ?? null
    rosterById.set(r.student.id, {
      ...r.student,
      booked: status === 'booked',
      bookingStatus: status,
      onCreditPlan: r.student.fee_plan?.batch_id != null,
    })
  }
  // A booking from a skater no longer enrolled (moved batch) still shows.
  for (const r of bookedResult.data) {
    if (!rosterById.has(r.student.id)) {
      rosterById.set(r.student.id, {
        ...r.student,
        booked: r.status === 'booked',
        bookingStatus: r.status,
        onCreditPlan: true,
      })
    }
  }

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
    roster: [...rosterById.values()]
      .map((s) => ({
        id: s.id,
        fullName: s.full_name,
        photoUrl: s.photo_url,
        levelName: s.current_level?.name ?? null,
        booked: s.booked,
        bookingStatus: s.bookingStatus,
        onCreditPlan: s.onCreditPlan,
      }))
      .sort(
        (a, b) =>
          Number(b.booked) - Number(a.booked) ||
          Number(b.onCreditPlan) - Number(a.onCreditPlan) ||
          a.fullName.localeCompare(b.fullName),
      ),
    saved,
  }
}

export function useSessionForMarking(sessionId: string) {
  return useQuery({
    queryKey: ['attendance', 'session', sessionId],
    queryFn: () => fetchMarkingData(sessionId),
  })
}
