import { useQuery } from '@tanstack/react-query'

import { supabase } from '@/shared/lib/supabase'

import type { LevelDistributionRow, StaleStudentRow } from '../types'

/** Active skaters per level, in ladder order — level_distribution() RPC. */
export function useLevelDistribution() {
  return useQuery({
    queryKey: ['progression', 'distribution'],
    queryFn: async (): Promise<LevelDistributionRow[]> => {
      const { data, error } = await supabase.rpc('level_distribution')
      if (error) throw error
      return data.map((r) => ({
        levelId: r.level_id,
        levelName: r.level_name,
        sequence: r.sequence,
        studentCount: r.student_count,
      }))
    },
  })
}

/** Active skaters with no skill achieved in the window — stale_students() RPC. */
export function useStaleStudents(days = 60) {
  return useQuery({
    queryKey: ['progression', 'stale', days],
    queryFn: async (): Promise<StaleStudentRow[]> => {
      const { data, error } = await supabase.rpc('stale_students', { p_days: days })
      if (error) throw error
      return data.map((r) => ({
        studentId: r.student_id,
        fullName: r.full_name,
        levelName: r.level_name,
        lastAchievedAt: r.last_achieved_at,
        daysSince: r.days_since,
        isTopLevel: r.is_top_level,
      }))
    },
  })
}
