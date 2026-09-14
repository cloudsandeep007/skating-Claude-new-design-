import { useQuery } from '@tanstack/react-query'

import { toIsoDate } from '@/shared/lib/format'
import { supabase } from '@/shared/lib/supabase'

import type { RevenuePoint } from '../types'

function monthLabel(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { month: 'short' })
}

/** Reads monthly_collection_totals directly — it's a proper Postgres view
 * (security_invoker, scoped to the caller's academy by RLS on the tables
 * it aggregates), not a raw table query. */
export function useRevenueTrend(months: number) {
  return useQuery({
    queryKey: ['dashboard', 'revenue-trend', months],
    queryFn: async (): Promise<RevenuePoint[]> => {
      const cutoff = new Date()
      cutoff.setDate(1)
      cutoff.setMonth(cutoff.getMonth() - (months - 1))
      const { data, error } = await supabase
        .from('monthly_collection_totals')
        .select('month, collected, expected')
        .gte('month', toIsoDate(cutoff))
        .order('month')
      if (error) throw error
      return data.map((r) => ({
        month: monthLabel(r.month ?? toIsoDate(cutoff)),
        collected: r.collected ?? 0,
        expected: r.expected ?? 0,
      }))
    },
  })
}
