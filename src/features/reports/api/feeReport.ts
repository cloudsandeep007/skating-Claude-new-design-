import { useQuery } from '@tanstack/react-query'

import { supabase } from '@/shared/lib/supabase'

import type { FeeReportRow, ReportRange } from '../types'

/** fee_collection_report() RPC. */
export function useFeeReport(range: ReportRange, batchId: string | null) {
  return useQuery({
    queryKey: ['reports', 'fees', range, batchId],
    queryFn: async (): Promise<FeeReportRow[]> => {
      const { data, error } = await supabase.rpc('fee_collection_report', {
        p_from: range.from,
        p_to: range.to,
        p_batch_id: batchId ?? undefined,
      })
      if (error) throw error
      return data.map((r) => ({
        studentFeeId: r.student_fee_id,
        studentId: r.student_id,
        fullName: r.full_name,
        batchNames: r.batch_names,
        feePlanName: r.fee_plan_name,
        dueDate: r.due_date,
        amount: r.amount,
        paid: r.paid,
        balance: r.balance,
        status: r.status,
      }))
    },
  })
}
