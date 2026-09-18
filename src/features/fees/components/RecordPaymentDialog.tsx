import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'

import { todayIso } from '@/shared/lib/format'
import { Button } from '@/shared/ui/button'
import { Checkbox } from '@/shared/ui/checkbox'
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

import { useRecordPayment } from '../api/payments'
import { remainingBalance, round2 } from '../hooks/feeMath'
import { formatRupees } from '../hooks/feeTone'
import {
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABEL,
  PaymentFormSchema,
  type PaymentForm,
} from '../types'

export interface PaymentTarget {
  studentFeeId: string
  studentName: string
  amount: number
  paid: number
}

interface RecordPaymentDialogProps {
  fee: PaymentTarget | null
  onClose: () => void
}

/** Controlled dialog — the fee list owns which fee (if any) is being paid.
 * Defaults the amount to the remaining balance; less is a partial payment,
 * more is refused (the database caps a payment at what's owed). */
export function RecordPaymentDialog({ fee, onClose }: RecordPaymentDialogProps) {
  const recordPayment = useRecordPayment()
  const balance = fee ? remainingBalance(fee.amount, fee.paid) : 0

  // One key per opening of the form. If the request is retried (lost
  // response on rink Wi-Fi), the server returns the payment it already
  // recorded instead of a second one. A fresh key after every success.
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID())
  useEffect(() => {
    if (fee) setIdempotencyKey(crypto.randomUUID())
  }, [fee?.studentFeeId]) // eslint-disable-line react-hooks/exhaustive-deps

  const form = useForm<PaymentForm>({
    resolver: zodResolver(
      PaymentFormSchema.refine((v) => v.acceptAdvance || v.amount <= balance, {
        message: `That's more than the ${formatRupees(balance)} still owed — tick "keep the extra as an advance" below to accept it`,
        path: ['amount'],
      }).refine((v) => v.paidDate <= todayIso(), {
        message: "Can't be in the future",
        path: ['paidDate'],
      }),
    ),
    values: fee
      ? {
          amount: balance,
          paidDate: todayIso(),
          method: 'cash',
          reference: '',
          notes: '',
          acceptAdvance: false,
        }
      : undefined,
  })
  const amount = form.watch('amount')
  const acceptAdvance = form.watch('acceptAdvance')
  const extra = Number.isFinite(amount) && amount > balance ? round2(amount - balance) : 0

  async function onSubmit(values: PaymentForm) {
    if (!fee) return
    try {
      const { receiptNo } = await recordPayment.mutateAsync({
        studentFeeId: fee.studentFeeId,
        form: values,
        idempotencyKey,
      })
      const kept = values.amount > balance ? round2(values.amount - balance) : 0
      toast.success(
        `Payment of ${formatRupees(values.amount)} recorded for ${fee.studentName}.${receiptNo ? ` Receipt ${receiptNo}.` : ''}${kept > 0 ? ` ${formatRupees(kept)} kept as an advance.` : ''}`,
      )
      setIdempotencyKey(crypto.randomUUID())
      onClose()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not record this payment.')
    }
  }

  return (
    <Dialog
      open={fee !== null}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent>
        {fee && (
          <>
            <DialogHeader>
              <DialogTitle>Record a payment — {fee.studentName}</DialogTitle>
              <DialogDescription>
                {balance > 0
                  ? `${formatRupees(balance)} of ${formatRupees(fee.amount)} still owed. A receipt number is issued automatically.`
                  : 'This fee is already fully paid.'}
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
                    name="amount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Amount</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            min={0}
                            max={acceptAdvance ? undefined : balance}
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
                        <FormLabel>Date</FormLabel>
                        <FormControl>
                          <DatePicker value={field.value} onChange={field.onChange} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {extra > 0 && (
                  <FormField
                    control={form.control}
                    name="acceptAdvance"
                    render={({ field }) => (
                      <FormItem>
                        <label className="flex items-start gap-2 rounded-md border border-primary/30 bg-primary/5 p-3 text-sm">
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={(v) => {
                              field.onChange(v === true)
                            }}
                          />
                          <span>
                            <span className="font-semibold">
                              Keep the extra {formatRupees(extra)} as an advance
                            </span>
                            <span className="block text-xs text-muted-foreground">
                              It's applied automatically to the next fee. The receipt shows the full{' '}
                              {formatRupees(Number.isFinite(amount) ? amount : 0)}.
                            </span>
                          </span>
                        </label>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

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
                  <Button type="submit" disabled={recordPayment.isPending}>
                    {recordPayment.isPending ? 'Recording…' : 'Record payment'}
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
