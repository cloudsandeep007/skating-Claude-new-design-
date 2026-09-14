import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { supabase } from '@/shared/lib/supabase'

export interface HolidayItem {
  id: string
  date: string
  name: string
}

export function useHolidays() {
  return useQuery({
    queryKey: ['holidays'],
    queryFn: async (): Promise<HolidayItem[]> => {
      const { data, error } = await supabase
        .from('holidays')
        .select('id, holiday_date, name')
        .order('holiday_date')
      if (error) throw error
      return data.map((h) => ({ id: h.id, date: h.holiday_date, name: h.name }))
    },
  })
}

export function useAddHoliday() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      academyId,
      date,
      name,
    }: {
      academyId: string
      date: string
      name: string
    }) => {
      const { error } = await supabase
        .from('holidays')
        .insert({ academy_id: academyId, holiday_date: date, name })
      if (error) {
        if (error.code === '23505') throw new Error('That date is already a holiday.')
        throw error
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['holidays'] })
    },
  })
}

export function useRemoveHoliday() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('holidays').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['holidays'] })
    },
  })
}
