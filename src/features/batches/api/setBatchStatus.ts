import { useMutation, useQueryClient } from '@tanstack/react-query'

import { invalidateForTable } from '@/shared/hooks/useLiveSync'
import { supabase } from '@/shared/lib/supabase'

import type { BatchListItem, BatchStatus } from '../types'

async function setBatchStatus(batchId: string, status: BatchStatus) {
  const { error } = await supabase.from('batches').update({ status }).eq('id', batchId)
  if (error) throw error
}

/** Deactivating a batch is a status flip, not a delete — its roster,
 * schedule and attendance history are untouched. */
export function useSetBatchStatus() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ batchId, status }: { batchId: string; status: BatchStatus }) =>
      setBatchStatus(batchId, status),
    onMutate: async ({ batchId, status }) => {
      await queryClient.cancelQueries({ queryKey: ['batches'] })
      const previous = queryClient.getQueryData<BatchListItem[]>(['batches'])
      queryClient.setQueryData<BatchListItem[]>(['batches'], (list) =>
        list?.map((b) => (b.id === batchId ? { ...b, status } : b)),
      )
      return { previous }
    },
    onError: (_err, _vars, context) => {
      if (context) queryClient.setQueryData(['batches'], context.previous)
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['batches'] })
      invalidateForTable(queryClient, 'batches')
    },
  })
}
