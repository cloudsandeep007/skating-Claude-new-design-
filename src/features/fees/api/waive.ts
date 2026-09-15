import { useMutation, useQueryClient } from '@tanstack/react-query'

import { supabase } from '@/shared/lib/supabase'

import { invalidateFeesAndCredits } from './payments'

interface WaiveInput {
  studentFeeId: string
  reason: string
}

/** waive_fee() RPC — only a pending/overdue fee, only with a reason. A fee's
 * status can't be set from the browser directly any more (a database
 * trigger refuses it), so this goes through the function like every other
 * status change. The audit trigger records the change and the reason. */
export function useWaiveFee() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ studentFeeId, reason }: WaiveInput) => {
      const { error } = await supabase.rpc('waive_fee', {
        p_fee_id: studentFeeId,
        p_reason: reason,
      })
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      invalidateFeesAndCredits(queryClient)
    },
  })
}
