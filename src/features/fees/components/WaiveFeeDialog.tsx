import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'

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

import { useWaiveFee } from '../api/waive'
import { formatRupees } from '../hooks/feeTone'
import { WaiveFormSchema, type WaiveForm } from '../types'

export interface WaiveTarget {
  studentFeeId: string
  studentName: string
  amount: number
}

interface WaiveFeeDialogProps {
  fee: WaiveTarget | null
  onClose: () => void
}

/** Controlled dialog, mirroring CancelSessionDialog's shape. The reason is
 * required and is written to audit_logs by the existing audit trigger —
 * no separate logging code needed. */
export function WaiveFeeDialog({ fee, onClose }: WaiveFeeDialogProps) {
  const waive = useWaiveFee()
  const form = useForm<WaiveForm>({
    resolver: zodResolver(WaiveFormSchema),
    defaultValues: { reason: '' },
  })

  async function onSubmit(values: WaiveForm) {
    if (!fee) return
    try {
      await waive.mutateAsync({ studentFeeId: fee.studentFeeId, reason: values.reason })
      toast.success(`Fee waived for ${fee.studentName}.`)
      form.reset()
      onClose()
    } catch {
      toast.error('Could not waive this fee.')
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
              <DialogTitle>
                Waive {formatRupees(fee.amount)} for {fee.studentName}?
              </DialogTitle>
              <DialogDescription>
                This clears what they owe on this fee. The reason is kept on record.
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
                          placeholder="Sibling discount, financial hardship, academy error…"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={onClose}>
                    Keep fee
                  </Button>
                  <Button type="submit" variant="destructive" disabled={waive.isPending}>
                    {waive.isPending ? 'Waiving…' : 'Waive fee'}
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
