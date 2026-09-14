import { useQuery } from '@tanstack/react-query'

import { supabase } from '@/shared/lib/supabase'

import type { AchievementEvent } from '../types'

interface HistoryRow {
  skill_id: string
  updated_at: string
  skill: { name: string; level: { name: string } }
  updated_by: { full_name: string } | null
}

/** Every skill this student has achieved, newest first — "what was
 * achieved, when, and by which coach". Deliberately scoped to student_skills
 * (readable by admin/coach/parent per RLS) rather than audit_logs, which
 * only admins can read. */
export function useAchievementHistory(studentId: string | null) {
  return useQuery({
    queryKey: ['progression', 'history', studentId],
    enabled: studentId !== null,
    queryFn: async (): Promise<AchievementEvent[]> => {
      const { data, error } = await supabase
        .from('student_skills')
        .select(
          'skill_id, updated_at, skill:skills(name, level:levels(name)), updated_by:profiles(full_name)',
        )
        .eq('student_id', studentId ?? '')
        .eq('status', 'achieved')
        .order('updated_at', { ascending: false })
        .overrideTypes<HistoryRow[], { merge: false }>()
      if (error) throw error
      return data.map((r) => ({
        skillId: r.skill_id,
        skillName: r.skill.name,
        levelName: r.skill.level.name,
        achievedAt: r.updated_at,
        coachName: r.updated_by?.full_name ?? null,
      }))
    },
  })
}
