import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'

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
import { Textarea } from '@/shared/ui/textarea'

import { BILLING_CYCLES, BILLING_CYCLE_LABEL, FeePlanFormSchema, type FeePlanForm } from '../types'

const EMPTY: FeePlanForm = { name: '', amount: 0, billingCycle: 'monthly', description: '' }

interface FeePlanFormDialogProps {
  trigger: React.ReactNode
  title: string
  defaultValues?: FeePlanForm
  submitLabel: string
  pending: boolean
  onSubmit: (values: FeePlanForm) => Promise<void>
}

export function FeePlanFormDialog({
  trigger,
  title,
  defaultValues,
  submitLabel,
  pending,
  onSubmit,
}: FeePlanFormDialogProps) {
  const [open, setOpen] = useState(false)
  const form = useForm<FeePlanForm>({
    resolver: zodResolver(FeePlanFormSchema),
    defaultValues: defaultValues ?? EMPTY,
  })

  function close() {
    setOpen(false)
    form.reset(defaultValues ?? EMPTY)
  }

  async function submit(values: FeePlanForm) {
    await onSubmit(values)
    close()
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) setOpen(true)
        else close()
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>What families are billed and how often.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={(event) => {
              void form.handleSubmit(submit)(event)
            }}
            className="space-y-4"
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Plan name</FormLabel>
                  <FormControl>
                    <Input placeholder="Monthly" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount (₹)</FormLabel>
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
                name="billingCycle"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Billing cycle</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {BILLING_CYCLES.map((c) => (
                          <SelectItem key={c} value={c}>
                            {BILLING_CYCLE_LABEL[c]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (optional)</FormLabel>
                  <FormControl>
                    <Textarea rows={2} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" disabled={pending}>
                {pending ? 'Saving…' : submitLabel}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
