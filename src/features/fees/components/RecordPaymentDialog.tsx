import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'

import { todayIso } from '@/shared/lib/format'
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

import { useRecordPayment } from '../api/payments'
import { remainingBalance } from '../hooks/feeMath'
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
 * Defaults the amount to the remaining balance, but any amount is accepted
 * (less = a partial payment, more = an overpayment that still clears it). */
export function RecordPaymentDialog({ fee, onClose }: RecordPaymentDialogProps) {
  const recordPayment = useRecordPayment()
  const form = useForm<PaymentForm>({
    resolver: zodResolver(PaymentFormSchema),
    values: fee
      ? {
          amount: remainingBalance(fee.amount, fee.paid),
          paidDate: todayIso(),
          method: 'cash',
          reference: '',
          notes: '',
        }
      : undefined,
  })

  async function onSubmit(values: PaymentForm) {
    if (!fee) return
    try {
      await recordPayment.mutateAsync({ studentFeeId: fee.studentFeeId, form: values })
      toast.success(`Payment of ${formatRupees(values.amount)} recorded for ${fee.studentName}.`)
      onClose()
    } catch {
      toast.error('Could not record this payment.')
    }
  }

  const balance = fee ? remainingBalance(fee.amount, fee.paid) : 0

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
                  ? `${formatRupees(balance)} of ${formatRupees(fee.amount)} still owed.`
                  : 'This fee is already fully covered — recording anyway adds an extra payment.'}
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
