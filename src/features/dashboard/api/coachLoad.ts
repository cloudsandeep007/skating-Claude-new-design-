import { useQuery } from '@tanstack/react-query'

import { supabase } from '@/shared/lib/supabase'

import type { CoachLoadRow } from '../types'

/** coach_load_summary() RPC. */
export function useCoachLoad(days: number) {
  return useQuery({
    queryKey: ['dashboard', 'coach-load', days],
    queryFn: async (): Promise<CoachLoadRow[]> => {
      const { data, error } = await supabase.rpc('coach_load_summary', { p_days: days })
      if (error) throw error
      return data.map((r) => ({
        coachId: r.coach_id,
        coachName: r.coach_name,
        studentCount: r.student_count,
        sessionCount: r.session_count,
      }))
    },
  })
}
