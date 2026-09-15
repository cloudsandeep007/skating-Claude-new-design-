import { useQuery } from '@tanstack/react-query'

import { supabase } from '@/shared/lib/supabase'

import type { FeeListRow, FeeStatus } from '../types'

export interface FeeListFilters {
  status: FeeStatus | null
  month: string | null
  batchId: string | null
}

/** The admin fee list, filtered by status/month/batch — student_fees_list()
 * RPC, which pre-computes paid-so-far and balance so partial payments show
 * correctly without an extra round trip per row. */
export function useFeeList(filters: FeeListFilters) {
  return useQuery({
    queryKey: ['fees', 'list', filters],
    queryFn: async (): Promise<FeeListRow[]> => {
      const { data, error } = await supabase.rpc('student_fees_list', {
        p_status: filters.status ?? undefined,
        p_month: filters.month ?? undefined,
        p_batch_id: filters.batchId ?? undefined,
      })
      if (error) throw error
      return data.map((r) => ({
        studentFeeId: r.student_fee_id,
        studentId: r.student_id,
        fullName: r.full_name,
        batchNames: r.batch_names,
        feePlanName: r.fee_plan_name,
        periodStart: r.period_start,
        periodEnd: r.period_end,
        dueDate: r.due_date,
        amount: r.amount,
        paid: r.paid,
        balance: r.balance,
        status: r.status,
        lastRemindedAt: r.last_reminded_at,
      }))
    },
  })
}
