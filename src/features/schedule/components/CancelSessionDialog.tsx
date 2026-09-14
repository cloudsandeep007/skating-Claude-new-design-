import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'

import { formatDate, formatTime } from '@/shared/lib/format'
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

import { useCancelSession } from '../api/cancelSession'
import { CancelSessionSchema, type CancelSession, type SessionItem } from '../types'

interface CancelSessionDialogProps {
  session: SessionItem | null
  onClose: () => void
}

/** Controlled dialog — the calendar owns which session (if any) is being cancelled. */
export function CancelSessionDialog({ session, onClose }: CancelSessionDialogProps) {
  const cancel = useCancelSession()
  const form = useForm<CancelSession>({
    resolver: zodResolver(CancelSessionSchema),
    defaultValues: { reason: '' },
  })

  async function onSubmit(values: CancelSession) {
    if (!session) return
    try {
      await cancel.mutateAsync({ sessionId: session.id, reason: values.reason })
      toast.success(
        `Session cancelled. ${session.studentCount} skater${session.studentCount === 1 ? "'s" : "s'"} parents notified.`,
      )
      form.reset()
      onClose()
    } catch {
      toast.error('Could not cancel this session.')
    }
  }

  return (
    <Dialog
      open={session !== null}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent>
        {session && (
          <>
            <DialogHeader>
              <DialogTitle>Cancel {session.batchName}?</DialogTitle>
              <DialogDescription>
                {formatDate(session.sessionDate)} at {formatTime(session.startTime)}. Every parent
                of the {session.studentCount} enrolled skaters gets a notification with your reason.
                This can't be undone.
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
                          placeholder="Rink maintenance, coach unwell…"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={onClose}>
                    Keep session
                  </Button>
                  <Button type="submit" variant="destructive" disabled={cancel.isPending}>
                    {cancel.isPending ? 'Cancelling…' : 'Cancel session'}
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
