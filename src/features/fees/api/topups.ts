import { useMutation, useQueryClient } from '@tanstack/react-query'

import { emptyToNull } from '@/shared/lib/emptyToNull'
import { supabase } from '@/shared/lib/supabase'

import type { PaymentMethod } from '../types'
import { invalidateFeesAndCredits } from './payments'

export interface RecordTopupInput {
  studentId: string
  classes: number
  paidDate: string
  method: PaymentMethod
  reference?: string
  notes?: string
  /** One per opening of the form — a retried request returns the top-up
   * already recorded instead of a second one. */
  idempotencyKey: string
}

/** record_credit_topup() RPC — the admin records that a family paid for N
 * classes on a pay-per-class plan. The database decides whether that
 * starts a term, renews it, or just adds classes, prices it at the plan's
 * current rate, and pays it through record_payment() (receipt number,
 * audit trail, void-able like any payment). Returns the term it landed in. */
export function useRecordTopup() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: RecordTopupInput) => {
      const { data, error } = await supabase.rpc('record_credit_topup', {
        p_student_id: input.studentId,
        p_classes: input.classes,
        p_paid_date: input.paidDate,
        p_method: input.method,
        p_reference: emptyToNull(input.reference ?? '') ?? undefined,
        p_notes: emptyToNull(input.notes ?? '') ?? undefined,
        p_idempotency_key: input.idempotencyKey,
      })
      if (error) throw new Error(error.message)
      return {
        termStart: data.period_start,
        termEnd: data.period_end,
        amount: data.amount,
        classes: data.credits_granted ?? input.classes,
      }
    },
    onSuccess: () => {
      invalidateFeesAndCredits(queryClient)
    },
  })
}
