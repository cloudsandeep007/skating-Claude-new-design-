import { useQuery } from '@tanstack/react-query'

import { supabase } from '@/shared/lib/supabase'

import type { FeeDashboardSummary } from '../types'

/** monthly_collection_totals is SECURITY INVOKER — RLS scopes it to the
 * caller's academy automatically. `month` is any date within the target
 * calendar month (e.g. the 1st). */
export function useFeeDashboard(month: string) {
  return useQuery({
    queryKey: ['fees', 'dashboard', month],
    queryFn: async (): Promise<FeeDashboardSummary> => {
      const monthStart = `${month.slice(0, 7)}-01`
      const { data, error } = await supabase
        .from('monthly_collection_totals')
        .select('*')
        .eq('month', monthStart)
        .maybeSingle()
      if (error) throw error
      return {
        month: monthStart,
        collected: data?.collected ?? 0,
        paymentCount: data?.payment_count ?? 0,
        expected: data?.expected ?? 0,
        outstanding: data?.outstanding ?? 0,
        overdueCount: data?.overdue_count ?? 0,
        pendingCount: data?.pending_count ?? 0,
        paidCount: data?.paid_count ?? 0,
        waivedCount: data?.waived_count ?? 0,
      }
    },
  })
}
