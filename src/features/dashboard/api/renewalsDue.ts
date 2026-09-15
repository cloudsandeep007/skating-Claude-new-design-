import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { supabase } from '@/shared/lib/supabase'

import type { RenewalDueRow } from '../types'

/** renewals_due() RPC — skaters whose plan term ends within a week or has
 * already lapsed, so the admin can nudge them to top up before unused
 * classes expire. */
export function useRenewalsDue(withinDays = 7) {
  return useQuery({
    queryKey: ['dashboard', 'renewals-due', withinDays],
    queryFn: async (): Promise<RenewalDueRow[]> => {
      const { data, error } = await supabase.rpc('renewals_due', { p_within_days: withinDays })
      if (error) throw error
      return data.map((r) => ({
        studentId: r.student_id,
        fullName: r.full_name,
        photoUrl: r.photo_url,
        batchNames: r.batch_names,
        pricingMode: r.pricing_mode,
        billingCycle: r.billing_cycle,
        termEnd: r.term_end,
        daysLeft: r.days_left,
        termStatus: r.term_status as RenewalDueRow['termStatus'],
        available: r.available,
        minTopup: r.min_topup,
        rate: r.rate,
        parentName: r.parent_name,
        parentPhone: r.parent_phone,
        lastRemindedAt: r.last_reminded_at,
      }))
    },
  })
}

/** send_renewal_reminders() RPC — one in-app notification per linked
 * parent, saying when the plan ends and how many classes would carry
 * forward if renewed in time. */
export function useSendRenewalReminders() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (studentIds: string[]) => {
      const { data, error } = await supabase.rpc('send_renewal_reminders', {
        p_student_ids: studentIds,
      })
      if (error) throw new Error(error.message)
      return data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['dashboard', 'renewals-due'] })
    },
  })
}
