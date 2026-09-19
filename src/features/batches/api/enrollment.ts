import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { todayIso } from '@/shared/lib/format'
import { invalidateForTable } from '@/shared/hooks/useLiveSync'
import { supabase } from '@/shared/lib/supabase'

export interface EnrollableStudent {
  id: string
  fullName: string
  levelName: string | null
}

/** Active students not currently enrolled in this batch. */
export function useEnrollableStudents(batchId: string) {
  return useQuery({
    queryKey: ['batches', 'enrollable', batchId],
    queryFn: async (): Promise<EnrollableStudent[]> => {
      const [studentsResult, enrolledResult] = await Promise.all([
        supabase
          .from('students')
          .select('id, full_name, current_level:levels(name)')
          .eq('status', 'active')
          .order('full_name'),
        supabase
          .from('student_batches')
          .select('student_id')
          .eq('batch_id', batchId)
          .eq('status', 'active'),
      ])
      if (studentsResult.error) throw studentsResult.error
      if (enrolledResult.error) throw enrolledResult.error

      const enrolled = new Set(enrolledResult.data.map((r) => r.student_id))
      return studentsResult.data
        .filter((s) => !enrolled.has(s.id))
        .map((s) => ({ id: s.id, fullName: s.full_name, levelName: s.current_level?.name ?? null }))
    },
  })
}

interface EnrollInput {
  academyId: string
  batchId: string
  studentId: string
}

async function enrollStudent({ academyId, batchId, studentId }: EnrollInput) {
  // Upsert so a student removed earlier (status = inactive) can be re-enrolled.
  const { error } = await supabase.from('student_batches').upsert(
    {
      academy_id: academyId,
      batch_id: batchId,
      student_id: studentId,
      status: 'active',
      enrolled_date: todayIso(),
    },
    { onConflict: 'student_id,batch_id' },
  )
  if (error) throw error
}

/** Removal keeps the row (status = inactive) so enrollment history survives. */
async function removeStudent({ batchId, studentId }: { batchId: string; studentId: string }) {
  const { error } = await supabase
    .from('student_batches')
    .update({ status: 'inactive' })
    .eq('batch_id', batchId)
    .eq('student_id', studentId)
  if (error) throw error
}

function useInvalidateBatch(batchId: string) {
  const queryClient = useQueryClient()
  return () => {
    void queryClient.invalidateQueries({ queryKey: ['batches'] })
    void queryClient.invalidateQueries({ queryKey: ['batches', 'detail', batchId] })
    void queryClient.invalidateQueries({ queryKey: ['batches', 'enrollable', batchId] })
    void queryClient.invalidateQueries({ queryKey: ['students'] })
    invalidateForTable(queryClient, 'student_batches')
  }
}

export function useEnrollStudent(batchId: string) {
  const invalidate = useInvalidateBatch(batchId)
  return useMutation({ mutationFn: enrollStudent, onSuccess: invalidate })
}

export function useRemoveStudent(batchId: string) {
  const invalidate = useInvalidateBatch(batchId)
  return useMutation({ mutationFn: removeStudent, onSuccess: invalidate })
}
