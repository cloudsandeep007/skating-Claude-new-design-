import { formatDate, formatDays, formatTimeRange } from '@/shared/lib/format'
import { EmptyState } from '@/shared/ui/EmptyState'
import { Skeleton } from '@/shared/ui/skeleton'
import { StatusBadge } from '@/shared/ui/StatusBadge'

import { useChildProfile } from '../api/childData'
import { useCurrentChild } from '../hooks/useSelectedChild'
import { ChildSelector } from './ChildSelector'

function age(dateOfBirth: string) {
  const dob = new Date(`${dateOfBirth}T00:00:00`)
  const now = new Date()
  let years = now.getFullYear() - dob.getFullYear()
  const beforeBirthday =
    now.getMonth() < dob.getMonth() ||
    (now.getMonth() === dob.getMonth() && now.getDate() < dob.getDate())
  if (beforeBirthday) years -= 1
  return years
}

export function ChildProfilePage() {
  const { child } = useCurrentChild()
  const { data, isLoading } = useChildProfile(child?.id ?? null)

  if (!child) return <EmptyState title="No skater linked to your account" />
  if (isLoading || !data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-40 w-full rounded-lg" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <ChildSelector subtitle="Profile" />

      <div className="flex flex-wrap gap-2">
        {data.levelName && <StatusBadge tone="dark">{data.levelName}</StatusBadge>}
        {data.dateOfBirth && <StatusBadge tone="neutral">Age {age(data.dateOfBirth)}</StatusBadge>}
        <StatusBadge tone="neutral">Since {formatDate(data.joinedDate)}</StatusBadge>
      </div>

      <section className="rounded-lg border bg-card shadow-sm">
        <div className="border-b px-4 py-3 font-bold">Batches</div>
        {data.batches.length === 0 ? (
          <div className="px-4 py-3 text-sm text-muted-foreground">
            Not enrolled in a batch yet.
          </div>
        ) : (
          <ul className="divide-y">
            {data.batches.map((b) => (
              <li key={b.id} className="px-4 py-3">
                <div className="font-bold">{b.name}</div>
                <div className="text-sm text-muted-foreground">
                  {formatDays(b.daysOfWeek)} · {formatTimeRange(b.startTime, b.endTime)}
                  {b.venue && ` · ${b.venue}`}
                </div>
                {b.coachName && (
                  <div className="text-sm text-muted-foreground">Coach {b.coachName}</div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-lg border bg-card shadow-sm">
        <div className="border-b px-4 py-3 font-bold">On file with the academy</div>
        <dl className="divide-y text-sm">
          <div className="flex gap-3 px-4 py-3">
            <dt className="w-32 shrink-0 text-muted-foreground">Emergency contact</dt>
            <dd>
              {data.emergencyContact?.name ?? '—'}
              {data.emergencyContact?.phone && (
                <div className="font-mono text-xs">{data.emergencyContact.phone}</div>
              )}
            </dd>
          </div>
          <div className="flex gap-3 px-4 py-3">
            <dt className="w-32 shrink-0 text-muted-foreground">Medical notes</dt>
            <dd>{data.medicalNotes ?? '—'}</dd>
          </div>
        </dl>
        <div className="border-t px-4 py-2.5 text-xs text-muted-foreground">
          Something out of date? Tell the academy office — they update these.
        </div>
      </section>
    </div>
  )
}
