import { useQuery } from '@tanstack/react-query'

import { supabase } from '@/shared/lib/supabase'

export interface CoachOption {
  id: string
  fullName: string
}

/** Active coaches, for dropdowns in other features (e.g. assigning a batch). */
export function useCoachOptions() {
  return useQuery({
    queryKey: ['coaches', 'options'],
    queryFn: async (): Promise<CoachOption[]> => {
      const { data, error } = await supabase
        .from('coaches')
        .select('id, profile:profiles(full_name)')
        .eq('status', 'active')
      if (error) throw error
      return data
        .map((c) => ({ id: c.id, fullName: c.profile.full_name }))
        .sort((a, b) => a.fullName.localeCompare(b.fullName))
    },
  })
}
