import { useQuery } from '@tanstack/react-query'

import { supabase } from '@/shared/lib/supabase'

import type { DashboardStatCards } from '../types'

/** dashboard_stat_cards() RPC — the 4 top cards in one round trip. */
export function useDashboardStatCards() {
  return useQuery({
    queryKey: ['dashboard', 'stat-cards'],
    queryFn: async (): Promise<DashboardStatCards> => {
      const { data, error } = await supabase.rpc('dashboard_stat_cards').single()
      if (error) throw error
      return {
        activeStudents: data.active_students,
        newStudentsThisMonth: data.new_students_this_month,
        todayAttendancePct: data.today_attendance_pct,
        lastMonthAttendancePct: data.last_month_attendance_pct,
        feesCollectedThisMonth: data.fees_collected_this_month,
        feesCollectedLastMonth: data.fees_collected_last_month,
        outstandingTotal: data.outstanding_total,
        outstandingStudents: data.outstanding_students,
        outstandingDueThisMonth: data.outstanding_due_this_month,
        outstandingDueLastMonth: data.outstanding_due_last_month,
      }
    },
  })
}
