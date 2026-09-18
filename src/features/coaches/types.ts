import { z } from 'zod'

import { phoneSchema, requiredText } from '@/shared/lib/validation'

import type { Enums, Tables } from '@/shared/types'

export type Coach = Tables<'coaches'>
export type CoachStatus = Enums<'coach_status'>

export interface CoachListItem {
  id: string
  profileId: string
  fullName: string
  email: string | null
  phone: string | null
  specialization: string | null
  photoUrl: string | null
  status: CoachStatus
  batchCount: number
  studentCount: number
}

export const CoachFormSchema = z.object({
  fullName: requiredText("Coach's name is required"),
  email: z.email('Enter a valid email address'),
  phone: phoneSchema,
  specialization: z.string().optional(),
})
export type CoachForm = z.infer<typeof CoachFormSchema>

export const CoachEditSchema = z.object({
  fullName: requiredText("Coach's name is required"),
  phone: phoneSchema,
  specialization: z.string().optional(),
})
export type CoachEdit = z.infer<typeof CoachEditSchema>
