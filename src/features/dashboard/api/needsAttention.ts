import { useQuery } from '@tanstack/react-query'

import { supabase } from '@/shared/lib/supabase'

import type { NeedsAttentionRow } from '../types'

/** needs_attention() RPC — fixed at 30 days / 60% / 3 sessions, matching
 * the spec exactly ("below 60% in the last 30 days"). Not tied to the
 * dashboard's date-range selector — it's a standing alert, not a report. */
export function useNeedsAttention() {
  return useQuery({
    queryKey: ['dashboard', 'needs-attention'],
    queryFn: async (): Promise<NeedsAttentionRow[]> => {
      const { data, error } = await supabase.rpc('needs_attention', {
        p_days: 30,
        p_threshold: 60,
        p_min_sessions: 3,
      })
      if (error) throw error
      return data.map((r) => ({
        studentId: r.student_id,
        fullName: r.full_name,
        photoUrl: r.photo_url,
        batchNames: r.batch_names,
        levelName: r.level_name,
        countedSessions: r.counted_sessions,
        attendedSessions: r.attended_sessions,
        missedSessions: r.missed_sessions,
        attendancePct: r.attendance_pct,
        parentName: r.parent_name,
        parentPhone: r.parent_phone,
        hasOverdueFee: r.has_overdue_fee,
      }))
    },
  })
}
