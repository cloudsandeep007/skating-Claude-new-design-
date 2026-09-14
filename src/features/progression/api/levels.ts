import { useQuery } from '@tanstack/react-query'

import { supabase } from '@/shared/lib/supabase'

import type { Level, LevelWithSkills, SkillRow } from '../types'

/** Lightweight level list (no skills) — used by pickers, the ladder
 * position on the parent screen, and next-level lookups. */
export function useLevels() {
  return useQuery({
    queryKey: ['progression', 'levels'],
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<Level[]> => {
      const { data, error } = await supabase.from('levels').select('*').order('sequence')
      if (error) throw error
      return data
    },
  })
}

interface SkillDbRow {
  id: string
  level_id: string
  name: string
  sequence: number
  description: string | null
}

/** Every level with its skills nested, ordered — the shape the "Manage
 * levels" admin page and the drag-reorder UI work with. */
export function useLevelsWithSkills() {
  return useQuery({
    queryKey: ['progression', 'levels', 'with-skills'],
    queryFn: async (): Promise<LevelWithSkills[]> => {
      const [levelsResult, skillsResult] = await Promise.all([
        supabase.from('levels').select('id, name, sequence, description').order('sequence'),
        supabase
          .from('skills')
          .select('id, level_id, name, sequence, description')
          .order('sequence')
          .overrideTypes<SkillDbRow[], { merge: false }>(),
      ])
      if (levelsResult.error) throw levelsResult.error
      if (skillsResult.error) throw skillsResult.error

      const skillsByLevel = new Map<string, SkillRow[]>()
      for (const s of skillsResult.data) {
        const arr = skillsByLevel.get(s.level_id) ?? []
        arr.push({
          id: s.id,
          levelId: s.level_id,
          name: s.name,
          sequence: s.sequence,
          description: s.description,
        })
        skillsByLevel.set(s.level_id, arr)
      }

      return levelsResult.data.map((l) => ({
        id: l.id,
        name: l.name,
        sequence: l.sequence,
        description: l.description,
        skills: skillsByLevel.get(l.id) ?? [],
      }))
    },
  })
}
