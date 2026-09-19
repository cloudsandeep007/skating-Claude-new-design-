import { useMutation, useQueryClient } from '@tanstack/react-query'

import { invalidateForTable } from '@/shared/hooks/useLiveSync'
import { supabase } from '@/shared/lib/supabase'

/** generate_upcoming_fees(academy) RPC, scoped to the caller's own academy
 * by RLS regardless of what's passed — the same scheduled function that
 * runs the Edge Function's cron, just for one academy on demand. Returns
 * how many fee records were created. */
export function useGenerateFees() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (academyId: string): Promise<number> => {
      const { data, error } = await supabase.rpc('generate_upcoming_fees', {
        p_academy_id: academyId,
      })
      if (error) throw new Error(error.message)
      return data.length
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['fees'] })
      invalidateForTable(queryClient, 'student_fees')
      invalidateForTable(queryClient, 'student_advances')
    },
  })
}
