import { useMutation, useQueryClient } from '@tanstack/react-query'

import { emptyToNull } from '@/shared/lib/emptyToNull'
import { supabase } from '@/shared/lib/supabase'

function invalidateLevels(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: ['progression', 'levels'] })
}

interface CreateLevelInput {
  academyId: string
  name: string
  description?: string
  sequence: number
}

export function useCreateLevel() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ academyId, name, description, sequence }: CreateLevelInput) => {
      const { error } = await supabase.from('levels').insert({
        academy_id: academyId,
        name,
        description: emptyToNull(description),
        sequence,
      })
      if (error) throw error
    },
    onSuccess: () => {
      invalidateLevels(queryClient)
    },
  })
}

interface UpdateLevelInput {
  id: string
  name: string
  description?: string
}

export function useUpdateLevel() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, name, description }: UpdateLevelInput) => {
      const { error } = await supabase
        .from('levels')
        .update({ name, description: emptyToNull(description) })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      invalidateLevels(queryClient)
    },
  })
}

/** Cascades to that level's skills and to any student_skills on them; a
 * student currently on this level falls back to no level (RLS + FK already
 * enforce this — see 0001_initial_schema.sql). */
export function useDeleteLevel() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('levels').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['progression'] })
      void queryClient.invalidateQueries({ queryKey: ['students'] })
    },
  })
}

export function useReorderLevels() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (orderedIds: string[]) => {
      const { error } = await supabase.rpc('reorder_levels', { p_ids: orderedIds })
      if (error) throw error
    },
    onSuccess: () => {
      invalidateLevels(queryClient)
    },
  })
}
