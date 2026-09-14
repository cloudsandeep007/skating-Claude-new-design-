import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'

import { useAuth } from '@/features/auth'
import { useBatchOptions } from '@/features/batches'
import { Button } from '@/shared/ui/button'
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
import { Textarea } from '@/shared/ui/textarea'

import { useCreateAnnouncement } from '../api/adminAnnouncements'
import { AUDIENCE_LABEL, AnnouncementFormSchema, type AnnouncementForm as Values } from '../types'

export function AnnouncementForm({ onDone }: { onDone: () => void }) {
  const { profile } = useAuth()
  const { data: batches } = useBatchOptions()
  const create = useCreateAnnouncement()

  const form = useForm<Values>({
    resolver: zodResolver(AnnouncementFormSchema),
    defaultValues: {
      title: '',
      body: '',
      audience: 'all',
      batchId: '',
      publishMode: 'now',
      publishAt: '',
      expiresAt: '',
    },
  })
  const audience = form.watch('audience')
  const publishMode = form.watch('publishMode')

  async function onSubmit(values: Values) {
    if (!profile?.academy_id) return
    try {
      await create.mutateAsync({
        academyId: profile.academy_id,
        createdBy: profile.id,
        form: values,
      })
      toast.success(values.publishMode === 'now' ? 'Published and sent.' : 'Scheduled.')
      form.reset()
      onDone()
    } catch {
      toast.error('Could not save this announcement.')
    }
  }

  return (
    <Form {...form}>
      <form
        onSubmit={(event) => {
          void form.handleSubmit(onSubmit)(event)
        }}
        className="space-y-4"
      >
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Title</FormLabel>
              <FormControl>
                <Input placeholder="Rink closed this Sunday" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="body"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Message</FormLabel>
              <FormControl>
                <Textarea rows={4} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="audience"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Who sees it</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {(Object.keys(AUDIENCE_LABEL) as (keyof typeof AUDIENCE_LABEL)[]).map((key) => (
                      <SelectItem key={key} value={key}>
                        {AUDIENCE_LABEL[key]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          {audience === 'batch' && (
            <FormField
              control={form.control}
              name="batchId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Batch</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value ?? ''}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a batch" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {batches?.map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>Its parents and its coach.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="publishMode"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Publish</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="now">Now</SelectItem>
                    <SelectItem value="later">Schedule for later</SelectItem>
                  </SelectContent>
                </Select>
              </FormItem>
            )}
          />
          {publishMode === 'later' && (
            <FormField
              control={form.control}
              name="publishAt"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Publish at</FormLabel>
                  <FormControl>
                    <Input type="datetime-local" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
        </div>

        <FormField
          control={form.control}
          name="expiresAt"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Expires (optional)</FormLabel>
              <FormControl>
                <Input type="datetime-local" className="sm:w-1/2" {...field} />
              </FormControl>
              <FormDescription>
                After this it disappears from feeds. Leave blank to keep it.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={onDone}>
            Cancel
          </Button>
          <Button type="submit" disabled={create.isPending}>
            {create.isPending ? 'Saving…' : publishMode === 'now' ? 'Publish' : 'Schedule'}
          </Button>
        </div>
      </form>
    </Form>
  )
}
