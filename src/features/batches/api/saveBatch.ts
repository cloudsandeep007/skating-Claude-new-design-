import { useMutation, useQueryClient } from '@tanstack/react-query'

import { emptyToNull } from '@/shared/lib/emptyToNull'
import { todayIso } from '@/shared/lib/format'
import { invalidateForTable } from '@/shared/hooks/useLiveSync'
import { supabase } from '@/shared/lib/supabase'

import type { BatchForm } from '../types'

function toRow(form: BatchForm) {
  return {
    name: form.name,
    level_range: emptyToNull(form.levelRange),
    coach_id: emptyToNull(form.coachId),
    capacity: form.capacity,
    start_time: form.startTime,
    end_time: form.endTime,
    days_of_week: [...form.daysOfWeek].sort((a, b) => a - b),
    venue: emptyToNull(form.venue),
  }
}

async function createBatch({ academyId, form }: { academyId: string; form: BatchForm }) {
  const { data, error } = await supabase
    .from('batches')
    .insert({ academy_id: academyId, ...toRow(form) })
    .select('id')
    .single()
  if (error) throw error
  return data.id
}

export interface UpdateBatchResult {
  /** Upcoming sessions on days the batch no longer meets, taken off the calendar. */
  removed: number
  /** …of which had bookings, so were cancelled (credits released, parents told). */
  cancelled: number
}

/** Editing a batch never rewrites sessions that already exist — each
 * session stores its own time and coach. Only when the admin opts in do we
 * touch *future scheduled* sessions: move them to the new time/coach, and
 * take off the calendar any that fall on a day the batch no longer meets
 * (realign_batch_sessions — deleted if nobody booked, cancelled with a
 * notification if someone had). Completed and cancelled sessions, and
 * make-up sessions, are always left exactly as they were. */
async function updateBatch({
  batchId,
  form,
}: {
  batchId: string
  form: BatchForm
}): Promise<UpdateBatchResult> {
  const { error } = await supabase.from('batches').update(toRow(form)).eq('id', batchId)
  if (error) throw error

  const result: UpdateBatchResult = { removed: 0, cancelled: 0 }
  if (form.applyToUpcomingSessions) {
    const today = todayIso()
    const { error: sessionsError } = await supabase
      .from('schedule_sessions')
      .update({
        start_time: form.startTime,
        end_time: form.endTime,
        coach_id: emptyToNull(form.coachId),
      })
      .eq('batch_id', batchId)
      .eq('status', 'scheduled')
      .gte('session_date', today)
    if (sessionsError) throw sessionsError

    const { data: realigned, error: realignError } = await supabase
      .rpc('realign_batch_sessions', { p_batch_id: batchId })
      .single()
    if (realignError) throw realignError
    result.removed = realigned.removed
    result.cancelled = realigned.cancelled
  }
  return result
}

export function useCreateBatch() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createBatch,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['batches'] })
      void queryClient.invalidateQueries({ queryKey: ['batch-options'] })
    },
  })
}

export function useUpdateBatch() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: updateBatch,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['batches'] })
      void queryClient.invalidateQueries({ queryKey: ['batch-options'] })
      void queryClient.invalidateQueries({ queryKey: ['sessions'] })
      invalidateForTable(queryClient, 'batches')
      invalidateForTable(queryClient, 'schedule_sessions')
      invalidateForTable(queryClient, 'class_bookings')
    },
  })
}
