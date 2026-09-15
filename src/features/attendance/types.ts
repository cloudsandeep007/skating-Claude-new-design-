import type { Enums, Tables } from '@/shared/types'

export type AttendanceRow = Tables<'attendance'>
export type AttendanceStatus = Enums<'attendance_status'>

export const ATTENDANCE_STATUSES: AttendanceStatus[] = ['present', 'absent', 'late', 'excused']

/** What a coach taps through on the row. Excused is admin-only. */
export const COACH_CYCLE: AttendanceStatus[] = ['present', 'absent', 'late']

export interface SessionForMarking {
  id: string
  batchId: string
  batchName: string
  venue: string | null
  sessionDate: string
  startTime: string
  endTime: string
  status: Enums<'session_status'>
  /** From the DB's own rule (session_is_editable) — the server enforces it too. */
  editable: boolean
}

export interface RosterStudent {
  id: string
  fullName: string
  photoUrl: string | null
  levelName: string | null
  /** Reserved a place for this session (or was recorded as a walk-in). */
  booked: boolean
  /** On a batch-scoped plan: marking present spends a class credit. */
  onCreditPlan: boolean
}

/** studentId → status. A student missing from the map is unmarked. */
export type Marks = Partial<Record<string, AttendanceStatus>>

export interface AttendanceMark {
  id: string
  sessionId: string
  studentId: string
  status: AttendanceStatus
  notes: string | null
  markedAt: string
}

export interface AttendanceHistoryRow {
  attendanceId: string | null
  sessionId: string
  sessionDate: string
  startTime: string
  batchName: string
  status: AttendanceStatus | null
}

export interface AttendanceTotals {
  present: number
  absent: number
  late: number
  excused: number
  counted: number
  attended: number
  pct: number | null
}

export type MakeupCreditStatus = 'pending' | 'fulfilled'

/** A class a student personally missed that owes them a make-up — granted
 * automatically when a coach marks them absent, cleared by an admin once
 * they've attended the make-up (or a scheduled one for the whole batch). */
export interface MakeupCredit {
  id: string
  studentId: string
  reasonSessionId: string
  reasonDate: string
  batchName: string
  status: MakeupCreditStatus
  grantedAt: string
  fulfilledAt: string | null
  notes: string | null
}
