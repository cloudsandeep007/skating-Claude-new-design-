import { useQuery } from '@tanstack/react-query'

import { supabase } from '@/shared/lib/supabase'

import type { CoachReportRow, ReportRange } from '../types'

/** coach_activity_report() RPC. */
export function useCoachReport(range: ReportRange, batchId: string | null) {
  return useQuery({
    queryKey: ['reports', 'coach', range, batchId],
    queryFn: async (): Promise<CoachReportRow[]> => {
      const { data, error } = await supabase.rpc('coach_activity_report', {
        p_from: range.from,
        p_to: range.to,
        p_batch_id: batchId ?? undefined,
      })
      if (error) throw error
      return data.map((r) => ({
        coachId: r.coach_id,
        coachName: r.coach_name,
        batchNames: r.batch_names,
        sessionCount: r.session_count,
        studentCount: r.student_count,
        attendancePct: r.attendance_pct,
      }))
    },
  })
}
