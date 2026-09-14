import { useQuery } from '@tanstack/react-query'

import { supabase } from '@/shared/lib/supabase'

import type { BatchCapacityRow } from '../types'

/** batch_capacity_summary() RPC. */
export function useBatchCapacity() {
  return useQuery({
    queryKey: ['dashboard', 'batch-capacity'],
    queryFn: async (): Promise<BatchCapacityRow[]> => {
      const { data, error } = await supabase.rpc('batch_capacity_summary')
      if (error) throw error
      return data.map((r) => ({
        batchId: r.batch_id,
        batchName: r.batch_name,
        enrolledCount: r.enrolled_count,
        capacity: r.capacity,
      }))
    },
  })
}
