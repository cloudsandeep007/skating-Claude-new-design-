import { useMutation, useQueryClient } from '@tanstack/react-query'

import { supabase } from '@/shared/lib/supabase'

import type { StudentListItem, StudentStatus } from '../types'

interface StudentsPage {
  items: StudentListItem[]
  total: number
}

async function setStudentStatus(studentId: string, status: StudentStatus) {
  const { error } = await supabase.from('students').update({ status }).eq('id', studentId)
  if (error) throw error
}

/** Archive is a soft delete (students.status = 'archived') — the row is
 * never removed. Optimistic because it's a single reversible field flip. */
export function useSetStudentStatus() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ studentId, status }: { studentId: string; status: StudentStatus }) =>
      setStudentStatus(studentId, status),
    onMutate: async ({ studentId, status }) => {
      await queryClient.cancelQueries({ queryKey: ['students'] })
      const previous = queryClient.getQueriesData<StudentsPage>({ queryKey: ['students'] })

      // Partial query-key matching also reaches the ['students','detail',id]
      // cache entry, which isn't a paginated list — skip anything without
      // an `items` array rather than assume every match is a list page.
      queryClient.setQueriesData<StudentsPage>({ queryKey: ['students'] }, (page) => {
        if (!page || !Array.isArray(page.items)) return page
        return {
          ...page,
          items: page.items.map((item) => (item.id === studentId ? { ...item, status } : item)),
        }
      })

      return { previous }
    },
    onError: (_err, _vars, context) => {
      context?.previous.forEach(([queryKey, data]) => {
        queryClient.setQueryData(queryKey, data)
      })
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['students'] })
    },
  })
}
