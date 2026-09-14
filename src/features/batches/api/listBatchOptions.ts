import { useQuery } from '@tanstack/react-query'

import { supabase } from '@/shared/lib/supabase'

export interface BatchOption {
  id: string
  name: string
}

/** Active batches for dropdowns in other features. */
export function useBatchOptions() {
  return useQuery({
    queryKey: ['batch-options'],
    queryFn: async (): Promise<BatchOption[]> => {
      const { data, error } = await supabase
        .from('batches')
        .select('id, name')
        .eq('status', 'active')
        .order('name')
      if (error) throw error
      return data
    },
  })
}
