import { useQuery } from '@tanstack/react-query'

import { supabase } from '@/shared/lib/supabase'

import type { ReconciliationRow, ReportRange } from '../types'

/** reconciliation_report() RPC — one row per day with any payment
 * activity: what came in by method (voided payments excluded, advance
 * applications shown separately because they aren't new money), how many
 * receipts, and the receipt-number range for that day. */
export function useReconciliationReport(range: ReportRange) {
  return useQuery({
    queryKey: ['reports', 'reconciliation', range],
    queryFn: async (): Promise<ReconciliationRow[]> => {
      const { data, error } = await supabase.rpc('reconciliation_report', {
        p_from: range.from,
        p_to: range.to,
      })
      if (error) throw error
      return data.map((r) => ({
        day: r.day,
        cash: r.cash,
        upi: r.upi,
        card: r.card,
        bankTransfer: r.bank_transfer,
        cheque: r.cheque,
        other: r.other,
        collected: r.collected,
        paymentCount: r.payment_count,
        voidedTotal: r.voided_total,
        voidedCount: r.voided_count,
        advanceApplied: r.advance_applied,
        firstReceipt: r.first_receipt,
        lastReceipt: r.last_receipt,
      }))
    },
  })
}
