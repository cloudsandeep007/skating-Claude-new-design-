import { useQuery } from '@tanstack/react-query'

import { supabase } from '@/shared/lib/supabase'

import type { AttendanceReportRow, ReportRange } from '../types'

/** attendance_summary_for_range() RPC — already existed from the
 * attendance feature; reused as-is for the report. */
export function useAttendanceReport(range: ReportRange, batchId: string | null) {
  return useQuery({
    queryKey: ['reports', 'attendance', range, batchId],
    queryFn: async (): Promise<AttendanceReportRow[]> => {
      const { data, error } = await supabase.rpc('attendance_summary_for_range', {
        p_from: range.from,
        p_to: range.to,
        ...(batchId ? { p_batch_id: batchId } : {}),
      })
      if (error) throw error
      return data.map((r) => ({
        studentId: r.student_id,
        fullName: r.full_name,
        counted: r.counted_sessions,
        attended: r.attended_sessions,
        absent: r.absent_sessions,
        late: r.late_sessions,
        excused: r.excused_sessions,
        pct: r.attendance_pct,
        expected: r.expected_sessions,
        makeupOwed: r.pending_makeup_credits,
      }))
    },
  })
}
