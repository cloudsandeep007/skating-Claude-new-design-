import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { supabase } from '@/shared/lib/supabase'

import { allSkillsAchieved } from '../hooks/skillStatus'
import type { SkillStatus, StudentProgress, StudentSkillState } from '../types'
import { useLevels } from './levels'

interface StudentRow {
  id: string
  full_name: string
  current_level_id: string | null
}

interface SkillRow {
  id: string
  name: string
  sequence: number
  description: string | null
}

interface StudentSkillRow {
  skill_id: string
  status: SkillStatus
  notes: string | null
  updated_at: string
  updated_by: { full_name: string } | null
}

/** One student's current level and where they stand on every skill in it.
 * Reused by the coach assessment page and the admin "Progress" tab —
 * RLS decides who's actually allowed to see/write it. */
export function useStudentProgress(studentId: string | null) {
  const { data: levels } = useLevels()

  return useQuery({
    queryKey: ['progression', 'student', studentId],
    enabled: studentId !== null && levels !== undefined,
    queryFn: async (): Promise<StudentProgress> => {
      const allLevels = levels ?? []
      const { data: student, error } = await supabase
        .from('students')
        .select('id, full_name, current_level_id')
        .eq('id', studentId ?? '')
        .single()
        .overrideTypes<StudentRow, { merge: false }>()
      if (error) throw error

      const level = allLevels.find((l) => l.id === student.current_level_id) ?? null

      if (!level) {
        return {
          studentId: student.id,
          fullName: student.full_name,
          currentLevelId: null,
          currentLevelName: null,
          currentLevelSequence: null,
          totalLevels: allLevels.length,
          isTopLevel: false,
          nextLevelName: null,
          skills: [],
          allAchieved: false,
        }
      }

      const nextLevel = allLevels.find((l) => l.sequence === level.sequence + 1) ?? null

      const [skillsResult, progressResult] = await Promise.all([
        supabase
          .from('skills')
          .select('id, name, sequence, description')
          .eq('level_id', level.id)
          .order('sequence')
          .overrideTypes<SkillRow[], { merge: false }>(),
        supabase
          .from('student_skills')
          .select('skill_id, status, notes, updated_at, updated_by:profiles(full_name)')
          .eq('student_id', student.id)
          .overrideTypes<StudentSkillRow[], { merge: false }>(),
      ])
      if (skillsResult.error) throw skillsResult.error
      if (progressResult.error) throw progressResult.error

      const bySkill = new Map(progressResult.data.map((r) => [r.skill_id, r]))
      const skills: StudentSkillState[] = skillsResult.data.map((sk) => {
        const p = bySkill.get(sk.id)
        return {
          skillId: sk.id,
          skillName: sk.name,
          skillDescription: sk.description,
          status: p?.status ?? 'not_started',
          notes: p?.notes ?? null,
          updatedAt: p?.updated_at ?? null,
          updatedByName: p?.updated_by?.full_name ?? null,
        }
      })

      return {
        studentId: student.id,
        fullName: student.full_name,
        currentLevelId: level.id,
        currentLevelName: level.name,
        currentLevelSequence: level.sequence,
        totalLevels: allLevels.length,
        isTopLevel: nextLevel === null,
        nextLevelName: nextLevel?.name ?? null,
        skills,
        allAchieved: allSkillsAchieved(skills),
      }
    },
  })
}

interface AssessInput {
  academyId: string
  studentIds: string[]
  skillId: string
  status: SkillStatus
  notes?: string | null
}

/** Upserts one skill's status for one or several students in a single
 * request — the same call powers both "two taps" single assessment and
 * bulk assess. RLS (student_skills_coach_insert/_update) is what actually
 * limits a coach to their own academy and stamps updated_by = themselves. */
export function useAssessSkill() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ academyId, studentIds, skillId, status, notes }: AssessInput) => {
      const { data: userResult } = await supabase.auth.getUser()
      const rows = studentIds.map((studentId) => ({
        academy_id: academyId,
        student_id: studentId,
        skill_id: skillId,
        status,
        notes: notes ?? null,
        updated_by: userResult.user?.id ?? null,
      }))
      const { error } = await supabase
        .from('student_skills')
        .upsert(rows, { onConflict: 'student_id,skill_id' })
      if (error) throw error
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['progression'] })
      for (const studentId of variables.studentIds) {
        void queryClient.invalidateQueries({ queryKey: ['progression', 'student', studentId] })
      }
    },
  })
}

/** Current status of one skill across several students — the bulk-assess
 * page's "what's already set" reference, refetched whenever the chosen
 * skill or roster changes. */
export function useSkillStatusMap(skillId: string | null, studentIds: string[]) {
  return useQuery({
    queryKey: ['progression', 'skill-status-map', skillId, studentIds],
    enabled: skillId !== null && studentIds.length > 0,
    queryFn: async (): Promise<Record<string, SkillStatus>> => {
      const { data, error } = await supabase
        .from('student_skills')
        .select('student_id, status')
        .eq('skill_id', skillId ?? '')
        .in('student_id', studentIds)
      if (error) throw error
      const map: Record<string, SkillStatus> = {}
      for (const row of data) map[row.student_id] = row.status
      return map
    },
  })
}

interface PromoteResult {
  levelId: string
  levelName: string
}

/** promote_student() RPC — validates server-side that every skill in the
 * current level is achieved before moving the student on. */
export function usePromoteStudent() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (studentId: string): Promise<PromoteResult> => {
      const { data, error } = await supabase.rpc('promote_student', { p_student_id: studentId })
      if (error) throw new Error(error.message)
      const row = data[0]
      return { levelId: row.level_id, levelName: row.level_name }
    },
    onSuccess: (_data, studentId) => {
      void queryClient.invalidateQueries({ queryKey: ['progression'] })
      void queryClient.invalidateQueries({ queryKey: ['progression', 'student', studentId] })
      void queryClient.invalidateQueries({ queryKey: ['students'] })
    },
  })
}
