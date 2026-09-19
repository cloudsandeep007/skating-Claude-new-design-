import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'

import { Skeleton } from '@/shared/ui/skeleton'

import { useBatch } from '../api/getBatch'
import { useUpdateBatch } from '../api/saveBatch'
import type { BatchForm as BatchFormValues } from '../types'
import { BatchForm } from './BatchForm'

export function EditBatchPage() {
  const { batchId = '' } = useParams<{ batchId: string }>()
  const navigate = useNavigate()
  const { data: batch, isLoading } = useBatch(batchId)
  const updateBatch = useUpdateBatch()

  if (isLoading || !batch) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-96 w-full rounded-lg" />
      </div>
    )
  }

  async function onSubmit(values: BatchFormValues) {
    try {
      const { removed, cancelled } = await updateBatch.mutateAsync({ batchId, form: values })
      const gone = removed + cancelled
      toast.success(
        values.applyToUpcomingSessions
          ? gone > 0
            ? `Batch updated. ${gone} upcoming session${gone === 1 ? '' : 's'} on old days taken off the calendar${
                cancelled > 0 ? ` (${cancelled} had bookings — parents notified)` : ''
              }.`
            : 'Batch and its upcoming sessions updated.'
          : 'Batch updated. Existing sessions keep their days and times.',
      )
      void navigate(`/admin/batches/${batchId}`)
    } catch {
      toast.error('Could not save these changes.')
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-4 font-display text-2xl font-extrabold tracking-tight">Edit batch</h1>
      <BatchForm
        isEdit
        defaultValues={{
          name: batch.name,
          levelRange: batch.levelRange ?? '',
          coachId: batch.coachId ?? '',
          capacity: batch.capacity,
          startTime: batch.startTime.slice(0, 5),
          endTime: batch.endTime.slice(0, 5),
          daysOfWeek: batch.daysOfWeek,
          venue: batch.venue ?? '',
          applyToUpcomingSessions: true,
        }}
        submitLabel="Save changes"
        pending={updateBatch.isPending}
        cancelTo={`/admin/batches/${batchId}`}
        onSubmit={onSubmit}
      />
    </div>
  )
}
