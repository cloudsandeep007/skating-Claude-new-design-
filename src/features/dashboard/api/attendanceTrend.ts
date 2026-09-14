import { useQuery } from '@tanstack/react-query'

import { supabase } from '@/shared/lib/supabase'

import type { MonthPoint } from '../types'

function monthLabel(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { month: 'short' })
}

/** monthly_attendance_trend() RPC — filterable by batch, per the spec. */
export function useAttendanceTrend(months: number, batchId: string | null) {
  return useQuery({
    queryKey: ['dashboard', 'attendance-trend', months, batchId],
    queryFn: async (): Promise<MonthPoint[]> => {
      const { data, error } = await supabase.rpc('monthly_attendance_trend', {
        p_months: months,
        p_batch_id: batchId ?? undefined,
      })
      if (error) throw error
      return data.map((r) => ({ month: monthLabel(r.month), value: r.attendance_pct }))
    },
  })
}
