import { useMutation, useQueryClient } from '@tanstack/react-query'

import { emptyToNull } from '@/shared/lib/emptyToNull'
import { supabase } from '@/shared/lib/supabase'

function invalidateLevels(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: ['progression', 'levels'] })
}

interface CreateSkillInput {
  academyId: string
  levelId: string
  name: string
  description?: string
  sequence: number
}

export function useCreateSkill() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ academyId, levelId, name, description, sequence }: CreateSkillInput) => {
      const { error } = await supabase.from('skills').insert({
        academy_id: academyId,
        level_id: levelId,
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

interface UpdateSkillInput {
  id: string
  name: string
  description?: string
}

export function useUpdateSkill() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, name, description }: UpdateSkillInput) => {
      const { error } = await supabase
        .from('skills')
        .update({ name, description: emptyToNull(description) })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      invalidateLevels(queryClient)
    },
  })
}

/** Cascades to any student_skills recorded against it — skaters lose the
 * history for this specific skill, which is why the UI confirms first. */
export function useDeleteSkill() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('skills').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['progression'] })
    },
  })
}

interface ReorderSkillsInput {
  levelId: string
  orderedIds: string[]
}

export function useReorderSkills() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ levelId, orderedIds }: ReorderSkillsInput) => {
      const { error } = await supabase.rpc('reorder_skills', {
        p_level_id: levelId,
        p_ids: orderedIds,
      })
      if (error) throw error
    },
    onSuccess: () => {
      invalidateLevels(queryClient)
    },
  })
}
