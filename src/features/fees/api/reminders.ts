import { useMutation, useQueryClient } from '@tanstack/react-query'

import { supabase } from '@/shared/lib/supabase'

/** Sends a "fee due" in-app notification to every parent linked to each
 * selected fee's student, via the send_fee_reminders() RPC — reuses the
 * existing notifications pipeline (realtime toast + unread badge), the same
 * way session-cancellation notifications already work. Returns how many
 * notifications actually went out (a student with no linked parent is
 * skipped, not an error). */
export function useSendFeeReminders() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (studentFeeIds: string[]): Promise<number> => {
      const { data, error } = await supabase.rpc('send_fee_reminders', {
        p_student_fee_ids: studentFeeIds,
      })
      if (error) throw error
      return data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['fees', 'list'] })
    },
  })
}
