import { Phone } from 'lucide-react'
import { Link } from 'react-router-dom'

import { useSignedPhotoUrls } from '@/shared/lib/signedPhotoUrls'
import { cn } from '@/shared/lib/utils'
import { EmptyState } from '@/shared/ui/EmptyState'
import { PersonAvatar } from '@/shared/ui/PersonAvatar'
import { Skeleton } from '@/shared/ui/skeleton'
import { StatusBadge } from '@/shared/ui/StatusBadge'

import { useNeedsAttention } from '../api/needsAttention'
import type { NeedsAttentionRow } from '../types'

/** The dashboard's visual anchor, not a footnote — an ink panel deliberately
 * heavier than the chart cards above it, exactly matching the "Needs
 * attention" treatment in the design handoff. */
export function NeedsAttentionPanel() {
  const { data, isLoading, isError, refetch } = useNeedsAttention()
  const { data: photoUrls } = useSignedPhotoUrls(
    'student-photos',
    (data ?? []).map((r) => r.photoUrl),
  )
  const overdueCount = data?.filter((r) => r.hasOverdueFee).length ?? 0

  if (isError) {
    return (
      <EmptyState
        tone="error"
        title="Couldn't load the attention list"
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
    <div className="overflow-hidden rounded-xl bg-neutral-950 shadow-[0_12px_32px_rgba(45,43,43,.22)]">
      <div className="flex flex-wrap items-center gap-3 bg-brand-600 px-5 py-3.5">
        <span className="text-xl font-extrabold tracking-tight text-white">Needs attention</span>
        {!isLoading && (
          <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-brand-800">
            {data?.length ?? 0} student{data?.length === 1 ? '' : 's'}
          </span>
        )}
        <span className="ml-auto text-sm text-white">Under 60% attendance in the last 30 days</span>
      </div>

      {isLoading ? (
        <div className="space-y-0">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="border-b border-white/10 p-5">
              <Skeleton className="h-5 w-48 bg-white/10" />
            </div>
          ))}
        </div>
      ) : !data || data.length === 0 ? (
        <div className="p-8">
          <EmptyState
            tone="dark"
            title="Everyone's attending well"
            description="No active skater has dropped below 60% attendance in the last 30 days."
          />
        </div>
      ) : (
        <>
          <ul>
            {data.map((row) => (
              <AttentionRow
                key={row.studentId}
                row={row}
                photoUrl={row.photoUrl ? photoUrls?.[row.photoUrl] : undefined}
              />
            ))}
          </ul>
          {overdueCount > 0 && (
            <div className="border-t border-white/10 px-5 py-3.5 text-sm text-neutral-400">
              {overdueCount} of these {data.length} also {overdueCount === 1 ? 'has' : 'have'}{' '}
              overdue fees —{' '}
              <Link to="/admin/fees" className="font-bold text-white underline">
                check the Fees screen
              </Link>{' '}
              before calling.
            </div>
          )}
        </>
      )}
    </div>
  )
}

function AttentionRow({ row, photoUrl }: { row: NeedsAttentionRow; photoUrl: string | undefined }) {
  const pct = row.attendancePct ?? 0
  const pctColor = pct < 40 ? 'text-brand-400' : 'text-warning-300'
  const barColor = pct < 40 ? 'bg-brand-500' : 'bg-warning-300'

  return (
    <li className="flex flex-wrap items-center gap-3.5 border-b border-white/10 px-5 py-3.5 last:border-b-0">
      <PersonAvatar
        name={row.fullName}
        photoUrl={photoUrl}
        className="h-11 w-11 shrink-0"
        fallbackClassName="bg-white/10 text-[15px] font-bold text-white"
      />
      <div className="min-w-[160px] flex-1">
        <Link
          to={`/admin/students/${row.studentId}`}
          className="text-[17px] font-bold leading-tight text-white hover:underline"
        >
          {row.fullName}
        </Link>
        <div className="mt-0.5 text-[13px] text-neutral-400">
          {row.batchNames ?? 'No batch'}
          {row.levelName && ` · ${row.levelName}`} · missed {row.missedSessions}
          {row.hasOverdueFee && (
            <StatusBadge tone="danger" className="ml-2 align-middle">
              Fee overdue
            </StatusBadge>
          )}
        </div>
      </div>
      <div className="w-[170px] flex-none">
        <div className="flex items-baseline gap-2">
          <span className={cn('text-[22px] font-extrabold leading-none', pctColor)}>{pct}%</span>
          <span className="text-xs text-neutral-400">attendance</span>
        </div>
        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/15">
          <div className={cn('h-full rounded-full', barColor)} style={{ width: `${pct}%` }} />
        </div>
      </div>
      <div className="min-w-[150px] flex-none">
        <div className="text-[13px] font-semibold text-white">{row.parentName ?? '—'}</div>
        <div className="font-mono text-[13px] text-neutral-400">{row.parentPhone ?? '—'}</div>
      </div>
      {row.parentPhone && (
        <a
          href={`tel:${row.parentPhone.replace(/\s+/g, '')}`}
          className="flex h-11 shrink-0 items-center gap-2 rounded-lg bg-white px-4 text-[15px] font-bold text-neutral-950 hover:bg-brand-100"
        >
          <Phone className="h-3.5 w-3.5" />
          Call
        </a>
      )}
    </li>
  )
}
