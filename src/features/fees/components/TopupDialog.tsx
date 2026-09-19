import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'

import { planTopup, useCreditPlanStatus, type TopupPlan } from '@/features/schedule'
import { formatDate, todayIso } from '@/shared/lib/format'
import { Button } from '@/shared/ui/button'
import { DatePicker } from '@/shared/ui/DatePicker'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/shared/ui/form'
import { Input } from '@/shared/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Textarea } from '@/shared/ui/textarea'

import { useRecordTopup } from '../api/topups'
import { formatRupees } from '../hooks/feeTone'
import { PAYMENT_METHODS, PAYMENT_METHOD_LABEL, TopupFormSchema, type TopupForm } from '../types'

export interface TopupTarget {
  studentId: string
  studentName: string
}

interface TopupDialogProps {
  target: TopupTarget | null
  onClose: () => void
}

function describe(plan: TopupPlan | null, minTopup: number | null, classes: number): string {
  if (!plan) {
    return minTopup != null && classes < minTopup
      ? `Starting a plan needs at least ${minTopup} classes.`
      : 'Enter the number of classes.'
  }
  switch (plan.kind) {
    case 'extra':
      return `Adds ${classes} class${classes === 1 ? '' : 'es'} to the current term (valid till ${formatDate(plan.termEnd)}).`
    case 'renewal':
      return `Renews the plan: new term ${formatDate(plan.termStart)} – ${formatDate(plan.termEnd)}, following on from the current one. Unused classes carry forward.`
    case 'new':
      return `Starts a new term ${formatDate(plan.termStart)} – ${formatDate(plan.termEnd)}.`
  }
}

/** Controlled dialog — "the family paid for N classes". Shows, before
 * anything is recorded, exactly what that number of classes will do to the
 * skater's term, using the same rule as the database. */
export function TopupDialog({ target, onClose }: TopupDialogProps) {
  const { data: status } = useCreditPlanStatus(target?.studentId ?? null)
  const recordTopup = useRecordTopup()
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID())
  useEffect(() => {
    if (target) setIdempotencyKey(crypto.randomUUID())
  }, [target?.studentId]) // eslint-disable-line react-hooks/exhaustive-deps

  const minTopup = status?.minTopup ?? null
  const live = status?.termStatus === 'active' || status?.termStatus === 'expiring'

  const form = useForm<TopupForm>({
    resolver: zodResolver(
      TopupFormSchema.refine((v) => live || minTopup == null || v.classes >= minTopup, {
        message: `A new ${status?.billingCycle ?? ''} plan needs at least ${minTopup ?? 0} classes`,
        path: ['classes'],
      }).refine((v) => v.paidDate <= todayIso(), {
        message: "Can't be in the future",
        path: ['paidDate'],
      }),
    ),
    values: target
      ? {
          classes: live ? 1 : (minTopup ?? 8),
          paidDate: todayIso(),
          method: 'cash',
          reference: '',
          notes: '',
        }
      : undefined,
  })

  const classes = form.watch('classes')
  const paidDate = form.watch('paidDate')
  const preview =
    status && Number.isFinite(classes) ? planTopup(status, classes, paidDate || todayIso()) : null

  async function onSubmit(values: TopupForm) {
    if (!target) return
    try {
      const result = await recordTopup.mutateAsync({
        studentId: target.studentId,
        classes: values.classes,
        paidDate: values.paidDate,
        method: values.method,
        reference: values.reference,
        notes: values.notes,
        idempotencyKey,
      })
      toast.success(
        `${result.classes} class${result.classes === 1 ? '' : 'es'} (${formatRupees(result.amount)}) added for ${target.studentName} — valid till ${formatDate(result.termEnd)}.`,
      )
      setIdempotencyKey(crypto.randomUUID())
      onClose()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not record this top-up.')
    }
  }

  return (
    <Dialog
      open={target !== null}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent>
        {target && (
          <>
            <DialogHeader>
              <DialogTitle>Top up classes — {target.studentName}</DialogTitle>
              <DialogDescription>
                {status?.rate != null
                  ? `₹${status.rate} per class · ${status.planName ?? 'plan'}${
                      status.planBatchName && status.planBatchName !== status.planName
                        ? ` (${status.planBatchName} batch)`
                        : ''
                    } · ${status.billingCycle}${
                      status.termEnd
                        ? status.termStatus === 'expired'
                          ? ` · lapsed ${formatDate(status.termEnd)}`
                          : ` · current term ends ${formatDate(status.termEnd)}`
                        : ''
                    }. A receipt number is issued automatically.`
                  : 'Loading the plan…'}
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form
                onSubmit={(event) => {
                  void form.handleSubmit(onSubmit)(event)
                }}
                className="space-y-4"
              >
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="classes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Classes</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="1"
                            min={1}
                            name={field.name}
                            ref={field.ref}
                            onBlur={field.onBlur}
                            value={Number.isNaN(field.value) ? '' : field.value}
                            onChange={(event) => {
                              field.onChange(event.target.valueAsNumber)
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="paidDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Paid on</FormLabel>
                        <FormControl>
                          <DatePicker value={field.value} onChange={field.onChange} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="rounded-md bg-muted px-3 py-2 text-sm">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-muted-foreground">Amount</span>
                    <span className="font-display text-xl font-extrabold">
                      {preview ? formatRupees(preview.amount) : '—'}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {describe(preview, minTopup, Number.isFinite(classes) ? classes : 0)}
                  </p>
                </div>

                <FormField
                  control={form.control}
                  name="method"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Method</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {PAYMENT_METHODS.map((m) => (
                            <SelectItem key={m} value={m}>
                              {PAYMENT_METHOD_LABEL[m]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="reference"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Reference (optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="UPI transaction id, cheque no…" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes (optional)</FormLabel>
                      <FormControl>
                        <Textarea rows={2} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={onClose}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={recordTopup.isPending || !preview}>
                    {recordTopup.isPending ? 'Recording…' : 'Record top-up'}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
