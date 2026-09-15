import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'

import { addDays, formatDate, todayIso } from '@/shared/lib/format'
import { Button } from '@/shared/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog'
import { DatePicker } from '@/shared/ui/DatePicker'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/shared/ui/form'
import { Input } from '@/shared/ui/input'

import { useScheduleMakeupSession } from '../api/scheduleMakeup'
import { ScheduleMakeupSchema, type ScheduleMakeup, type SessionItem } from '../types'

interface ScheduleMakeupDialogProps {
  session: SessionItem | null
  onClose: () => void
}

/** Controlled dialog — the calendar owns which cancelled session (if any) is
 * getting a make-up scheduled. Only the date defaults (to the next day) —
 * NOT the time, since the batch's usual slot is exactly where the coach is
 * most likely already teaching something else that day; the admin picks an
 * actually free time instead of being handed one that looks safe but isn't. */
export function ScheduleMakeupDialog({ session, onClose }: ScheduleMakeupDialogProps) {
  const scheduleMakeup = useScheduleMakeupSession()
  const form = useForm<ScheduleMakeup>({
    resolver: zodResolver(ScheduleMakeupSchema),
    values: session
      ? { date: addDays(session.sessionDate, 1), startTime: '', endTime: '' }
      : { date: todayIso(), startTime: '', endTime: '' },
  })

  async function onSubmit(values: ScheduleMakeup) {
    if (!session) return
    try {
      await scheduleMakeup.mutateAsync({ originalSessionId: session.id, form: values })
      toast.success(`Make-up class scheduled. ${session.batchName}'s parents notified.`)
      onClose()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not schedule the make-up class.')
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
              <DialogTitle>Schedule a make-up for {session.batchName}</DialogTitle>
              <DialogDescription>
                Replaces the class cancelled on {formatDate(session.sessionDate)}. Every parent of
                the {session.studentCount} enrolled skaters gets a notification.
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
                  name="date"
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
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="startTime"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Start</FormLabel>
                        <FormControl>
                          <Input type="time" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="endTime"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>End</FormLabel>
                        <FormControl>
                          <Input type="time" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={onClose}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={scheduleMakeup.isPending}>
                    {scheduleMakeup.isPending ? 'Scheduling…' : 'Schedule make-up'}
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
