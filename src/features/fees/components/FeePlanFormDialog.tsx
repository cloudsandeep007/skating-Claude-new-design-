import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'

import { useBatchOptions } from '@/features/batches'
import { Button } from '@/shared/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/shared/ui/dialog'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/shared/ui/form'
import { Input } from '@/shared/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Textarea } from '@/shared/ui/textarea'

import {
  BILLING_CYCLES,
  BILLING_CYCLE_LABEL,
  FEE_PRICING_MODES,
  FEE_PRICING_MODE_LABEL,
  FeePlanFormSchema,
  type FeePlanForm,
} from '../types'

const EMPTY: FeePlanForm = {
  name: '',
  amount: 0,
  billingCycle: 'monthly',
  description: '',
  batchId: null,
  pricingMode: 'cycle',
  perClassRate: null,
}

interface FeePlanFormDialogProps {
  trigger: React.ReactNode
  title: string
  defaultValues?: FeePlanForm
  submitLabel: string
  pending: boolean
  onSubmit: (values: FeePlanForm) => Promise<void>
}

export function FeePlanFormDialog({
  trigger,
  title,
  defaultValues,
  submitLabel,
  pending,
  onSubmit,
}: FeePlanFormDialogProps) {
  const [open, setOpen] = useState(false)
  const { data: batches } = useBatchOptions()
  const form = useForm<FeePlanForm>({
    resolver: zodResolver(FeePlanFormSchema),
    defaultValues: defaultValues ?? EMPTY,
  })
  const pricingMode = form.watch('pricingMode')

  function close() {
    setOpen(false)
    form.reset(defaultValues ?? EMPTY)
  }

  async function submit(values: FeePlanForm) {
    // A failed save keeps the dialog open with everything typed still in
    // it; the caller has already shown the reason in a toast.
    try {
      await onSubmit(values)
    } catch {
      return
    }
    close()
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) setOpen(true)
        else close()
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>What families are billed and how often.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={(event) => {
              void form.handleSubmit(submit)(event)
            }}
            className="space-y-4"
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Plan name</FormLabel>
                  <FormControl>
                    <Input placeholder="Monthly" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="pricingMode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Pricing</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {FEE_PRICING_MODES.map((m) => (
                        <SelectItem key={m} value={m}>
                          {FEE_PRICING_MODE_LABEL[m]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Cycle amount bills the same total each period. Per class bills a rate times how
                    many classes the batch's schedule has that period — pick this for a batch billed
                    by the class instead of a flat fee.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              {pricingMode === 'per_class' ? (
                <FormField
                  control={form.control}
                  name="perClassRate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Rate per class (₹)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          min={0}
                          name={field.name}
                          ref={field.ref}
                          onBlur={field.onBlur}
                          value={
                            field.value == null || Number.isNaN(field.value) ? '' : field.value
                          }
                          onChange={(event) => {
                            field.onChange(
                              event.target.value === '' ? null : event.target.valueAsNumber,
                            )
                          }}
                        />
                      </FormControl>
                      <FormDescription>
                        Families top up in classes, not per period. A monthly plan starts with at
                        least 8 classes, quarterly 24, annual 96; unused classes expire when the
                        term ends without a renewal.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ) : (
                <FormField
                  control={form.control}
                  name="amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Amount (₹)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          min={0}
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
              )}
              <FormField
                control={form.control}
                name="billingCycle"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Billing cycle</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {BILLING_CYCLES.map((c) => (
                          <SelectItem key={c} value={c}>
                            {BILLING_CYCLE_LABEL[c]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="batchId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Batch {pricingMode === 'per_class' ? '' : '(optional)'}</FormLabel>
                  <Select
                    onValueChange={(value) => {
                      field.onChange(value === 'all' ? null : value)
                    }}
                    value={field.value ?? 'all'}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {pricingMode !== 'per_class' && (
                        <SelectItem value="all">All batches (academy-wide)</SelectItem>
                      )}
                      {batches?.map((batch) => (
                        <SelectItem key={batch.id} value={batch.id}>
                          {batch.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    {pricingMode === 'per_class'
                      ? "A per-class plan is priced from this batch's weekly schedule, so a batch is required."
                      : 'Scope this plan to one batch — e.g. a cheaper plan for a weekend-only batch. Leave as "All batches" for a plan any student can be assigned, regardless of batch.'}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (optional)</FormLabel>
                  <FormControl>
                    <Textarea rows={2} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" disabled={pending}>
                {pending ? 'Saving…' : submitLabel}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
