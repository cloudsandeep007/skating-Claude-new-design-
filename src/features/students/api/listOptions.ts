import { useQuery } from '@tanstack/react-query'

import { supabase } from '@/shared/lib/supabase'

// Levels aren't their own feature — a minimal lookup for the students
// form. Batch options come from @/features/batches.

export interface Option {
  id: string
  name: string
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

export interface StudentOption {
  id: string
  fullName: string
}

/** Active students, for pickers in other features (e.g. attendance by student). */
export function useStudentOptions() {
  return useQuery({
    queryKey: ['student-options'],
    queryFn: async (): Promise<StudentOption[]> => {
      const { data, error } = await supabase
        .from('students')
        .select('id, full_name')
        .eq('status', 'active')
        .order('full_name')
      if (error) throw error
      return data.map((s) => ({ id: s.id, fullName: s.full_name }))
    },
  })
}

/** Count of active students — for the admin sidebar footer. */
export function useActiveStudentCount() {
  return useQuery({
    queryKey: ['students', 'active-count'],
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<number> => {
      const { count, error } = await supabase
        .from('students')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'active')
      if (error) throw error
      return count ?? 0
    },
  })
}
