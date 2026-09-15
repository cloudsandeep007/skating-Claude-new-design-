import { z } from 'zod'

import type { Enums, Tables } from '@/shared/types'

export type Session = Tables<'schedule_sessions'>
export type SessionStatus = Enums<'session_status'>

/** A session with what the calendar and coach views need alongside it. */
export interface SessionItem {
  id: string
  batchId: string
  batchName: string
  venue: string | null
  coachId: string | null
  coachName: string | null
  sessionDate: string
  startTime: string
  endTime: string
  status: SessionStatus
  cancellationReason: string | null
  studentCount: number
  /** Attendance rows saved for this session so far. */
  markedCount: number
  /** Set when this session IS a make-up — the original cancelled session's date. */
  makeupForDate: string | null
  /** Set on a cancelled session once a make-up has been scheduled for it. */
  makeupScheduledDate: string | null
  /** Active class_bookings for this session — who's actually expected,
   * as opposed to studentCount (everyone enrolled in the batch). */
  bookedCount: number
}

export type GenerateOutcome = 'created' | 'holiday' | 'exists' | 'coach_conflict'

export interface GenerateSummary {
  created: number
  holiday: number
  exists: number
  coachConflict: number
}

const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/

export const GenerateScheduleSchema = z
  .object({
    from: z.string().min(1, 'Choose a start date'),
    to: z.string().min(1, 'Choose an end date'),
  })
  .refine((d) => d.to >= d.from, { message: 'End date must be on or after start', path: ['to'] })
export type GenerateSchedule = z.infer<typeof GenerateScheduleSchema>

export const ExtraSessionSchema = z
  .object({
    batchId: z.string().min(1, 'Choose a batch'),
    sessionDate: z.string().min(1, 'Choose a date'),
    startTime: z.string().regex(TIME_REGEX, 'Enter a start time'),
    endTime: z.string().regex(TIME_REGEX, 'Enter an end time'),
  })
  .refine((d) => d.endTime > d.startTime, {
    message: 'End time must be after start time',
    path: ['endTime'],
  })
export type ExtraSession = z.infer<typeof ExtraSessionSchema>

export const CancelSessionSchema = z.object({
  reason: z.string().trim().min(3, 'Give parents a reason (at least a few words)'),
})
export type CancelSession = z.infer<typeof CancelSessionSchema>

export const ScheduleMakeupSchema = z
  .object({
    date: z.string().min(1, 'Choose a date'),
    startTime: z.string().regex(TIME_REGEX, 'Enter a start time'),
    endTime: z.string().regex(TIME_REGEX, 'Enter an end time'),
  })
  .refine((d) => d.endTime > d.startTime, {
    message: 'End time must be after start time',
    path: ['endTime'],
  })
export type ScheduleMakeup = z.infer<typeof ScheduleMakeupSchema>

export const HolidaySchema = z.object({
  date: z.string().min(1, 'Choose a date'),
  name: z.string().trim().min(1, 'Name the holiday'),
})
export type Holiday = z.infer<typeof HolidaySchema>
