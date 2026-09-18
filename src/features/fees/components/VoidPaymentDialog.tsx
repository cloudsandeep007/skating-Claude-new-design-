import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'

import { formatDate, formatTime } from '@/shared/lib/format'
import { Button } from '@/shared/ui/button'
import { Checkbox } from '@/shared/ui/checkbox'
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

import { useClawbackPreview, useVoidPayment } from '../api/payments'
import { formatRupees } from '../hooks/feeTone'
import { VoidPaymentFormSchema, type VoidPaymentForm } from '../types'

export interface VoidTarget {
  paymentId: string
  amount: number
  paidDate: string
  receiptNo: string | null
  /** Needed to preview the clawback: whose credits, and how many the
   * fee would stop granting if this payment no longer covers it. */
  studentId: string
  creditsAtRisk: number
}

interface VoidPaymentDialogProps {
  payment: VoidTarget | null
  onClose: () => void
}

/** A payment is never deleted — voiding keeps it on the record, struck
 * through with the reason, and it stops counting toward the fee. If the
 * fee then stops granting credits the skater has already booked with, the
 * dialog shows exactly which upcoming classes will be cancelled and asks
 * for an explicit confirmation before doing it. */
export function VoidPaymentDialog({ payment, onClose }: VoidPaymentDialogProps) {
  const voidPayment = useVoidPayment()
  const { data: preview } = useClawbackPreview(
    payment?.studentId ?? null,
    payment?.creditsAtRisk ?? 0,
  )
  const [confirmCancel, setConfirmCancel] = useState(false)
  useEffect(() => {
    setConfirmCancel(false)
  }, [payment?.paymentId])

  const form = useForm<VoidPaymentForm>({
    resolver: zodResolver(VoidPaymentFormSchema),
    defaultValues: { reason: '' },
  })

  const shortfall = preview?.shortfall ?? 0
  const needsConfirm = shortfall > 0

  async function onSubmit(values: VoidPaymentForm) {
    if (!payment) return
    try {
      await voidPayment.mutateAsync({
        paymentId: payment.paymentId,
        reason: values.reason,
        cancelBookings: needsConfirm && confirmCancel,
      })
      toast.success(
        needsConfirm && confirmCancel
          ? `Payment voided; ${preview?.bookings.length ?? shortfall} upcoming booking${
              (preview?.bookings.length ?? shortfall) === 1 ? '' : 's'
            } cancelled and the parent notified.`
          : 'Payment voided.',
      )
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
                with your reason, and stops counting toward the fee — whose status is recalculated
                from what's left.
              </DialogDescription>
            </DialogHeader>

            {needsConfirm && (
              <div className="rounded-md border border-brand-500/40 bg-brand-500/10 p-3 text-sm">
                <p className="font-semibold">
                  This takes back {payment.creditsAtRisk} class
                  {payment.creditsAtRisk === 1 ? '' : 'es'} the skater has already booked with.{' '}
                  {shortfall} upcoming booking{shortfall === 1 ? '' : 's'} will be cancelled:
                </p>
                <ul className="mt-1.5 space-y-0.5 text-muted-foreground">
                  {preview?.bookings.map((b) => (
                    <li key={b.bookingId}>
                      {formatDate(b.sessionDate)} · {formatTime(b.startTime)} · {b.batchName}
                    </li>
                  ))}
                  {preview && preview.bookings.length < shortfall && (
                    <li>
                      …and {shortfall - preview.bookings.length} already-attended class
                      {shortfall - preview.bookings.length === 1 ? '' : 'es'} can't be undone — the
                      skater will owe {shortfall - preview.bookings.length}.
                    </li>
                  )}
                </ul>
                <label className="mt-2.5 flex items-center gap-2 font-semibold">
                  <Checkbox
                    checked={confirmCancel}
                    onCheckedChange={(v) => {
                      setConfirmCancel(v === true)
                    }}
                  />
                  Cancel those bookings and notify the parent
                </label>
              </div>
            )}

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
                  <Button
                    type="submit"
                    variant="destructive"
                    disabled={voidPayment.isPending || (needsConfirm && !confirmCancel)}
                  >
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
