import { ArrowLeft, CalendarCheck, Check, Inbox, X } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'

import { formatDate, formatTime, todayIso } from '@/shared/lib/format'
import { useSignedPhotoUrls } from '@/shared/lib/signedPhotoUrls'
import { cn } from '@/shared/lib/utils'
import { Button } from '@/shared/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog'
import { EmptyState } from '@/shared/ui/EmptyState'
import { PersonAvatar } from '@/shared/ui/PersonAvatar'
import { Skeleton } from '@/shared/ui/skeleton'
import { StatusBadge } from '@/shared/ui/StatusBadge'
import { Textarea } from '@/shared/ui/textarea'

import {
  useApproveBooking,
  useApproveSessionBookings,
  useBookingRequests,
  useRejectBooking,
  type BookingRequest,
  type RequestScope,
} from '../api/bookingRequests'
import {
  bookingStatusLabel,
  bookingStatusTone,
  groupRequestsBySession,
} from '../hooks/bookingStatus'

interface Props {
  /** Where the page lives — decides the back link and skater links. */
  variant: 'coach' | 'admin'
}

const SCOPES: { value: RequestScope; label: string }[] = [
  { value: 'pending', label: 'Waiting' },
  { value: 'decided', label: 'Decided' },
]

/** The approvals queue. Every request a parent makes lands here for the
 * batch coach (or an admin) to confirm or decline; a request holds one of
 * the skater's credits until it is decided. */
export function BookingRequestsPage({ variant }: Props) {
  const [scope, setScope] = useState<RequestScope>('pending')
  const { data, isLoading, isError, refetch } = useBookingRequests(scope)
  const { data: photoUrls } = useSignedPhotoUrls(
    'student-photos',
    (data ?? []).map((b) => b.photoUrl),
  )
  const approve = useApproveBooking()
  const reject = useRejectBooking()
  const approveAll = useApproveSessionBookings()
  const [declining, setDeclining] = useState<BookingRequest | null>(null)
  const today = todayIso()

  const groups = groupRequestsBySession(data ?? [])
  const waiting = scope === 'pending' ? (data?.length ?? 0) : null

  function onApprove(b: BookingRequest) {
    approve.mutate(b.bookingId, {
      onSuccess: () => toast.success(`${b.fullName} confirmed for ${formatDate(b.sessionDate)}.`),
      onError: (e) => toast.error(e instanceof Error ? e.message : 'Could not approve.'),
    })
  }

  return (
    <div className="space-y-5">
      <div>
        {variant === 'admin' && (
          <Link
            to="/admin/schedule"
            className="mb-2 inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Schedule
          </Link>
        )}
        <h1 className="font-display text-2xl font-extrabold tracking-tight">Bookings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {variant === 'coach'
            ? 'Requests from families in your batches. Confirm who is coming, or decline with a reason.'
            : 'Every booking request in the academy. Confirm or decline; the batch coach can too.'}
          {waiting !== null && !isLoading && ` · ${waiting} waiting`}
        </p>
      </div>

      <div className="flex gap-2">
        {SCOPES.map((s) => (
          <button
            key={s.value}
            type="button"
            onClick={() => {
              setScope(s.value)
            }}
            className={cn(
              'rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-colors',
              scope === s.value
                ? 'border-primary bg-primary/15 text-primary'
                : 'border-border text-muted-foreground hover:text-foreground',
            )}
          >
            {s.label}
          </button>
        ))}
      </div>

      {isError ? (
        <EmptyState
          tone="error"
          title="Couldn't load requests"
          description="Check your connection and try again."
          action={
            <Button
              variant="outline"
              onClick={() => {
                void refetch()
              }}
            >
              Try again
            </Button>
          }
        />
      ) : isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-lg" />
          ))}
        </div>
      ) : groups.length === 0 ? (
        <EmptyState
          icon={scope === 'pending' ? Inbox : CalendarCheck}
          title={scope === 'pending' ? 'Nothing waiting' : 'No decisions yet'}
          description={
            scope === 'pending'
              ? 'New requests from parents will appear here the moment they book.'
              : 'Approved and declined requests from the last week onward show up here.'
          }
        />
      ) : (
        <div className="space-y-4">
          {groups.map((g) => {
            const pendingHere = g.requests.filter((r) => r.status === 'pending')
            return (
              <section
                key={g.sessionId}
                className="overflow-hidden rounded-lg border bg-card shadow-sm"
              >
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b px-4 py-3">
                  <div className="min-w-0">
                    <div className="font-bold">
                      {g.sessionDate === today ? 'Today' : formatDate(g.sessionDate)}
                      <span className="text-muted-foreground"> · </span>
                      {formatTime(g.startTime)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {g.batchName}
                      {g.venue && ` · ${g.venue}`}
                      {variant === 'admin' && g.coachName && ` · Coach ${g.coachName}`}
                    </div>
                  </div>
                  {pendingHere.length > 1 && (
                    <Button
                      size="sm"
                      className="ml-auto"
                      disabled={approveAll.isPending}
                      onClick={() => {
                        approveAll.mutate(g.sessionId, {
                          onSuccess: (n) =>
                            toast.success(`${n} request${n === 1 ? '' : 's'} confirmed.`),
                          onError: (e) =>
                            toast.error(e instanceof Error ? e.message : 'Could not approve.'),
                        })
                      }}
                    >
                      <Check className="mr-1 h-4 w-4" /> Approve all {pendingHere.length}
                    </Button>
                  )}
                </div>
                <ul className="divide-y">
                  {g.requests.map((b) => (
                    <li key={b.bookingId} className="flex items-center gap-3 px-4 py-3">
                      <PersonAvatar
                        name={b.fullName}
                        photoUrl={b.photoUrl ? photoUrls?.[b.photoUrl] : undefined}
                        className="h-9 w-9"
                        fallbackClassName="bg-secondary text-xs"
                      />
                      <div className="min-w-0 flex-1">
                        {variant === 'admin' ? (
                          <Link
                            to={`/admin/students/${b.studentId}`}
                            className="block truncate font-bold hover:underline"
                          >
                            {b.fullName}
                          </Link>
                        ) : (
                          <div className="truncate font-bold">{b.fullName}</div>
                        )}
                        <div className="truncate text-xs text-muted-foreground">
                          {b.status === 'pending'
                            ? `Requested ${relativeTime(b.requestedAt)}`
                            : `${bookingStatusLabel(b.status)} ${relativeTime(b.decidedAt ?? b.requestedAt)}${
                                b.decidedBy ? ` by ${b.decidedBy}` : ''
                              }`}
                          {b.creditsLeft !== null &&
                            ` · ${b.creditsLeft} credit${b.creditsLeft === 1 ? '' : 's'} left`}
                          {b.decisionNote && ` · "${b.decisionNote}"`}
                        </div>
                      </div>
                      {b.status === 'pending' ? (
                        <div className="flex shrink-0 gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            aria-label={`Decline ${b.fullName}`}
                            disabled={approve.isPending || reject.isPending}
                            onClick={() => {
                              setDeclining(b)
                            }}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            aria-label={`Approve ${b.fullName}`}
                            disabled={approve.isPending || reject.isPending}
                            onClick={() => {
                              onApprove(b)
                            }}
                          >
                            <Check className="mr-1 h-4 w-4" /> Approve
                          </Button>
                        </div>
                      ) : (
                        <div className="flex shrink-0 items-center gap-2">
                          <StatusBadge tone={bookingStatusTone(b.status)}>
                            {bookingStatusLabel(b.status)}
                          </StatusBadge>
                          {b.status === 'booked' && b.sessionDate >= today && (
                            <button
                              type="button"
                              onClick={() => {
                                setDeclining(b)
                              }}
                              className="text-[11px] font-bold text-muted-foreground underline-offset-2 hover:underline"
                            >
                              Decline
                            </button>
                          )}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            )
          })}
        </div>
      )}

      <DeclineDialog
        request={declining}
        pending={reject.isPending}
        onClose={() => {
          setDeclining(null)
        }}
        onConfirm={(note) => {
          if (!declining) return
          reject.mutate(
            { bookingId: declining.bookingId, note },
            {
              onSuccess: () => {
                toast.success(
                  `${declining.fullName}'s request declined — the credit is back with them.`,
                )
                setDeclining(null)
              },
              onError: (e) => toast.error(e instanceof Error ? e.message : 'Could not decline.'),
            },
          )
        }}
      />
    </div>
  )
}

function DeclineDialog({
  request,
  pending,
  onClose,
  onConfirm,
}: {
  request: BookingRequest | null
  pending: boolean
  onClose: () => void
  onConfirm: (note: string | null) => void
}) {
  const [note, setNote] = useState('')
  return (
    <Dialog
      open={request !== null}
      onOpenChange={(open) => {
        if (!open) {
          setNote('')
          onClose()
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Decline {request?.fullName}?</DialogTitle>
          <DialogDescription>
            {request &&
              `${formatDate(request.sessionDate)} · ${formatTime(request.startTime)} · ${request.batchName}. `}
            The family is told straight away and the class credit goes back to them. A short reason
            helps.
          </DialogDescription>
        </DialogHeader>
        <Textarea
          value={note}
          onChange={(e) => {
            setNote(e.target.value)
          }}
          placeholder="Class is full, rink closed, please pick another day…"
          rows={3}
        />
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={pending}>
            Keep it
          </Button>
          <Button
            variant="destructive"
            disabled={pending}
            onClick={() => {
              onConfirm(note.trim() === '' ? null : note.trim())
            }}
          >
            Decline request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function relativeTime(iso: string) {
  const diffMin = Math.round((Date.now() - new Date(iso).getTime()) / 60_000)
  if (diffMin < 1) return 'just now'
  if (diffMin < 60) return `${diffMin} min ago`
  const h = Math.round(diffMin / 60)
  if (h < 24) return `${h} hr${h === 1 ? '' : 's'} ago`
  const d = Math.round(h / 24)
  return d === 1 ? 'yesterday' : `${d} days ago`
}
