import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'

import { formatDate } from '@/shared/lib/format'
import { Button } from '@/shared/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/shared/ui/form'
import { Textarea } from '@/shared/ui/textarea'

import { useVoidPayment } from '../api/payments'
import { formatRupees } from '../hooks/feeTone'
import { VoidPaymentFormSchema, type VoidPaymentForm } from '../types'

export interface VoidTarget {
  paymentId: string
  amount: number
  paidDate: string
  receiptNo: string | null
}

interface VoidPaymentDialogProps {
  payment: VoidTarget | null
  onClose: () => void
}

/** A payment is never deleted — voiding keeps it on the record, struck
 * through with the reason, and it stops counting toward the fee. */
export function VoidPaymentDialog({ payment, onClose }: VoidPaymentDialogProps) {
  const voidPayment = useVoidPayment()
  const form = useForm<VoidPaymentForm>({
    resolver: zodResolver(VoidPaymentFormSchema),
    defaultValues: { reason: '' },
  })

  async function onSubmit(values: VoidPaymentForm) {
    if (!payment) return
    try {
      await voidPayment.mutateAsync({ paymentId: payment.paymentId, reason: values.reason })
      toast.success('Payment voided.')
      form.reset()
      onClose()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not void this payment.')
    }
  }

  return (
    <Dialog
      open={payment !== null}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent>
        {payment && (
          <>
            <DialogHeader>
              <DialogTitle>
                Void {formatRupees(payment.amount)}
                {payment.receiptNo ? ` (${payment.receiptNo})` : ''}?
              </DialogTitle>
              <DialogDescription>
                Recorded {formatDate(payment.paidDate)}. The payment stays on record, crossed out
                with your reason, and stops counting toward the fee — whose status is
                recalculated from what's left. If that would take away credits the skater has
                already booked with, it will be refused.
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form
                onSubmit={(event) => {
                  void form.handleSubmit(onSubmit)(event)
                }}
                className="space-y-4"
              >
                <FormField
                  control={form.control}
                  name="reason"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Reason</FormLabel>
                      <FormControl>
                        <Textarea
                          rows={3}
                          placeholder="Entered on the wrong skater, cheque bounced, duplicate entry…"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={onClose}>
                    Keep it
                  </Button>
                  <Button type="submit" variant="destructive" disabled={voidPayment.isPending}>
                    {voidPayment.isPending ? 'Voiding…' : 'Void payment'}
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
