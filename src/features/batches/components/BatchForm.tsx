import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'

import { useCoachOptions } from '@/features/coaches'
import { Button } from '@/shared/ui/button'
import { Card, CardContent } from '@/shared/ui/card'
import { Checkbox } from '@/shared/ui/checkbox'
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
import { cn } from '@/shared/lib/utils'

import { BatchFormSchema, DAY_LABELS, type BatchForm as BatchFormValues } from '../types'

interface BatchFormProps {
  defaultValues: BatchFormValues
  /** Shown only when editing — offers to move future scheduled sessions too. */
  isEdit?: boolean
  submitLabel: string
  pending: boolean
  cancelTo: string
  onSubmit: (values: BatchFormValues) => Promise<void>
}

export function BatchForm({
  defaultValues,
  isEdit = false,
  submitLabel,
  pending,
  cancelTo,
  onSubmit,
}: BatchFormProps) {
  const { data: coaches } = useCoachOptions()
  const form = useForm<BatchFormValues>({
    resolver: zodResolver(BatchFormSchema),
    defaultValues,
  })

  return (
    <Form {...form}>
      <form
        onSubmit={(event) => {
          void form.handleSubmit(onSubmit)(event)
        }}
        className="space-y-6"
      >
        <Card>
          <CardContent className="space-y-4 pt-6">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Batch name</FormLabel>
                  <FormControl>
                    <Input placeholder="Beginner A — Morning" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="levelRange"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Level range (optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="Beginner 1–3" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="coachId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Coach</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value ?? ''}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Unassigned" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {coaches?.map((coach) => (
                          <SelectItem key={coach.id} value={coach.id}>
                            {coach.fullName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
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
              <FormField
                control={form.control}
                name="capacity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Capacity</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
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
            </div>

            <FormField
              control={form.control}
              name="daysOfWeek"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Days</FormLabel>
                  <div className="flex flex-wrap gap-2">
                    {DAY_LABELS.map((label, day) => {
                      const selected = field.value.includes(day)
                      return (
                        <button
                          key={label}
                          type="button"
                          aria-pressed={selected}
                          onClick={() => {
                            field.onChange(
                              selected
                                ? field.value.filter((d) => d !== day)
                                : [...field.value, day],
                            )
                          }}
                          className={cn(
                            'h-11 min-w-[52px] rounded-lg border-[1.5px] px-3 text-sm font-bold transition-colors',
                            selected
                              ? 'border-primary bg-primary text-primary-foreground'
                              : 'border-input bg-card hover:bg-muted',
                          )}
                        >
                          {label}
                        </button>
                      )
                    })}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="venue"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Venue (optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="Rink A" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {isEdit && (
              <FormField
                control={form.control}
                name="applyToUpcomingSessions"
                render={({ field }) => (
                  <FormItem className="flex items-start gap-3 rounded-lg border bg-muted p-3.5">
                    <FormControl>
                      <Checkbox
                        checked={field.value ?? false}
                        onCheckedChange={(checked) => {
                          field.onChange(checked === true)
                        }}
                        className="mt-0.5"
                      />
                    </FormControl>
                    <div className="space-y-1">
                      <FormLabel className="font-bold">
                        Also move upcoming scheduled sessions
                      </FormLabel>
                      <FormDescription>
                        Applies the new time and coach to sessions from today onward that haven't
                        happened yet. Completed and cancelled sessions are never changed. Leave
                        unticked to change only sessions generated from now on.
                      </FormDescription>
                    </div>
                  </FormItem>
                )}
              />
            )}
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Button variant="outline" asChild>
            <Link to={cancelTo}>Cancel</Link>
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? 'Saving…' : submitLabel}
          </Button>
        </div>
      </form>
    </Form>
  )
}
