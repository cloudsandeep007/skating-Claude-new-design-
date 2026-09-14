import { useQuery } from '@tanstack/react-query'

import { supabase } from '@/shared/lib/supabase'

export interface AcademySummary {
  id: string
  name: string
  logoUrl: string | null
}

/** The signed-in user's academy (null for super_admin). */
export function useAcademy(academyId: string | null | undefined) {
  return useQuery({
    queryKey: ['academy', academyId],
    enabled: !!academyId,
    staleTime: 10 * 60 * 1000,
    queryFn: async (): Promise<AcademySummary> => {
      const { data, error } = await supabase
        .from('academies')
        .select('id, name, logo_url')
        .eq('id', academyId ?? '')
        .single()
      if (error) throw error
      return { id: data.id, name: data.name, logoUrl: data.logo_url }
    },
  })
}
