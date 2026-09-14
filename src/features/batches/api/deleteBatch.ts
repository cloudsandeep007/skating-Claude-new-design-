import { useMutation, useQueryClient } from '@tanstack/react-query'

import { supabase } from '@/shared/lib/supabase'

/** A real delete, not a status flip — for a batch created by mistake. Unlike
 * a coach or a level, this one does destroy history: schedule_sessions and
 * their attendance cascade-delete with the batch (ON DELETE CASCADE, see
 * 0001_initial_schema.sql), same as student_batches enrollment records. The
 * confirm dialog spells this out; prefer Deactivate for a batch that's just
 * paused or finished for the season. */
async function deleteBatch(batchId: string) {
  const { error } = await supabase.from('batches').delete().eq('id', batchId)
  if (error) throw error
}

export function useDeleteBatch() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: deleteBatch,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['batches'] })
      void queryClient.invalidateQueries({ queryKey: ['batch-options'] })
      void queryClient.invalidateQueries({ queryKey: ['sessions'] })
    },
  })
}
