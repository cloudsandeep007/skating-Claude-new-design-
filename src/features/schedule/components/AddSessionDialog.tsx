import { useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { Plus } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'

import { useAuth } from '@/features/auth'
import { todayIso } from '@/shared/lib/format'
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'

import { useAddSession, useBatchesForSession } from '../api/addSession'
import { ExtraSessionSchema, type ExtraSession } from '../types'

/** A one-off session outside the weekly rule (make-up class, extra practice). */
export function AddSessionDialog({ defaultDate }: { defaultDate?: string }) {
  const [open, setOpen] = useState(false)
  const { profile } = useAuth()
  const { data: batches } = useBatchesForSession()
  const addSession = useAddSession()

  const form = useForm<ExtraSession>({
    resolver: zodResolver(ExtraSessionSchema),
    defaultValues: {
      batchId: '',
      sessionDate: defaultDate ?? todayIso(),
      startTime: '',
      endTime: '',
    },
  })

  function onBatchChange(batchId: string) {
    form.setValue('batchId', batchId)
    const batch = batches?.find((b) => b.id === batchId)
    if (batch) {
      form.setValue('startTime', batch.startTime)
      form.setValue('endTime', batch.endTime)
    }
  }

  async function onSubmit(values: ExtraSession) {
    if (!profile?.academy_id) return
    try {
      await addSession.mutateAsync({ academyId: profile.academy_id, form: values })
      toast.success('Extra session added.')
      form.reset()
      setOpen(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not add this session.')
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4" />
          Extra session
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a one-off session</DialogTitle>
          <DialogDescription>
            Times default to the batch's usual slot — change them for a different time. The batch's
            coach is checked for clashes on that day.
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
              name="batchId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Batch</FormLabel>
                  <Select onValueChange={onBatchChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a batch" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {batches?.map((batch) => (
                        <SelectItem key={batch.id} value={batch.id}>
                          {batch.name}
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
              name="sessionDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Date</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
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
              <Button type="submit" disabled={addSession.isPending}>
                {addSession.isPending ? 'Adding…' : 'Add session'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
