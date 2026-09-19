import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { invalidateForTable } from '@/shared/hooks/useLiveSync'
import { supabase } from '@/shared/lib/supabase'

import type { ExtraSession } from '../types'

export interface BatchForSession {
  id: string
  name: string
  startTime: string
  endTime: string
  coachId: string | null
}

/** Active batches with the defaults an extra session should start from. */
export function useBatchesForSession() {
  return useQuery({
    queryKey: ['sessions', 'batch-options'],
    queryFn: async (): Promise<BatchForSession[]> => {
      const { data, error } = await supabase
        .from('batches')
        .select('id, name, start_time, end_time, coach_id')
        .eq('status', 'active')
        .order('name')
      if (error) throw error
      return data.map((b) => ({
        id: b.id,
        name: b.name,
        startTime: b.start_time.slice(0, 5),
        endTime: b.end_time.slice(0, 5),
        coachId: b.coach_id,
      }))
    },
  })
}

/** A one-off session outside the batch's weekly rule. Refuses to double-book
 * the batch's coach at an overlapping time on that day. Holidays are allowed
 * here on purpose — an extra session on a holiday is a deliberate choice. */
async function addSession({ academyId, form }: { academyId: string; form: ExtraSession }) {
  const { data: batch, error: batchError } = await supabase
    .from('batches')
    .select('coach_id')
    .eq('id', form.batchId)
    .single()
  if (batchError) throw batchError

  if (batch.coach_id) {
    const { data: clashes, error: clashError } = await supabase
      .from('schedule_sessions')
      .select('id, batch:batches(name), start_time, end_time')
      .eq('coach_id', batch.coach_id)
      .eq('session_date', form.sessionDate)
      .neq('status', 'cancelled')
      .lt('start_time', form.endTime)
      .gt('end_time', form.startTime)
    if (clashError) throw clashError
    if (clashes.length > 0) {
      const clash = clashes[0]
      throw new Error(
        `This coach already has ${clash.batch.name} at ${clash.start_time.slice(0, 5)}–${clash.end_time.slice(0, 5)} that day.`,
      )
    }
  }

  const { error } = await supabase.from('schedule_sessions').insert({
    academy_id: academyId,
    batch_id: form.batchId,
    session_date: form.sessionDate,
    start_time: form.startTime,
    end_time: form.endTime,
    coach_id: batch.coach_id,
    status: 'scheduled',
  })
  if (error) {
    if (error.code === '23505') {
      throw new Error('That batch already has a session at this exact time.')
    }
    throw error
  }
}

export function useAddSession() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: addSession,
    onSuccess: (_data, { form }) => {
      void queryClient.invalidateQueries({ queryKey: ['sessions'] })
      invalidateForTable(queryClient, 'schedule_sessions')
      void queryClient.invalidateQueries({ queryKey: ['batches', 'detail', form.batchId] })
    },
  })
}
