import { useQuery } from '@tanstack/react-query'

import { supabase } from '@/shared/lib/supabase'

// Batches and levels aren't their own feature yet (batches lands in Phase
// 1.2) — these are minimal read-only lookups for the students form/filters
// until that feature exists to own them.

export interface Option {
  id: string
  name: string
}

export function useBatchOptions() {
  return useQuery({
    queryKey: ['batch-options'],
    queryFn: async () => {
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

export function useLevelOptions() {
  return useQuery({
    queryKey: ['level-options'],
    queryFn: async () => {
      const { data, error } = await supabase.from('levels').select('id, name').order('sequence')
      if (error) throw error
      return data
    },
  })
}

export interface ParentOption {
  id: string
  fullName: string
  email: string | null
}

export function useParentOptions() {
  return useQuery({
    queryKey: ['parent-options'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .eq('role', 'parent')
        .order('full_name')
      if (error) throw error
      return data.map((p): ParentOption => ({ id: p.id, fullName: p.full_name, email: p.email }))
    },
  })
}
