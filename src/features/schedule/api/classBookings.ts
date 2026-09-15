import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { supabase } from '@/shared/lib/supabase'

/** class_credit_balance() RPC — the one running, never-reset balance: every
 * credit ever granted, minus every active booking ever made, plus any
 * still-pending make-up credit as a bonus. Null for a student not on a
 * batch-scoped plan (nothing to book). */
export function useClassCreditBalance(studentId: string | null) {
  return useQuery({
    queryKey: ['bookings', 'balance', studentId],
    enabled: studentId !== null,
    queryFn: async (): Promise<number | null> => {
      if (!studentId) return null
      const { data, error } = await supabase.rpc('class_credit_balance', {
        p_student_id: studentId,
      })
      if (error) throw error
      return data
    },
  })
}

export interface ClassCreditSummary {
  granted: number
  booked: number
  bonus: number
  available: number | null
}

/** class_credit_summary() RPC — the same balance as class_credit_balance(),
 * broken into its parts (granted from paid fees, spent on bookings, bonus
 * from pending make-up credits) for the admin side, where a plain number
 * isn't enough to explain "why is this 0". */
export function useClassCreditSummary(studentId: string | null) {
  return useQuery({
    queryKey: ['bookings', 'summary', studentId],
    enabled: studentId !== null,
    queryFn: async (): Promise<ClassCreditSummary | null> => {
      if (!studentId) return null
      const { data, error } = await supabase
        .rpc('class_credit_summary', { p_student_id: studentId })
        .single()
      if (error) throw error
      return { granted: data.granted, booked: data.booked, bonus: data.bonus, available: data.available }
    },
  })
}

/** Which of a student's upcoming sessions they've already booked. */
export function useStudentBookedSessionIds(studentId: string | null) {
  return useQuery({
    queryKey: ['bookings', 'booked-ids', studentId],
    enabled: studentId !== null,
    queryFn: async (): Promise<Set<string>> => {
      if (!studentId) return new Set()
      const { data, error } = await supabase
        .from('class_bookings')
        .select('session_id')
        .eq('student_id', studentId)
        .eq('status', 'booked')
      if (error) throw error
      return new Set(data.map((r) => r.session_id))
    },
  })
}

function invalidateBookings(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: ['bookings'] })
  void queryClient.invalidateQueries({ queryKey: ['sessions'] })
  void queryClient.invalidateQueries({ queryKey: ['attendance', 'session'] })
  void queryClient.invalidateQueries({ queryKey: ['parent', 'upcoming'] })
}

/** book_class_slot() RPC — reserves a credit against a specific upcoming
 * session in the caller's child's assigned batch. */
export function useBookClassSlot() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (sessionId: string) => {
      const { data, error } = await supabase.rpc('book_class_slot', {
        p_session_id: sessionId,
      })
      if (error) throw error
      return data
    },
    onSuccess: () => {
      invalidateBookings(queryClient)
    },
  })
}

/** cancel_class_slot() RPC — frees the credit, only while the session is
 * still scheduled (not yet marked). */
export function useCancelClassSlot() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (sessionId: string) => {
      const { data, error } = await supabase.rpc('cancel_class_slot', {
        p_session_id: sessionId,
      })
      if (error) throw error
      return data
    },
    onSuccess: () => {
      invalidateBookings(queryClient)
    },
  })
}
