import { useQuery } from '@tanstack/react-query'

import { supabase } from '@/shared/lib/supabase'

/** The coaches.id for the signed-in coach (their profile is the auth user). */
export function useMyCoachId(profileId: string | undefined) {
  return useQuery({
    queryKey: ['coaches', 'me', profileId],
    enabled: !!profileId,
    queryFn: async (): Promise<string | null> => {
      const { data, error } = await supabase
        .from('coaches')
        .select('id')
        .eq('profile_id', profileId ?? '')
        .maybeSingle()
      if (error) throw error
      return data?.id ?? null
    },
  })
}
