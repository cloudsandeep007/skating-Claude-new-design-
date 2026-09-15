import { BellRing } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'

import { formatDate } from '@/shared/lib/format'
import { useSignedPhotoUrls } from '@/shared/lib/signedPhotoUrls'
import { cn } from '@/shared/lib/utils'
import { Button } from '@/shared/ui/button'
import { Checkbox } from '@/shared/ui/checkbox'
import { EmptyState } from '@/shared/ui/EmptyState'
import { PersonAvatar } from '@/shared/ui/PersonAvatar'
import { Skeleton } from '@/shared/ui/skeleton'
import { StatusBadge } from '@/shared/ui/StatusBadge'

import { useRenewalsDue, useSendRenewalReminders } from '../api/renewalsDue'
import type { RenewalDueRow } from '../types'

const WITHIN_DAYS = 7

const CYCLE_LABEL = { monthly: 'Monthly', quarterly: 'Quarterly', annual: 'Annual' } as const

function daysAgo(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  return days === 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`
}

/** Skaters whose plan term ends within a week or has already lapsed —
 * grouped by cycle, with a reminder button. Unused classes expire when the
 * term ends without a top-up, so this is the list to work through before
 * month-, quarter- and year-end. */
export function RenewalsDuePanel() {
  const { data, isLoading, isError, refetch } = useRenewalsDue(WITHIN_DAYS)
  const send = useSendRenewalReminders()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const { data: photoUrls } = useSignedPhotoUrls(
    'student-photos',
    (data ?? []).map((r) => r.photoUrl),
  )

  const rows = data ?? []
  const groups = (['monthly', 'quarterly', 'annual'] as const)
    .map((cycle) => ({ cycle, rows: rows.filter((r) => r.billingCycle === cycle) }))
    .filter((g) => g.rows.length > 0)

  function remind(ids: string[]) {
    send.mutate(ids, {
      onSuccess: (count) => {
        toast.success(
          count === 0
            ? 'No linked parents to notify.'
            : `Reminder sent to ${count} parent${count === 1 ? '' : 's'}.`,
        )
        setSelected(new Set())
      },
      onError: (error) => {
        toast.error(error instanceof Error ? error.message : 'Could not send reminders.')
      },
    })
  }

  if (isError) {
    return (
      <EmptyState
        tone="error"
        title="Couldn't load renewals"
        description="Check your connection and try again."
        action={
          <button
            type="button"
            onClick={() => {
              void refetch()
            }}
            className="text-sm font-bold underline"
          >
            Try again
          </button>
        }
      />
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
      <div className="flex flex-wrap items-center gap-3 border-b px-5 py-3.5">
        <span className="font-display text-xl font-extrabold tracking-tight">Renewals due</span>
        {!isLoading && (
          <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-bold uppercase tracking-wide">
            {rows.length} skater{rows.length === 1 ? '' : 's'}
          </span>
        )}
        <span className="text-sm text-muted-foreground">
          Plans ending within {WITHIN_DAYS} days, or already lapsed
        </span>
        {rows.length > 0 && (
          <Button
            size="sm"
            className="ml-auto"
            disabled={send.isPending || selected.size === 0}
            onClick={() => {
              remind([...selected])
            }}
          >
            <BellRing className="h-4 w-4" />
            Remind {selected.size > 0 ? `(${selected.size})` : ''}
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3 p-5">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="p-6">
          <EmptyState
            title="Nothing ending soon"
            description={`No skater's plan ends in the next ${WITHIN_DAYS} days.`}
          />
        </div>
      ) : (
        groups.map((g) => (
          <section key={g.cycle}>
            <div className="flex items-center gap-3 bg-muted/60 px-5 py-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
              <Checkbox
                aria-label={`Select all ${CYCLE_LABEL[g.cycle]}`}
                checked={g.rows.every((r) => selected.has(r.studentId))}
                onCheckedChange={(checked) => {
                  setSelected((prev) => {
                    const next = new Set(prev)
                    for (const r of g.rows) {
                      if (checked === true) next.add(r.studentId)
                      else next.delete(r.studentId)
                    }
                    return next
                  })
                }}
              />
              {CYCLE_LABEL[g.cycle]} · {g.rows.length}
            </div>
            <ul>
              {g.rows.map((row) => (
                <RenewalRow
                  key={row.studentId}
                  row={row}
                  photoUrl={row.photoUrl ? photoUrls?.[row.photoUrl] : undefined}
                  checked={selected.has(row.studentId)}
                  onCheckedChange={(checked) => {
                    setSelected((prev) => {
                      const next = new Set(prev)
                      if (checked) next.add(row.studentId)
                      else next.delete(row.studentId)
                      return next
                    })
                  }}
                  onRemind={() => {
                    remind([row.studentId])
                  }}
                  sending={send.isPending}
                />
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  )
}

function RenewalRow({
  row,
  photoUrl,
  checked,
  onCheckedChange,
  onRemind,
  sending,
}: {
  row: RenewalDueRow
  photoUrl: string | undefined
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  onRemind: () => void
  sending: boolean
}) {
  const lapsed = row.termStatus === 'expired'
  return (
    <li className="flex flex-wrap items-center gap-3 border-b px-5 py-3 last:border-b-0">
      <Checkbox
        aria-label={`Select ${row.fullName}`}
        checked={checked}
        onCheckedChange={(v) => {
          onCheckedChange(v === true)
        }}
      />
      <PersonAvatar name={row.fullName} photoUrl={photoUrl} className="h-9 w-9 shrink-0" />
      <div className="min-w-[160px] flex-1">
        <Link to={`/admin/students/${row.studentId}`} className="font-bold hover:underline">
          {row.fullName}
        </Link>
        <div className="text-xs text-muted-foreground">
          {row.batchNames ?? 'No batch'}
          {row.pricingMode === 'per_class' && row.rate != null && ` · ₹${row.rate}/class`}
          {row.lastRemindedAt && ` · reminded ${daysAgo(row.lastRemindedAt)}`}
        </div>
      </div>
      <div className="min-w-[150px]">
        <StatusBadge tone={lapsed ? 'danger' : 'warning'}>
          {lapsed
            ? `Ended ${row.termEnd ? formatDate(row.termEnd) : ''}`
            : `Ends ${row.termEnd ? formatDate(row.termEnd) : ''}`}
        </StatusBadge>
        <div className={cn('mt-1 text-xs', lapsed ? 'text-brand-400' : 'text-muted-foreground')}>
          {row.available != null && row.available > 0
            ? `${row.available} unused class${row.available === 1 ? '' : 'es'}${lapsed ? ' expiring' : ' at risk'}`
            : 'No classes left'}
        </div>
      </div>
      <div className="min-w-[140px] text-xs">
        <div className="font-semibold">{row.parentName ?? '—'}</div>
        <div className="font-mono text-muted-foreground">{row.parentPhone ?? '—'}</div>
      </div>
      <Button variant="outline" size="sm" disabled={sending} onClick={onRemind}>
        Remind
      </Button>
    </li>
  )
}
