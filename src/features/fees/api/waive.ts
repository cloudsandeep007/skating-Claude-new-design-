import { useMutation, useQueryClient } from '@tanstack/react-query'

import { supabase } from '@/shared/lib/supabase'

import { invalidateFeesAndCredits } from './payments'

interface WaiveInput {
  studentFeeId: string
  reason: string
}

/** A plain update — student_fees_admin_all already permits it, and the
 * existing audit_student_fees trigger records the status change and the
 * reason together, automatically. */
export function useWaiveFee() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ studentFeeId, reason }: WaiveInput) => {
      const { error } = await supabase
        .from('student_fees')
        .update({ status: 'waived', waived_reason: reason })
        .eq('id', studentFeeId)
      if (error) throw error
    },
    onSuccess: () => {
      invalidateFeesAndCredits(queryClient)
    },
  })
}
