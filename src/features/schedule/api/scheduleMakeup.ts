import { useMutation, useQueryClient } from '@tanstack/react-query'

import { invalidateForTable } from '@/shared/hooks/useLiveSync'
import { supabase } from '@/shared/lib/supabase'

import type { ScheduleMakeup } from '../types'

/** schedule_makeup_session() RPC: inserts a new session linked back to the
 * cancelled one, reusing the same holiday/coach-conflict checks as
 * generate_sessions(), and notifies every parent in the batch. */
async function scheduleMakeupSession({
  originalSessionId,
  form,
}: {
  originalSessionId: string
  form: ScheduleMakeup
}) {
  const { error } = await supabase.rpc('schedule_makeup_session', {
    p_original_session_id: originalSessionId,
    p_date: form.date,
    p_start: form.startTime,
    p_end: form.endTime,
  })
  if (error) throw error
}

export function useScheduleMakeupSession() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: scheduleMakeupSession,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['sessions'] })
      invalidateForTable(queryClient, 'schedule_sessions')
    },
  })
}
