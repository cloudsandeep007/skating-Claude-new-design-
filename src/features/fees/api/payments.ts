import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { emptyToNull } from '@/shared/lib/emptyToNull'
import { supabase } from '@/shared/lib/supabase'

import type { FeeStatus, PaymentForm, PaymentMethod, StudentFeeWithPayments } from '../types'

interface FeeRow {
  id: string
  period_start: string
  period_end: string
  due_date: string
  amount: number
  status: FeeStatus
  waived_reason: string | null
  fee_plan: { name: string } | null
  payments: {
    id: string
    amount: number
    paid_date: string
    method: PaymentMethod
    reference: string | null
    notes: string | null
    recorded_by: { full_name: string } | null
  }[]
}

/** Every fee period for a student, newest due date first, each with its
 * payments nested — the admin "Fees" tab and the parent's fees screen both
 * read this; RLS decides who's allowed to. */
export function useStudentFees(studentId: string | null) {
  return useQuery({
    queryKey: ['fees', 'student', studentId],
    enabled: studentId !== null,
    queryFn: async (): Promise<StudentFeeWithPayments[]> => {
      const { data, error } = await supabase
        .from('student_fees')
        .select(
          `id, period_start, period_end, due_date, amount, status, waived_reason,
           fee_plan:fee_plans(name),
           payments(id, amount, paid_date, method, reference, notes, recorded_by:profiles(full_name))`,
        )
        .eq('student_id', studentId ?? '')
        .order('due_date', { ascending: false })
        .overrideTypes<FeeRow[], { merge: false }>()
      if (error) throw error
      return data.map((f) => ({
        id: f.id,
        periodStart: f.period_start,
        periodEnd: f.period_end,
        dueDate: f.due_date,
        amount: f.amount,
        status: f.status,
        waivedReason: f.waived_reason,
        feePlanName: f.fee_plan?.name ?? null,
        payments: f.payments
          .map((p) => ({
            id: p.id,
            amount: p.amount,
            paidDate: p.paid_date,
            method: p.method,
            reference: p.reference,
            notes: p.notes,
            recordedByName: p.recorded_by?.full_name ?? null,
          }))
          .sort((a, b) => b.paidDate.localeCompare(a.paidDate)),
      }))
    },
  })
}

interface RecordPaymentInput {
  studentFeeId: string
  form: PaymentForm
}

/** record_payment() RPC — one round trip for "add this payment, and flip
 * the fee to paid if it's now fully covered". */
export function useRecordPayment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ studentFeeId, form }: RecordPaymentInput) => {
      const { error } = await supabase.rpc('record_payment', {
        p_student_fee_id: studentFeeId,
        p_amount: form.amount,
        p_paid_date: form.paidDate,
        p_method: form.method,
        p_reference: emptyToNull(form.reference) ?? undefined,
        p_notes: emptyToNull(form.notes) ?? undefined,
      })
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      invalidateFeesAndCredits(queryClient)
    },
  })
}

/** A payment or fee-status change can change how much of a fee is paid,
 * and `credits_granted` only counts paid/waived periods — so credit
 * balances (the students list "Credits" column, the student profile
 * badge, the parent's booking page) need invalidating alongside the fee
 * itself. Exported for waive.ts, which changes status the same way. */
export function invalidateFeesAndCredits(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: ['fees'] })
  void queryClient.invalidateQueries({ queryKey: ['bookings'] })
  void queryClient.invalidateQueries({ queryKey: ['students'] })
}

/** delete_payment() RPC — removes one payment and recomputes the fee's
 * status (paid → pending/overdue as appropriate), instead of leaving it
 * falsely marked paid with no payment to show for it. */
export function useDeletePayment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (paymentId: string) => {
      const { error } = await supabase.rpc('delete_payment', { p_payment_id: paymentId })
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      invalidateFeesAndCredits(queryClient)
    },
  })
}

/** delete_student_fee() RPC — rolls back an entire fee period: deletes its
 * payments, then the period itself. Use to correct a period that was
 * generated wrong (e.g. a plan edited after its first fee was already
 * created) — delete it here, then Generate now for a clean one. */
export function useDeleteFee() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (studentFeeId: string) => {
      const { error } = await supabase.rpc('delete_student_fee', { p_fee_id: studentFeeId })
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      invalidateFeesAndCredits(queryClient)
    },
  })
}
