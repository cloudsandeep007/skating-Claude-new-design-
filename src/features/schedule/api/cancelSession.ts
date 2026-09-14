import { useMutation, useQueryClient } from '@tanstack/react-query'

import { supabase } from '@/shared/lib/supabase'

/** cancel_session() RPC: flips the status, stores the reason, and inserts
 * one notification per affected parent — all in one transaction. */
async function cancelSession({ sessionId, reason }: { sessionId: string; reason: string }) {
  const { error } = await supabase.rpc('cancel_session', {
    p_session_id: sessionId,
    p_reason: reason,
  })
  if (error) throw error
}

export function useCancelSession() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: cancelSession,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['sessions'] })
      void queryClient.invalidateQueries({ queryKey: ['batches'] })
    },
  })
}
