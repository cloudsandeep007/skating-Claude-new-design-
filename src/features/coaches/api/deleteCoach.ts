import { useMutation, useQueryClient } from '@tanstack/react-query'

import { invokeFunction } from '@/shared/lib/invokeFunction'

/** A real delete, not a status flip — for a coach entered by mistake, or one
 * who never actually worked here. Goes through the delete-user Edge
 * Function (service-role only) because removing just the coaches row would
 * leave their login working with a broken, coach-less profile; deleting the
 * underlying account is the only way to fully revoke it. Any batch/session
 * they were assigned to keeps running — coach_id there is ON DELETE SET
 * NULL, so it just drops to "no coach assigned" (0001_initial_schema.sql).
 * Prefer "Deactivate" for a coach who's on leave or left on good terms;
 * this is for undoing a mistake. */
async function deleteCoach(profileId: string) {
  await invokeFunction('delete-user', { profile_id: profileId })
}

export function useDeleteCoach() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: deleteCoach,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['coaches'] })
      void queryClient.invalidateQueries({ queryKey: ['batches'] })
      void queryClient.invalidateQueries({ queryKey: ['batch-options'] })
    },
  })
}
