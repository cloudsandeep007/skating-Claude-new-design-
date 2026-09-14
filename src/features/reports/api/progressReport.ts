import { useQuery } from '@tanstack/react-query'

import { supabase } from '@/shared/lib/supabase'

import type { ProgressReportRow, ReportRange } from '../types'

/** student_progress_report() RPC. */
export function useProgressReport(range: ReportRange, batchId: string | null) {
  return useQuery({
    queryKey: ['reports', 'progress', range, batchId],
    queryFn: async (): Promise<ProgressReportRow[]> => {
      const { data, error } = await supabase.rpc('student_progress_report', {
        p_from: range.from,
        p_to: range.to,
        p_batch_id: batchId ?? undefined,
      })
      if (error) throw error
      return data.map((r) => ({
        studentId: r.student_id,
        fullName: r.full_name,
        batchNames: r.batch_names,
        levelName: r.level_name,
        skillsAchievedInRange: r.skills_achieved_range,
        skillsInLevel: r.skills_in_level,
        attendancePct: r.attendance_pct,
      }))
    },
  })
}
