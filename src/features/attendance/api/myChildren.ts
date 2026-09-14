import { useQuery } from '@tanstack/react-query'

import { supabase } from '@/shared/lib/supabase'

export interface ChildOption {
  id: string
  fullName: string
}

/** The signed-in parent's linked students (RLS already scopes this). */
export function useMyChildren(parentProfileId: string | undefined) {
  return useQuery({
    queryKey: ['attendance', 'my-children', parentProfileId],
    enabled: !!parentProfileId,
    queryFn: async (): Promise<ChildOption[]> => {
      const { data, error } = await supabase
        .from('parents_students')
        .select('student:students(id, full_name)')
        .eq('parent_profile_id', parentProfileId ?? '')
      if (error) throw error
      return data
        .map((row) => ({ id: row.student.id, fullName: row.student.full_name }))
        .sort((a, b) => a.fullName.localeCompare(b.fullName))
    },
  })
}
