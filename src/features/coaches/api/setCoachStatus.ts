import { useMutation, useQueryClient } from '@tanstack/react-query'

import { invalidateForTable } from '@/shared/hooks/useLiveSync'
import { supabase } from '@/shared/lib/supabase'

import type { CoachListItem, CoachStatus } from '../types'

async function setCoachStatus(coachId: string, status: CoachStatus) {
  const { error } = await supabase.from('coaches').update({ status }).eq('id', coachId)
  if (error) throw error
}

/** Deactivating a coach is a status flip, not a delete — their history
 * (past sessions, attendance they marked) is untouched. Optimistic because
 * it's a single reversible field. */
export function useSetCoachStatus() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ coachId, status }: { coachId: string; status: CoachStatus }) =>
      setCoachStatus(coachId, status),
    onMutate: async ({ coachId, status }) => {
      await queryClient.cancelQueries({ queryKey: ['coaches'] })
      const previous = queryClient.getQueryData<CoachListItem[]>(['coaches'])
      queryClient.setQueryData<CoachListItem[]>(['coaches'], (list) =>
        list?.map((c) => (c.id === coachId ? { ...c, status } : c)),
      )
      return { previous }
    },
    onError: (_err, _vars, context) => {
      if (context) queryClient.setQueryData(['coaches'], context.previous)
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['coaches'] })
      invalidateForTable(queryClient, 'coaches')
    },
  })
}
