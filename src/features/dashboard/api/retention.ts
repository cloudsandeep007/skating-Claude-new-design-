import { useQuery } from '@tanstack/react-query'

import { supabase } from '@/shared/lib/supabase'

import type { MonthPoint } from '../types'

function monthLabel(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { month: 'short' })
}

/** monthly_active_students() RPC. */
export function useRetention(months: number) {
  return useQuery({
    queryKey: ['dashboard', 'retention', months],
    queryFn: async (): Promise<MonthPoint[]> => {
      const { data, error } = await supabase.rpc('monthly_active_students', { p_months: months })
      if (error) throw error
      return data.map((r) => ({ month: monthLabel(r.month), value: r.active_count }))
    },
  })
}
