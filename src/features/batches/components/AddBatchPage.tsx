import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import { useAuth } from '@/features/auth'

import { useCreateBatch } from '../api/saveBatch'
import type { BatchForm as BatchFormValues } from '../types'
import { BatchForm } from './BatchForm'

export function AddBatchPage() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const createBatch = useCreateBatch()

  async function onSubmit(values: BatchFormValues) {
    if (!profile?.academy_id) return
    try {
      const id = await createBatch.mutateAsync({ academyId: profile.academy_id, form: values })
      toast.success(`${values.name} created.`)
      void navigate(`/admin/batches/${id}`)
    } catch {
      toast.error('Could not create this batch. Is the name already in use?')
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-4 text-2xl font-extrabold tracking-tight">New batch</h1>
      <BatchForm
        defaultValues={{
          name: '',
          levelRange: '',
          coachId: '',
          capacity: 10,
          startTime: '',
          endTime: '',
          daysOfWeek: [],
          venue: '',
        }}
        submitLabel="Create batch"
        pending={createBatch.isPending}
        cancelTo="/admin/batches"
        onSubmit={onSubmit}
      />
    </div>
  )
}
