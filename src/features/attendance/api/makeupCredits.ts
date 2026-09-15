import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { supabase } from '@/shared/lib/supabase'

import type { MakeupCredit } from '../types'

interface MakeupCreditRow {
  id: string
  student_id: string
  reason_session_id: string
  status: string
  granted_at: string
  fulfilled_at: string | null
  notes: string | null
  session: { session_date: string; batch: { name: string } }
}

/** A student's make-up credits, newest first — pending ones are what's owed,
 * fulfilled ones are history. Used by the parent attendance page (pending
 * count only) and the admin student detail page (full list + fulfil). */
export function useMakeupCredits(studentId: string | null) {
  return useQuery({
    queryKey: ['attendance', 'makeup-credits', studentId],
    enabled: studentId !== null,
    queryFn: async (): Promise<MakeupCredit[]> => {
      if (!studentId) return []
      const { data, error } = await supabase
        .from('makeup_credits')
        .select(
          `id, student_id, reason_session_id, status, granted_at, fulfilled_at, notes,
           session:schedule_sessions(session_date, batch:batches(name))`,
        )
        .eq('student_id', studentId)
        .order('granted_at', { ascending: false })
        .overrideTypes<MakeupCreditRow[], { merge: false }>()
      if (error) throw error
      return data.map((r) => ({
        id: r.id,
        studentId: r.student_id,
        reasonSessionId: r.reason_session_id,
        reasonDate: r.session.session_date,
        batchName: r.session.batch.name,
        status: r.status as MakeupCredit['status'],
        grantedAt: r.granted_at,
        fulfilledAt: r.fulfilled_at,
        notes: r.notes,
      }))
    },
  })
}

/** fulfill_makeup_credit() RPC — admin-only, marks a pending credit used. */
export function useFulfillMakeupCredit() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ creditId, notes }: { creditId: string; notes?: string }) => {
      const { error } = await supabase.rpc('fulfill_makeup_credit', {
        p_credit_id: creditId,
        p_notes: notes ?? undefined,
      })
      if (error) throw error
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['attendance', 'makeup-credits'] })
    },
  })
}
