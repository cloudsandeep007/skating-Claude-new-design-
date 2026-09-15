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
    receipt_no: string | null
    voided_at: string | null
    void_reason: string | null
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
           payments(id, amount, paid_date, method, reference, notes, receipt_no, voided_at, void_reason,
                    recorded_by:profiles!payments_recorded_by_fkey(full_name))`,
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
            receiptNo: p.receipt_no,
            voidedAt: p.voided_at,
            voidReason: p.void_reason,
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
  /** Generated once per open of the payment form. A retried request with
   * the same key returns the payment already recorded instead of a
   * duplicate — see record_payment(). */
  idempotencyKey: string
}

/** record_payment() RPC — one round trip for "add this payment, and flip
 * the fee to paid if it's now fully covered". Returns the payment row,
 * receipt number included. */
export function useRecordPayment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ studentFeeId, form, idempotencyKey }: RecordPaymentInput) => {
      const { data, error } = await supabase.rpc('record_payment', {
        p_student_fee_id: studentFeeId,
        p_amount: form.amount,
        p_paid_date: form.paidDate,
        p_method: form.method,
        p_reference: emptyToNull(form.reference) ?? undefined,
        p_notes: emptyToNull(form.notes) ?? undefined,
        p_idempotency_key: idempotencyKey,
      })
      if (error) throw new Error(error.message)
      return { receiptNo: data.receipt_no }
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

interface VoidPaymentInput {
  paymentId: string
  reason: string
}

/** void_payment() RPC — a payment is never deleted. Voiding keeps it on
 * record (struck through, with the reason) but it no longer counts toward
 * the fee, whose status is recomputed from what's left. Refused if that
 * would take away credits the skater has already booked with. */
export function useVoidPayment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ paymentId, reason }: VoidPaymentInput) => {
      const { error } = await supabase.rpc('void_payment', {
        p_payment_id: paymentId,
        p_reason: reason,
      })
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      invalidateFeesAndCredits(queryClient)
    },
  })
}

/** delete_student_fee() RPC — removes a fee period that has no payment
 * history at all. Use to correct a period that was generated wrong —
 * delete it here, then Generate now for a clean one. */
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
