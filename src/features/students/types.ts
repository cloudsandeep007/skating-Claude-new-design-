import { z } from 'zod'

import type { Enums, Tables } from '@/shared/types'

export type Student = Tables<'students'>
export type StudentStatus = Enums<'student_status'>
export type Gender = Enums<'gender'>
export type ParentRelationship = Enums<'parent_relationship'>

export interface EmergencyContact {
  name: string
  phone: string
  relationship: string
}

/** One row of the students list table — merged from students, its batch,
 * level, attendance summary and latest fee, in `api/listStudents.ts`. */
export interface StudentListItem {
  id: string
  fullName: string
  photoUrl: string | null
  status: StudentStatus
  batchId: string | null
  batchName: string | null
  levelName: string | null
  attendancePct: number | null
  feeStatus: Enums<'fee_status'> | null
  lastActiveAt: string | null
  parentName: string | null
}

export type StudentSortColumn = 'full_name' | 'joined_date'

export interface StudentListParams {
  page: number
  pageSize: number
  search: string
  /** A batch id, or 'all'. */
  batchId: string
  status: StudentStatus | 'all'
  sortBy: StudentSortColumn
  sortDir: 'asc' | 'desc'
}

export const EmergencyContactSchema = z.object({
  name: z.string().min(1, 'Emergency contact name is required'),
  phone: z.string().min(1, 'Emergency contact phone is required'),
  relationship: z.string().min(1, 'Relationship is required'),
})

// A flat (non-discriminated-union) shape on purpose: react-hook-form's Path<T>
// type inference blows up TypeScript's memory on a nested discriminated
// union inside a larger form (a known RHF+Zod interaction). `mode` picks
// which of the fields below are required — enforced in superRefine, not
// the type system.
export const ParentLinkSchema = z
  .object({
    mode: z.enum(['existing', 'new']),
    parentProfileId: z.string().optional(),
    fullName: z.string().optional(),
    email: z.string().optional(),
    phone: z.string().optional(),
    relationship: z.enum(['father', 'mother', 'guardian', 'other']),
  })
  .superRefine((data, ctx) => {
    if (data.mode === 'existing' && !data.parentProfileId) {
      ctx.addIssue({ code: 'custom', path: ['parentProfileId'], message: 'Choose a parent' })
    }
    if (data.mode === 'new') {
      if (!data.fullName) {
        ctx.addIssue({ code: 'custom', path: ['fullName'], message: "Parent's name is required" })
      }
      if (!data.phone) {
        ctx.addIssue({ code: 'custom', path: ['phone'], message: "Parent's phone is required" })
      }
      if (!data.email || !z.email().safeParse(data.email).success) {
        ctx.addIssue({ code: 'custom', path: ['email'], message: 'Enter a valid email address' })
      }
    }
  })
export type ParentLink = z.infer<typeof ParentLinkSchema>

export const StudentFormSchema = z.object({
  fullName: z.string().min(1, "Skater's name is required"),
  dateOfBirth: z.string().optional(),
  gender: z.enum(['male', 'female', 'other']).optional(),
  batchId: z.string().min(1, 'Choose a batch'),
  currentLevelId: z.string().optional(),
  emergencyContact: EmergencyContactSchema,
  medicalNotes: z.string().optional(),
  parent: ParentLinkSchema,
})
export type StudentForm = z.infer<typeof StudentFormSchema>

/** Edit reuses the same fields but the parent link is managed separately
 * (a student may already have one or more linked parents). */
export const StudentEditSchema = StudentFormSchema.omit({ parent: true })
export type StudentEdit = z.infer<typeof StudentEditSchema>
