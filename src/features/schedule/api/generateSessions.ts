import { useMutation, useQueryClient } from '@tanstack/react-query'

import { invalidateForTable } from '@/shared/hooks/useLiveSync'
import { supabase } from '@/shared/lib/supabase'

import type { GenerateOutcome, GenerateSummary } from '../types'

interface GenerateInput {
  batchId: string
  from: string
  to: string
}

/** Calls the generate_sessions() RPC (see 0003_scheduling.sql), which does
 * the day-by-day expansion server-side so holiday and coach-conflict
 * checks happen in one transaction against current data. */
async function generateSessions({ batchId, from, to }: GenerateInput): Promise<GenerateSummary> {
  const { data, error } = await supabase.rpc('generate_sessions', {
    p_batch_id: batchId,
    p_from: from,
    p_to: to,
  })
  if (error) throw error

  const summary: GenerateSummary = { created: 0, holiday: 0, exists: 0, coachConflict: 0 }
  for (const row of data) {
    switch (row.outcome as GenerateOutcome) {
      case 'created':
        summary.created += 1
        break
      case 'holiday':
        summary.holiday += 1
        break
      case 'exists':
        summary.exists += 1
        break
      case 'coach_conflict':
        summary.coachConflict += 1
        break
    }
  }
  return summary
}

export function useGenerateSessions() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: generateSessions,
    onSuccess: (_summary, { batchId }) => {
      void queryClient.invalidateQueries({ queryKey: ['sessions'] })
      invalidateForTable(queryClient, 'schedule_sessions')
      void queryClient.invalidateQueries({ queryKey: ['batches', 'detail', batchId] })
    },
  })
}
