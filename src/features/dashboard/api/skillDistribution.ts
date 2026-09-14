import { useQuery } from '@tanstack/react-query'

import { supabase } from '@/shared/lib/supabase'

import type { SkillLevelRow } from '../types'

/** level_distribution() RPC — the same one the Progress screen uses, read
 * directly here rather than importing the progression feature (it's a
 * plain RPC call, not feature-internal logic). */
export function useSkillDistribution() {
  return useQuery({
    queryKey: ['dashboard', 'skill-distribution'],
    queryFn: async (): Promise<SkillLevelRow[]> => {
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
