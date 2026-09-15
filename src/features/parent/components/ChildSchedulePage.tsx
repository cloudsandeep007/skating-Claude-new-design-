import { CalendarX2 } from 'lucide-react'
import { toast } from 'sonner'

import {
  useBookClassSlot,
  useCancelClassSlot,
  useClassCreditBalance,
  useCreditPlanStatus,
  useStudentBookedSessionIds,
} from '@/features/schedule'
import { addDays, formatDate, formatTime, todayIso } from '@/shared/lib/format'
import { cn } from '@/shared/lib/utils'
import { Button } from '@/shared/ui/button'
import { EmptyState } from '@/shared/ui/EmptyState'
import { Skeleton } from '@/shared/ui/skeleton'
import { StatusBadge } from '@/shared/ui/StatusBadge'

import { useChildFeeStatus, useChildUpcomingSessions } from '../api/childData'
import { useCurrentChild } from '../hooks/useSelectedChild'
import { ChildSelector } from './ChildSelector'

/** A session is bookable through this page within the coming week —
 * matches the "book a week ahead" workflow without a hard server-side
 * lead-time rule. */
const BOOKING_WINDOW_DAYS = 7

export function ChildSchedulePage() {
  const { child, isLoading: loadingChild } = useCurrentChild()
  const { data: sessions, isLoading } = useChildUpcomingSessions(child?.id ?? null, 30)
  const { data: balance } = useClassCreditBalance(child?.id ?? null)
  const { data: bookedIds } = useStudentBookedSessionIds(child?.id ?? null)
  const { data: feeStatus } = useChildFeeStatus(child?.id ?? null)
  const { data: plan } = useCreditPlanStatus(child?.id ?? null)
  const bookSlot = useBookClassSlot()
  const cancelSlot = useCancelClassSlot()
  const today = todayIso()
  const bookableUntil = addDays(today, BOOKING_WINDOW_DAYS)

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
  const creditsNote = !onBookingPlan
    ? ''
    : lapsed && plan.termEnd
      ? `Your ${plan.billingCycle} plan ended on ${formatDate(plan.termEnd)}. Top up at the academy to renew it and start booking again.`
      : owes
        ? `${-balance} class${balance === -1 ? '' : 'es'} attended without credits — top up at the academy to clear it and book again.`
        : perClass && balance === 0
          ? 'No classes left — top up at the academy to keep booking.'
          : unpaidBlocksBooking
            ? "Pay this period's fee to unlock these classes — credits are granted once the fee is paid."
            : plan?.termEnd
              ? `Valid till ${formatDate(plan.termEnd)}${
                  plan.termStatus === 'expiring' ? ' — renew before then to carry unused classes forward' : ''
                }. Book which of the coming week's classes you'll attend below; a class you don't attend is returned to you.`
              : "Book which of the coming week's classes you'll attend below; a class you don't attend is returned to you."

  return (
    <div className="space-y-4">
      <ChildSelector subtitle="Upcoming sessions" />

      {onBookingPlan && (
        <div className="rounded-lg border border-primary/20 bg-card p-4 text-foreground shadow-[0_0_30px_-10px_hsl(var(--primary)/0.3)]">
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
              {owes ? `class${balance === -1 ? '' : 'es'} owed` : `class${balance === 1 ? '' : 'es'} left to book`}
            </span>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">{creditsNote}</p>
        </div>
      )}

      {isLoading ? (
        <Skeleton className="h-40 w-full rounded-lg" />
      ) : !sessions || sessions.length === 0 ? (
        <EmptyState
          icon={CalendarX2}
          title="Nothing scheduled yet"
          description="The academy publishes the schedule a few weeks at a time."
        />
      ) : (
        <ul className="space-y-2">
          {sessions.map((s) => {
            const cancelled = s.status === 'cancelled'
            const isToday = s.sessionDate === today
            return (
              <li
                key={s.id}
                className={cn(
                  'flex items-center gap-3 rounded-lg border bg-card px-4 py-3 shadow-sm',
                  cancelled && 'opacity-70',
                  isToday && !cancelled && 'border-primary/40',
                )}
              >
                <div className="w-20 shrink-0">
                  <div className={cn('text-sm font-bold', isToday && 'text-primary')}>
                    {isToday ? 'Today' : formatDate(s.sessionDate)}
                  </div>
                  <div className="text-xs text-muted-foreground">{formatTime(s.startTime)}</div>
                </div>
                <div className="min-w-0 flex-1">
                  <div className={cn('font-bold', cancelled && 'line-through')}>{s.batchName}</div>
                  <div className="text-xs text-muted-foreground">
                    {cancelled
                      ? `Cancelled — ${s.cancellationReason}`
                      : [s.venue, s.coachName && `Coach ${s.coachName}`]
                          .filter(Boolean)
                          .join(' · ')}
                  </div>
                </div>
                {cancelled && <StatusBadge tone="danger">Cancelled</StatusBadge>}
                {onBookingPlan &&
                  !cancelled &&
                  s.status !== 'completed' &&
                  (s.sessionDate <= bookableUntil || bookedIds?.has(s.id)) && (
                  <BookingControl
                    booked={bookedIds?.has(s.id) ?? false}
                    canBook={canBook}
                    unpaid={unpaidBlocksBooking}
                    perClass={perClass}
                    onBook={() => {
                      bookSlot.mutate(
                        { sessionId: s.id, studentId: child.id },
                        {
                          onError: (error) => {
                            toast.error(
                              error instanceof Error ? error.message : 'Could not book this class.',
                            )
                          },
                        },
                      )
                    }}
                    onCancel={() => {
                      cancelSlot.mutate({ sessionId: s.id, studentId: child.id }, {
                        onError: (error) => {
                          toast.error(
                            error instanceof Error
                              ? error.message
                              : 'Could not cancel this booking.',
                          )
                        },
                      })
                    }}
                    pending={bookSlot.isPending || cancelSlot.isPending}
                  />
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function BookingControl({
  booked,
  canBook,
  unpaid,
  perClass,
  onBook,
  onCancel,
  pending,
}: {
  booked: boolean
  canBook: boolean
  unpaid: boolean
  perClass: boolean
  onBook: () => void
  onCancel: () => void
  pending: boolean
}) {
  if (booked) {
    return (
      <div className="flex shrink-0 flex-col items-end gap-1">
        <StatusBadge tone="success">Booked</StatusBadge>
        <button
          type="button"
          onClick={onCancel}
          disabled={pending}
          className="text-[11px] font-bold text-muted-foreground underline-offset-2 hover:underline disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    )
  }
  return (
    <Button size="sm" variant="outline" disabled={pending || !canBook} onClick={onBook}>
      {canBook ? 'Book' : unpaid ? 'Pay first' : perClass ? 'Top up first' : 'No credits left'}
    </Button>
  )
}
