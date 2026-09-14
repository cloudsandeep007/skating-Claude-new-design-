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
import { Textarea } from '@/shared/ui/textarea'

import { LevelFormSchema, type LevelForm } from '../types'

const EMPTY: LevelForm = { name: '', description: '' }

interface NameDescriptionDialogProps {
  trigger: React.ReactNode
  title: string
  description: string
  namePlaceholder: string
  defaultValues?: LevelForm
  submitLabel: string
  pending: boolean
  onSubmit: (values: LevelForm) => Promise<void>
}

/** Shared create/edit form for both levels and skills — same two fields
 * (name, optional description), just different copy and target table. */
export function NameDescriptionDialog({
  trigger,
  title,
  description,
  namePlaceholder,
  defaultValues,
  submitLabel,
  pending,
  onSubmit,
}: NameDescriptionDialogProps) {
  const [open, setOpen] = useState(false)
  const form = useForm<LevelForm>({
    resolver: zodResolver(LevelFormSchema),
    defaultValues: defaultValues ?? EMPTY,
  })

  function close() {
    setOpen(false)
    form.reset(defaultValues ?? EMPTY)
  }

  async function submit(values: LevelForm) {
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
          <DialogDescription>{description}</DialogDescription>
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
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder={namePlaceholder} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (optional)</FormLabel>
                  <FormControl>
                    <Textarea rows={3} {...field} />
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
