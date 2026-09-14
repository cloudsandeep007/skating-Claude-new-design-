import { useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { CalendarPlus } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'

import { addDays, todayIso } from '@/shared/lib/format'
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
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/shared/ui/form'
import { Input } from '@/shared/ui/input'

import { useGenerateSessions } from '../api/generateSessions'
import { GenerateScheduleSchema, type GenerateSchedule, type GenerateSummary } from '../types'

function summaryMessage(s: GenerateSummary): string {
  const parts = [`${s.created} session${s.created === 1 ? '' : 's'} created`]
  if (s.holiday) parts.push(`${s.holiday} skipped (holiday)`)
  if (s.coachConflict) parts.push(`${s.coachConflict} skipped (coach already booked)`)
  if (s.exists) parts.push(`${s.exists} already existed`)
  return parts.join(' · ')
}

/** Expands a batch's weekly rule into real sessions over a date range. */
export function GenerateScheduleDialog({
  batchId,
  batchName,
}: {
  batchId: string
  batchName: string
}) {
  const [open, setOpen] = useState(false)
  const generate = useGenerateSessions()
  const today = todayIso()

  const form = useForm<GenerateSchedule>({
    resolver: zodResolver(GenerateScheduleSchema),
    defaultValues: { from: today, to: addDays(today, 27) },
  })

  async function onSubmit(values: GenerateSchedule) {
    try {
      const summary = await generate.mutateAsync({ batchId, from: values.from, to: values.to })
      toast.success(summaryMessage(summary))
      setOpen(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not generate the schedule.')
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <CalendarPlus className="h-4 w-4" />
          Generate schedule
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Generate sessions for {batchName}</DialogTitle>
          <DialogDescription>
            Creates a session on each of this batch's days between the two dates. Holidays are
            skipped, days that already have a session are left alone, and a day where the coach is
            already booked at that time is skipped and reported.
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
                name="from"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>From</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="to"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>To</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={generate.isPending}>
                {generate.isPending ? 'Generating…' : 'Generate'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
