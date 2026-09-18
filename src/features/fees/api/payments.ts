import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { emptyToNull } from '@/shared/lib/emptyToNull'
import { supabase } from '@/shared/lib/supabase'

import type { FeeStatus, PaymentForm, PaymentMethod, StudentFeeWithPayments } from '../types'

interface FeeRow {
  id: string
  kind: 'period' | 'topup'
  credits_granted: number | null
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
    advances: { delta: number; kind: 'deposit' | 'applied' }[]
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
          `id, kind, credits_granted, period_start, period_end, due_date, amount, status, waived_reason,
           fee_plan:fee_plans(name),
           payments(id, amount, paid_date, method, reference, notes, receipt_no, voided_at, void_reason,
                    recorded_by:profiles!payments_recorded_by_fkey(full_name),
                    advances:student_advances!student_advances_payment_id_fkey(delta, kind))`,
        )
        .eq('student_id', studentId ?? '')
        .order('due_date', { ascending: false })
        .overrideTypes<FeeRow[], { merge: false }>()
      if (error) throw error
      return data.map((f) => ({
        id: f.id,
        kind: f.kind,
        creditsGranted: f.credits_granted,
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
            advanceDeposit: p.advances
              .filter((a) => a.kind === 'deposit')
              .reduce((sum, a) => sum + a.delta, 0),
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
        p_accept_advance: form.acceptAdvance,
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

export interface AdvanceEntry {
  id: string
  delta: number
  kind: 'deposit' | 'applied'
  reason: string | null
  createdAt: string
}

/** student_advance_balance() + the advance ledger — money a family paid
 * ahead, and where it went. Shown on the Fees tab (admin and parent). */
export function useStudentAdvance(studentId: string | null) {
  return useQuery({
    queryKey: ['fees', 'advance', studentId],
    enabled: studentId !== null,
    queryFn: async (): Promise<{ balance: number; entries: AdvanceEntry[] }> => {
      if (!studentId) return { balance: 0, entries: [] }
      const [bal, rows] = await Promise.all([
        supabase.rpc('student_advance_balance', { p_student_id: studentId }),
        supabase
          .from('student_advances')
          .select('id, delta, kind, reason, created_at')
          .eq('student_id', studentId)
          .order('created_at', { ascending: false }),
      ])
      if (bal.error) throw bal.error
      if (rows.error) throw rows.error
      return {
        balance: bal.data,
        entries: rows.data.map((r) => ({
          id: r.id,
          delta: r.delta,
          kind: r.kind as 'deposit' | 'applied',
          reason: r.reason,
          createdAt: r.created_at,
        })),
      }
    },
  })
}

/** apply_student_advances() RPC — puts whatever the family has paid ahead
 * onto their open fees right now, instead of waiting for the nightly job
 * (BUG-012). Returns the amount applied. */
export function useApplyStudentAdvances() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (studentId: string) => {
      const { data, error } = await supabase.rpc('apply_student_advances', {
        p_student_id: studentId,
      })
      if (error) throw error
      return data
    },
    onSuccess: () => {
      invalidateFeesAndCredits(queryClient)
    },
  })
}

interface VoidPaymentInput {
  paymentId: string
  reason: string
  /** Confirms the clawback: cancel the skater's newest upcoming bookings
   * (and notify the parent) if voiding leaves them short of credits. */
  cancelBookings: boolean
}

/** void_payment() RPC — a payment is never deleted. Voiding keeps it on
 * record (struck through, with the reason) but it no longer counts toward
 * the fee, whose status is recomputed from what's left. If that would take
 * away credits the skater has already booked with, the database refuses
 * unless `cancelBookings` confirms cancelling the newest upcoming ones —
 * see useClawbackPreview() for what that would be. */
export function useVoidPayment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ paymentId, reason, cancelBookings }: VoidPaymentInput) => {
      const { error } = await supabase.rpc('void_payment', {
        p_payment_id: paymentId,
        p_reason: reason,
        p_cancel_bookings: cancelBookings,
      })
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      invalidateFeesAndCredits(queryClient)
    },
  })
}

export interface ClawbackPreview {
  /** How many classes short the skater would be. 0 = nothing to cancel. */
  shortfall: number
  bookings: { bookingId: string; sessionDate: string; startTime: string; batchName: string }[]
}

/** clawback_preview() RPC — before voiding/deleting something that granted
 * credits: how short would the skater be, and which upcoming bookings
 * (newest first) would be cancelled to cover it. */
export function useClawbackPreview(studentId: string | null, creditsRemoved: number) {
  return useQuery({
    queryKey: ['bookings', 'clawback-preview', studentId, creditsRemoved],
    enabled: studentId !== null && creditsRemoved > 0,
    queryFn: async (): Promise<ClawbackPreview> => {
      // The function LEFT JOINs the bookings, so with no shortfall it returns
      // one row of nulls — the generated types don't know that.
      const { data, error } = await supabase
        .rpc('clawback_preview', {
          p_student_id: studentId ?? '',
          p_credits_removed: creditsRemoved,
        })
        .overrideTypes<
          {
            shortfall: number
            booking_id: string | null
            session_date: string | null
            start_time: string | null
            batch_name: string | null
          }[],
          { merge: false }
        >()
      if (error) throw error
      return {
        shortfall: data[0]?.shortfall ?? 0,
        bookings: data.flatMap((r) =>
          r.booking_id && r.session_date && r.start_time && r.batch_name
            ? [
                {
                  bookingId: r.booking_id,
                  sessionDate: r.session_date,
                  startTime: r.start_time,
                  batchName: r.batch_name,
                },
              ]
            : [],
        ),
      }
    },
  })
}

/** delete_student_fee() RPC — removes a fee period that has no payment
 * history at all. Use to correct a period that was generated wrong —
 * delete it here, then Generate now for a clean one. A waived period
 * granted credits; `cancelBookings` confirms the clawback if needed. */
export function useDeleteFee() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      studentFeeId,
      cancelBookings,
    }: {
      studentFeeId: string
      cancelBookings: boolean
    }) => {
      const { error } = await supabase.rpc('delete_student_fee', {
        p_fee_id: studentFeeId,
        p_cancel_bookings: cancelBookings,
      })
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      invalidateFeesAndCredits(queryClient)
    },
  })
}
