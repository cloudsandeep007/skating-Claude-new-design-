import { CalendarX2, ChevronDown, Clock3 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import {
  bookingStatusLabel,
  bookingStatusTone,
  countBookings,
  useBookClassSlot,
  useCancelClassSlot,
  useClassCreditBalance,
  useClassCreditSummary,
  useCreditPlanStatus,
  useStudentBookings,
  type StudentBooking,
} from '@/features/schedule'
import { addDays, formatDate, formatTime, todayIso } from '@/shared/lib/format'
import { cn } from '@/shared/lib/utils'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/shared/ui/alert-dialog'
import { Button } from '@/shared/ui/button'
import { EmptyState } from '@/shared/ui/EmptyState'
import { Skeleton } from '@/shared/ui/skeleton'
import { StatusBadge } from '@/shared/ui/StatusBadge'

import { useChildFeeStatus, useChildUpcomingSessions, type UpcomingSession } from '../api/childData'
import { useCurrentChild } from '../hooks/useSelectedChild'
import { groupByWeek } from '../hooks/weekGroups'
import { ChildSelector } from './ChildSelector'

/** Fallback until the plan status loads; the real window is the academy's
 * `booking_window_days` setting, which book_class_slot() enforces too. */
const DEFAULT_BOOKING_WINDOW_DAYS = 7

type Filter = 'all' | 'mine'

export function ChildSchedulePage() {
  const { child, isLoading: loadingChild } = useCurrentChild()
  const { data: sessions, isLoading } = useChildUpcomingSessions(child?.id ?? null, 40)
  const { data: balance } = useClassCreditBalance(child?.id ?? null)
  const { data: summary } = useClassCreditSummary(child?.id ?? null)
  const { data: bookings } = useStudentBookings(child?.id ?? null)
  const { data: feeStatus } = useChildFeeStatus(child?.id ?? null)
  const { data: plan } = useCreditPlanStatus(child?.id ?? null)
  const bookSlot = useBookClassSlot()
  const cancelSlot = useCancelClassSlot()
  const [filter, setFilter] = useState<Filter>('all')
  const [showLater, setShowLater] = useState(false)
  // A confirmed place is worth a second look before giving it up; a request
  // that is still waiting is withdrawn in one tap.
  const [confirmCancel, setConfirmCancel] = useState<UpcomingSession | null>(null)
  const today = todayIso()
  const windowDays = plan?.bookingWindowDays ?? DEFAULT_BOOKING_WINDOW_DAYS
  const bookableUntil = addDays(today, windowDays)

  if (loadingChild) return <Skeleton className="h-40 w-full rounded-lg" />
  if (!child) return <EmptyState title="No skater linked to your account" />

  const onBookingPlan = balance !== null && balance !== undefined
  const perClass = plan?.pricingMode === 'per_class'
  const lapsed = plan?.termStatus === 'expired'
  const owes = onBookingPlan && balance < 0
  const unpaidBlocksBooking =
    onBookingPlan &&
    !perClass &&
    balance <= 0 &&
    (feeStatus?.status === 'pending' || feeStatus?.status === 'overdue')
  const canBook = onBookingPlan && balance > 0 && !lapsed

  const counts = countBookings(
    (sessions ?? [])
      .map((s) => bookings?.get(s.id)?.status)
      .filter((s): s is StudentBooking['status'] => s !== undefined),
  )

  const visible = (sessions ?? []).filter((s) => filter === 'all' || bookings?.has(s.id))
  const weeks = groupByWeek(visible, today)
  const soon = weeks.filter((w) => w.index <= 1)
  const later = weeks.filter((w) => w.index > 1)
  const laterCount = later.reduce((n, w) => n + w.items.length, 0)

  const book = (s: UpcomingSession) => {
    bookSlot.mutate(
      { sessionId: s.id, studentId: child.id },
      {
        onSuccess: () =>
          toast.success(`Requested ${formatDate(s.sessionDate)} — the coach will confirm shortly.`),
        onError: (error) =>
          toast.error(error instanceof Error ? error.message : 'Could not book this class.'),
      },
    )
  }
  const cancel = (s: UpcomingSession) => {
    cancelSlot.mutate(
      { sessionId: s.id, studentId: child.id },
      {
        onSuccess: () =>
          toast.success(
            `${formatDate(s.sessionDate)} cancelled — the class is back in your balance.`,
          ),
        onError: (error) =>
          toast.error(error instanceof Error ? error.message : 'Could not cancel this booking.'),
      },
    )
  }

  return (
    <div className="space-y-4">
      <ChildSelector subtitle="Schedule" />

      {onBookingPlan && (
        <CreditsCard
          balance={balance}
          owes={owes}
          lapsed={lapsed}
          perClass={perClass}
          unpaid={unpaidBlocksBooking}
          termEnd={plan?.termEnd ?? null}
          daysLeft={plan?.daysLeft ?? null}
          termStatus={plan?.termStatus ?? 'none'}
          billingCycle={plan?.billingCycle ?? null}
          windowDays={windowDays}
          counts={counts}
          breakdown={
            summary
              ? { bought: summary.granted, attended: summary.attended, booked: summary.reserved }
              : null
          }
        />
      )}

      {onBookingPlan && (
        <div className="flex gap-2">
          {(
            [
              ['all', 'All classes'],
              [
                'mine',
                `My bookings${counts.pending + counts.booked > 0 ? ` (${counts.pending + counts.booked})` : ''}`,
              ],
            ] as [Filter, string][]
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => {
                setFilter(value)
              }}
              className={cn(
                'rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-colors',
                filter === value
                  ? 'border-primary bg-primary/15 text-primary'
                  : 'border-border text-muted-foreground',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {isLoading ? (
        <Skeleton className="h-40 w-full rounded-lg" />
      ) : weeks.length === 0 ? (
        <EmptyState
          icon={CalendarX2}
          title={filter === 'mine' ? 'No bookings yet' : 'Nothing scheduled yet'}
          description={
            filter === 'mine'
              ? 'Classes you book show up here with their status.'
              : 'The academy publishes the schedule a few weeks at a time.'
          }
        />
      ) : (
        <div className="space-y-5">
          {soon.map((w) => (
            <WeekSection key={w.monday} label={w.label}>
              {w.items.map((s) => (
                <SessionRow
                  key={s.id}
                  session={s}
                  booking={bookings?.get(s.id) ?? null}
                  today={today}
                  bookableUntil={bookableUntil}
                  canBook={canBook}
                  onBookingPlan={onBookingPlan}
                  unpaid={unpaidBlocksBooking}
                  perClass={perClass}
                  busy={bookSlot.isPending || cancelSlot.isPending}
                  onBook={() => {
                    book(s)
                  }}
                  onCancel={() => {
                    if (bookings?.get(s.id)?.status === 'booked') setConfirmCancel(s)
                    else cancel(s)
                  }}
                />
              ))}
            </WeekSection>
          ))}

          {later.length > 0 && !showLater && (
            <button
              type="button"
              onClick={() => {
                setShowLater(true)
              }}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed py-3 text-sm font-semibold text-muted-foreground hover:text-foreground"
            >
              <ChevronDown className="h-4 w-4" />
              Show {laterCount} later class{laterCount === 1 ? '' : 'es'}
            </button>
          )}
          {showLater &&
            later.map((w) => (
              <WeekSection key={w.monday} label={w.label}>
                {w.items.map((s) => (
                  <SessionRow
                    key={s.id}
                    session={s}
                    booking={bookings?.get(s.id) ?? null}
                    today={today}
                    bookableUntil={bookableUntil}
                    canBook={canBook}
                    onBookingPlan={onBookingPlan}
                    unpaid={unpaidBlocksBooking}
                    perClass={perClass}
                    busy={bookSlot.isPending || cancelSlot.isPending}
                    onBook={() => {
                      book(s)
                    }}
                    onCancel={() => {
                      if (bookings?.get(s.id)?.status === 'booked') setConfirmCancel(s)
                      else cancel(s)
                    }}
                  />
                ))}
              </WeekSection>
            ))}
        </div>
      )}

      <AlertDialog
        open={confirmCancel !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmCancel(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Cancel {confirmCancel ? formatDate(confirmCancel.sessionDate) : 'this class'}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              The class credit comes straight back to you. You can book again later, but the coach
              will need to confirm it again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmCancel) cancel(confirmCancel)
                setConfirmCancel(null)
              }}
            >
              Cancel class
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function WeekSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
        {label}
      </h2>
      <ul className="space-y-2">{children}</ul>
    </section>
  )
}

function CreditsCard({
  balance,
  owes,
  lapsed,
  perClass,
  unpaid,
  termEnd,
  daysLeft,
  termStatus,
  billingCycle,
  windowDays,
  counts,
  breakdown,
}: {
  balance: number
  owes: boolean
  lapsed: boolean
  perClass: boolean
  unpaid: boolean
  termEnd: string | null
  daysLeft: number | null
  termStatus: 'none' | 'active' | 'expiring' | 'expired'
  billingCycle: string | null
  windowDays: number
  counts: { pending: number; booked: number; rejected: number }
  breakdown: { bought: number; attended: number; booked: number } | null
}) {
  const note =
    lapsed && termEnd
      ? `Your ${billingCycle ?? ''} plan ended on ${formatDate(termEnd)}. Top up at the academy to renew it and start booking again.`
      : owes
        ? `${-balance} class${balance === -1 ? '' : 'es'} attended without credits — top up at the academy to clear it and book again.`
        : perClass && balance === 0
          ? 'No classes left — top up at the academy to keep booking.'
          : unpaid
            ? "Pay this period's fee to unlock these classes — credits are granted once the fee is paid."
            : `Book up to ${windowDays} days ahead. The coach confirms each request; a class you don't attend is returned to you.`

  return (
    <div className="rounded-lg border border-primary/20 bg-card p-4 text-foreground shadow-[0_0_30px_-10px_hsl(var(--primary)/0.3)]">
      <div className="flex items-start gap-4">
        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Class credits
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span
              className={cn(
                'font-display text-3xl font-extrabold tracking-tight',
                owes ? 'text-brand-400' : 'text-primary',
              )}
            >
              {Math.abs(balance)}
            </span>
            <span className="text-sm font-semibold text-muted-foreground">
              {owes
                ? `class${balance === -1 ? '' : 'es'} owed`
                : `class${balance === 1 ? '' : 'es'} left`}
            </span>
          </div>
        </div>
        {termEnd && (
          <div
            className={cn(
              'shrink-0 rounded-md border px-3 py-2 text-right',
              termStatus === 'expired'
                ? 'border-brand-500/40 bg-brand-500/10'
                : termStatus === 'expiring'
                  ? 'border-warning-500/40 bg-warning-500/10'
                  : 'border-border bg-background',
            )}
          >
            <div className="flex items-center justify-end gap-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
              <Clock3 className="h-3 w-3" />
              {termStatus === 'expired' ? 'Expired' : 'Credits expire'}
            </div>
            <div
              className={cn(
                'text-sm font-extrabold',
                termStatus === 'expired'
                  ? 'text-brand-400'
                  : termStatus === 'expiring'
                    ? 'text-warning-300'
                    : 'text-foreground',
              )}
            >
              {formatDate(termEnd)}
            </div>
            {daysLeft !== null && daysLeft >= 0 && (
              <div className="text-[11px] text-muted-foreground">
                {daysLeft === 0 ? 'today' : `${daysLeft} day${daysLeft === 1 ? '' : 's'} left`}
              </div>
            )}
          </div>
        )}
      </div>
      {breakdown && breakdown.bought > 0 && (
        <p className="mt-2 text-xs font-semibold text-muted-foreground">
          {breakdown.bought} bought · {breakdown.attended} attended · {breakdown.booked} booked
          ahead · {Math.max(balance, 0)} free to book
        </p>
      )}
      <p className="mt-2 text-xs text-muted-foreground">{note}</p>
      {(counts.pending > 0 || counts.booked > 0 || counts.rejected > 0) && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {counts.booked > 0 && <StatusBadge tone="success">{counts.booked} confirmed</StatusBadge>}
          {counts.pending > 0 && (
            <StatusBadge tone="warning">{counts.pending} awaiting approval</StatusBadge>
          )}
          {counts.rejected > 0 && (
            <StatusBadge tone="danger">{counts.rejected} declined</StatusBadge>
          )}
        </div>
      )}
    </div>
  )
}

function SessionRow({
  session: s,
  booking,
  today,
  bookableUntil,
  canBook,
  onBookingPlan,
  unpaid,
  perClass,
  busy,
  onBook,
  onCancel,
}: {
  session: UpcomingSession
  booking: StudentBooking | null
  today: string
  bookableUntil: string
  canBook: boolean
  onBookingPlan: boolean
  unpaid: boolean
  perClass: boolean
  busy: boolean
  onBook: () => void
  onCancel: () => void
}) {
  const cancelled = s.status === 'cancelled'
  const done = s.status === 'completed'
  const isToday = s.sessionDate === today
  const inWindow = s.sessionDate <= bookableUntil
  const status = booking?.status ?? null

  return (
    <li
      className={cn(
        'rounded-lg border bg-card px-4 py-3 shadow-sm',
        cancelled && 'opacity-70',
        isToday && !cancelled && 'border-primary/40',
        status === 'booked' && 'border-l-4 border-l-success-500',
        status === 'pending' && 'border-l-4 border-l-warning-500',
      )}
    >
      <div className="flex items-center gap-3">
        <div className="w-20 shrink-0">
          <div className={cn('text-sm font-bold', isToday && 'text-primary')}>
            {isToday ? 'Today' : formatDate(s.sessionDate)}
          </div>
          <div className="text-xs text-muted-foreground">{formatTime(s.startTime)}</div>
        </div>
        <div className="min-w-0 flex-1">
          <div className={cn('font-bold', cancelled && 'line-through')}>{s.batchName}</div>
          <div className="truncate text-xs text-muted-foreground">
            {cancelled
              ? `Cancelled — ${s.cancellationReason}`
              : [s.venue, s.coachName && `Coach ${s.coachName}`].filter(Boolean).join(' · ')}
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {cancelled ? (
            <StatusBadge tone="danger">Cancelled</StatusBadge>
          ) : !onBookingPlan ? null : status === 'booked' || status === 'pending' ? (
            <>
              <StatusBadge tone={bookingStatusTone(status)}>
                {status === 'pending' ? 'Awaiting approval' : bookingStatusLabel(status)}
              </StatusBadge>
              {!done && (
                <button
                  type="button"
                  onClick={onCancel}
                  disabled={busy}
                  className="text-[11px] font-bold text-muted-foreground underline-offset-2 hover:underline disabled:opacity-50"
                >
                  {status === 'pending' ? 'Withdraw' : 'Cancel'}
                </button>
              )}
            </>
          ) : done ? (
            <span className="text-xs text-muted-foreground">Class over</span>
          ) : status === 'rejected' ? (
            <>
              <StatusBadge tone="danger">Declined</StatusBadge>
              {inWindow && canBook && (
                <button
                  type="button"
                  onClick={onBook}
                  disabled={busy}
                  className="text-[11px] font-bold text-muted-foreground underline-offset-2 hover:underline disabled:opacity-50"
                >
                  Ask again
                </button>
              )}
            </>
          ) : inWindow ? (
            <Button size="sm" variant="outline" disabled={busy || !canBook} onClick={onBook}>
              {canBook ? 'Book' : unpaid ? 'Pay first' : perClass ? 'Top up first' : 'No credits'}
            </Button>
          ) : (
            <span className="text-[11px] text-muted-foreground">
              Opens {formatDate(addDays(s.sessionDate, -bookableUntilDays(today, bookableUntil)))}
            </span>
          )}
        </div>
      </div>
      {status === 'rejected' && booking?.decisionNote && (
        <div className="mt-2 rounded-md bg-brand-500/10 px-3 py-1.5 text-xs text-brand-300">
          Coach: “{booking.decisionNote}”
        </div>
      )}
    </li>
  )
}

function bookableUntilDays(today: string, bookableUntil: string) {
  return Math.round(
    (new Date(`${bookableUntil}T00:00:00`).getTime() - new Date(`${today}T00:00:00`).getTime()) /
      86_400_000,
  )
}
