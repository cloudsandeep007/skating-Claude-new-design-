import { Pencil, Plus, Trash2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'

import { useAuth } from '@/features/auth'
import { useBatchOptions } from '@/features/batches'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/shared/ui/alert-dialog'
import { describeError } from '@/shared/lib/describeError'
import { Button } from '@/shared/ui/button'
import { EmptyState } from '@/shared/ui/EmptyState'
import { Skeleton } from '@/shared/ui/skeleton'
import { StatusBadge } from '@/shared/ui/StatusBadge'

import { useCreateFeePlan, useDeleteFeePlan, useFeePlans, useUpdateFeePlan } from '../api/feePlans'
import { feePlanPriceLabel } from '../hooks/feeTone'
import { BILLING_CYCLE_LABEL, type FeePlanForm } from '../types'
import { FeePlanFormDialog } from './FeePlanFormDialog'

export function FeePlansManagePage() {
  const { profile } = useAuth()
  const { data: plans, isLoading, isError, refetch } = useFeePlans()
  const { data: batches } = useBatchOptions()
  const batchName = (batchId: string | null) => batches?.find((b) => b.id === batchId)?.name
  const createPlan = useCreateFeePlan()
  const updatePlan = useUpdateFeePlan()
  const deletePlan = useDeleteFeePlan()

  if (isError) {
    return (
      <EmptyState
        tone="error"
        title="Couldn't load fee plans"
        description="Check your connection and try again."
        action={
          <Button
            variant="outline"
            onClick={() => {
              void refetch()
            }}
          >
            Try again
          </Button>
        }
      />
    )
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-56" />
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-lg" />
        ))}
      </div>
    )
  }

  async function submitCreate(values: FeePlanForm) {
    if (!profile?.academy_id) return
    try {
      await createPlan.mutateAsync({ academyId: profile.academy_id, form: values })
      toast.success('Fee plan added.')
    } catch (error) {
      toast.error(describeError(error, 'Could not add the fee plan.'))
      throw error
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Button variant="ghost" size="sm" asChild className="-ml-2 mb-1">
            <Link to="/admin/fees">← Fees</Link>
          </Button>
          <h1 className="font-display text-2xl font-extrabold tracking-tight">Fee plans</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            What families are billed and how often. Assign a plan to a skater from their profile.
          </p>
        </div>
        <FeePlanFormDialog
          trigger={
            <Button>
              <Plus className="h-4 w-4" />
              Add plan
            </Button>
          }
          title="Add a fee plan"
          submitLabel="Add plan"
          pending={createPlan.isPending}
          onSubmit={submitCreate}
        />
      </div>

      {!plans || plans.length === 0 ? (
        <EmptyState
          title="No fee plans yet"
          description="Add a plan (e.g. Monthly, Quarterly) before assigning one to a skater."
        />
      ) : (
        <ul className="space-y-2">
          {plans.map((plan) => (
            <li
              key={plan.id}
              className="flex items-center gap-3 rounded-lg border bg-card p-3.5 shadow-sm"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold">{plan.name}</span>
                  <StatusBadge tone="neutral">
                    {BILLING_CYCLE_LABEL[plan.billing_cycle]}
                  </StatusBadge>
                  <StatusBadge tone="outline">
                    {plan.batch_id ? (batchName(plan.batch_id) ?? 'Batch') : 'All batches'}
                  </StatusBadge>
                  {plan.pricing_mode === 'per_class' && (
                    <StatusBadge tone="dark">Per class</StatusBadge>
                  )}
                </div>
                {plan.description && (
                  <div className="mt-0.5 truncate text-sm text-muted-foreground">
                    {plan.description}
                  </div>
                )}
              </div>
              <div className="shrink-0 text-lg font-extrabold tracking-tight">
                {feePlanPriceLabel({
                  amount: plan.amount,
                  pricingMode: plan.pricing_mode,
                  perClassRate: plan.per_class_rate,
                })}
              </div>
              <FeePlanFormDialog
                trigger={
                  <Button variant="ghost" size="icon" aria-label={`Edit ${plan.name}`}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                }
                title="Edit fee plan"
                defaultValues={{
                  name: plan.name,
                  amount: plan.amount,
                  billingCycle: plan.billing_cycle,
                  description: plan.description ?? '',
                  batchId: plan.batch_id,
                  pricingMode: plan.pricing_mode,
                  perClassRate: plan.per_class_rate,
                }}
                submitLabel="Save"
                pending={updatePlan.isPending}
                onSubmit={async (values) => {
                  try {
                    await updatePlan.mutateAsync({ id: plan.id, form: values })
                    toast.success('Fee plan updated.')
                  } catch (error) {
                    toast.error(describeError(error, 'Could not update the fee plan.'))
                    throw error
                  }
                }}
              />
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove ${plan.name}`}
                    className="text-brand-400 hover:text-brand-300"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Remove {plan.name}?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Skaters currently on this plan stop being billed from it (they keep their fee
                      history). This can't be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Keep plan</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => {
                        deletePlan.mutate(plan.id, {
                          onSuccess: () => {
                            toast.success(`${plan.name} removed.`)
                          },
                          onError: (error) => {
                            toast.error(describeError(error, 'Could not remove this plan.'))
                          },
                        })
                      }}
                    >
                      Remove plan
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
