import { z } from 'zod'

import type { Enums, Tables } from '@/shared/types'

export type Batch = Tables<'batches'>
export type BatchStatus = Enums<'batch_status'>

export const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const

export interface BatchListItem {
  id: string
  name: string
  levelRange: string | null
  coachId: string | null
  coachName: string | null
  startTime: string
  endTime: string
  daysOfWeek: number[]
  venue: string | null
  capacity: number
  enrolledCount: number
  status: BatchStatus
}

export interface RosterEntry {
  studentId: string
  fullName: string
  levelName: string | null
  enrolledDate: string
}

export interface UpcomingSession {
  id: string
  sessionDate: string
  startTime: string
  endTime: string
  status: Enums<'session_status'>
  cancellationReason: string | null
}

export interface BatchDetail extends BatchListItem {
  roster: RosterEntry[]
  upcomingSessions: UpcomingSession[]
}

const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/

export const BatchFormSchema = z
  .object({
    name: z.string().min(1, 'Batch name is required'),
    levelRange: z.string().optional(),
    coachId: z.string().optional(),
    capacity: z.number().int().min(1, 'Capacity must be at least 1'),
    startTime: z.string().regex(TIME_REGEX, 'Enter a start time'),
    endTime: z.string().regex(TIME_REGEX, 'Enter an end time'),
    daysOfWeek: z.array(z.number().int().min(0).max(6)).min(1, 'Pick at least one day'),
    venue: z.string().optional(),
    /** Edit only: also move already-generated future sessions to the new time/coach. */
    applyToUpcomingSessions: z.boolean().optional(),
  })
  .refine((data) => data.endTime > data.startTime, {
    message: 'End time must be after start time',
    path: ['endTime'],
  })
export type BatchForm = z.infer<typeof BatchFormSchema>
