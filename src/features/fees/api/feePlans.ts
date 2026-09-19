import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { emptyToNull } from '@/shared/lib/emptyToNull'
import { invalidateForTable } from '@/shared/hooks/useLiveSync'
import { supabase } from '@/shared/lib/supabase'

import type { FeePlan, FeePlanForm, FeePlanOption } from '../types'

function invalidatePlans(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: ['fees', 'plans'] })
  invalidateForTable(queryClient, 'fee_plans')
}

/** Every fee plan in the academy, for the "Manage fee plans" admin screen. */
export function useFeePlans() {
  return useQuery({
    queryKey: ['fees', 'plans'],
    queryFn: async (): Promise<FeePlan[]> => {
      const { data, error } = await supabase.from('fee_plans').select('*').order('name')
      if (error) throw error
      return data
    },
  })
}

/** Lightweight list for pickers — assigning a plan to a student, choosing
 * one when generating fees. */
export function useFeePlanOptions() {
  return useQuery({
    queryKey: ['fees', 'plan-options'],
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<FeePlanOption[]> => {
      const { data, error } = await supabase
        .from('fee_plans')
        .select('id, name, amount, billing_cycle, batch_id, pricing_mode, per_class_rate')
        .order('name')
      if (error) throw error
      return data.map((p) => ({
        id: p.id,
        name: p.name,
        amount: p.amount,
        billingCycle: p.billing_cycle,
        batchId: p.batch_id,
        pricingMode: p.pricing_mode,
        perClassRate: p.per_class_rate,
      }))
    },
  })
}

interface CreatePlanInput {
  academyId: string
  form: FeePlanForm
}

export function useCreateFeePlan() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ academyId, form }: CreatePlanInput) => {
      const { error } = await supabase.from('fee_plans').insert({
        academy_id: academyId,
        name: form.name,
        amount: form.amount,
        billing_cycle: form.billingCycle,
        description: emptyToNull(form.description),
        batch_id: form.batchId ?? null,
        pricing_mode: form.pricingMode,
        per_class_rate: form.pricingMode === 'per_class' ? (form.perClassRate ?? null) : null,
      })
      if (error) throw error
    },
    onSuccess: () => {
      invalidatePlans(queryClient)
    },
  })
}

interface UpdatePlanInput {
  id: string
  form: FeePlanForm
}

export function useUpdateFeePlan() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, form }: UpdatePlanInput) => {
      const { error } = await supabase
        .from('fee_plans')
        .update({
          name: form.name,
          amount: form.amount,
          billing_cycle: form.billingCycle,
          description: emptyToNull(form.description),
          batch_id: form.batchId ?? null,
          pricing_mode: form.pricingMode,
          per_class_rate: form.pricingMode === 'per_class' ? (form.perClassRate ?? null) : null,
        })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      invalidatePlans(queryClient)
    },
  })
}

/** A plan in use (students assigned, or fees already generated from it) is
 * kept on delete via ON DELETE SET NULL — this only removes the plan
 * itself, never a student's billing history. */
export function useDeleteFeePlan() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('fee_plans').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      invalidatePlans(queryClient)
    },
  })
}
