import { z } from 'zod'

import type { Enums, Tables } from '@/shared/types'

export type Level = Tables<'levels'>
export type Skill = Tables<'skills'>
export type SkillStatus = Enums<'skill_status'>

export const SKILL_STATUSES: SkillStatus[] = ['not_started', 'learning', 'achieved']

/** What one tap on a status chip sets it to next — not_started -> learning
 * -> achieved -> back to not_started. The assessment UI shows all three
 * chips at once though, so in practice picking the right one is one tap. */
export const SKILL_STATUS_CYCLE: Record<SkillStatus, SkillStatus> = {
  not_started: 'learning',
  learning: 'achieved',
  achieved: 'not_started',
}

export interface SkillRow {
  id: string
  levelId: string
  name: string
  sequence: number
  description: string | null
}

export interface LevelWithSkills {
  id: string
  name: string
  sequence: number
  description: string | null
  skills: SkillRow[]
}

export interface StudentSkillState {
  skillId: string
  skillName: string
  skillDescription: string | null
  status: SkillStatus
  notes: string | null
  updatedAt: string | null
  updatedByName: string | null
}

export interface StudentProgress {
  studentId: string
  fullName: string
  currentLevelId: string | null
  currentLevelName: string | null
  currentLevelSequence: number | null
  totalLevels: number
  isTopLevel: boolean
  nextLevelName: string | null
  skills: StudentSkillState[]
  allAchieved: boolean
}

export interface AchievementEvent {
  skillId: string
  skillName: string
  levelName: string
  achievedAt: string
  coachName: string | null
}

export interface RosterStudentForSkills {
  id: string
  fullName: string
  photoUrl: string | null
  levelId: string | null
  levelName: string | null
}

export interface LevelDistributionRow {
  levelId: string
  levelName: string
  sequence: number
  studentCount: number
}

export interface StaleStudentRow {
  studentId: string
  fullName: string
  levelName: string | null
  lastAchievedAt: string | null
  daysSince: number
  isTopLevel: boolean
}

export const LevelFormSchema = z.object({
  name: z.string().trim().min(1, 'Level name is required'),
  description: z.string().optional(),
})
export type LevelForm = z.infer<typeof LevelFormSchema>

export const SkillFormSchema = z.object({
  name: z.string().trim().min(1, 'Skill name is required'),
  description: z.string().optional(),
})
export type SkillForm = z.infer<typeof SkillFormSchema>
