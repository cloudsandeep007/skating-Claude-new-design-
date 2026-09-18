import { Ban, Coins, Receipt, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { useCreditPlanStatus } from '@/features/schedule'
import { formatDate } from '@/shared/lib/format'
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
  AlertDialogTrigger,
} from '@/shared/ui/alert-dialog'
import { Button } from '@/shared/ui/button'
import { Checkbox } from '@/shared/ui/checkbox'
import { EmptyState } from '@/shared/ui/EmptyState'
import { Skeleton } from '@/shared/ui/skeleton'
import { StatusBadge } from '@/shared/ui/StatusBadge'

import { useDeleteFee, useStudentAdvance, useStudentFees } from '../api/payments'
import { canWaive, paidTotal, remainingBalance } from '../hooks/feeMath'
import { feeStatusLabel, feeStatusTone, formatRupees } from '../hooks/feeTone'
import { PAYMENT_METHOD_LABEL } from '../types'
import { RecordPaymentDialog, type PaymentTarget } from './RecordPaymentDialog'
import { TopupDialog, type TopupTarget } from './TopupDialog'
import { VoidPaymentDialog, type VoidTarget } from './VoidPaymentDialog'
import { WaiveFeeDialog, type WaiveTarget } from './WaiveFeeDialog'

interface PaymentHistoryListProps {
  studentId: string
  studentName?: string
  /** Admin skater profile passes true to add "Record payment"/"Waive"
   * buttons per fee; the parent screen omits it and stays read-only. */
  canManage?: boolean
}

/** Every fee period for a student with its payments underneath, like a
 * folder of receipts — newest first. Used on the admin skater profile and
 * the parent's fees screen; RLS decides who's allowed to see it. */
export function PaymentHistoryList({
  studentId,
  studentName = '',
  canManage = false,
}: PaymentHistoryListProps) {
  const { data: fees, isLoading, isError, refetch } = useStudentFees(studentId)
  const [payTarget, setPayTarget] = useState<PaymentTarget | null>(null)
  const [waiveTarget, setWaiveTarget] = useState<WaiveTarget | null>(null)
  const [voidTarget, setVoidTarget] = useState<VoidTarget | null>(null)
  const [topupTarget, setTopupTarget] = useState<TopupTarget | null>(null)
  const [deleteCancelsBookings, setDeleteCancelsBookings] = useState(false)
  const deleteFee = useDeleteFee()
  const { data: plan } = useCreditPlanStatus(canManage ? studentId : null)
  const canTopup = canManage && plan?.pricingMode === 'per_class'
  const { data: advance } = useStudentAdvance(studentId)
  const advanceBanner =
    advance && advance.balance > 0 ? (
      <div className="rounded-lg border border-success-600/40 bg-success-500/10 px-3.5 py-2.5 text-sm">
        <span className="font-bold">{formatRupees(advance.balance)} paid in advance</span>
        <span className="text-muted-foreground">
          {' '}
          — applied automatically to the next fee.
          {advance.entries[0]?.reason && ` ${advance.entries[0].reason}.`}
        </span>
      </div>
    ) : null

  if (isError) {
    return (
      <EmptyState
        tone="error"
        title="Couldn't load fee history"
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

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full rounded-lg" />
        ))}
      </div>
    )
  }

  const topupButton = canTopup ? (
    <Button
      size="sm"
      onClick={() => {
        setTopupTarget({ studentId, studentName })
      }}
    >
      <Coins className="h-4 w-4" />
      Top up classes
    </Button>
  ) : null

  if (!fees || fees.length === 0) {
    return (
      <div className="space-y-3">
        {topupButton && <div className="flex justify-end">{topupButton}</div>}
        {advanceBanner}
        <EmptyState
          title={canTopup ? 'No top-ups yet' : 'No fees yet'}
          description={
            canTopup
              ? "Record the first top-up to start this skater's plan."
              : 'Fees show up here once a plan is assigned and generated.'
          }
        />
        <TopupDialog
          target={topupTarget}
          onClose={() => {
            setTopupTarget(null)
          }}
        />
      </div>
    )
  }

  return (
    <ul className="space-y-3">
      {topupButton && (
        <li className="flex justify-end">{topupButton}</li>
      )}
      {advanceBanner && <li>{advanceBanner}</li>}
      {fees.map((fee) => {
        const paid = paidTotal(fee.payments)
        const balance = remainingBalance(fee.amount, paid)
        return (
          <li key={fee.id} className="rounded-lg border bg-card p-3.5 shadow-sm">
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="min-w-0 flex-1">
                <div className="font-bold">
                  {fee.kind === 'topup'
                    ? fee.amount === 0 && paid === 0
                      ? 'Top-up · voided'
                      : `Top-up · ${fee.creditsGranted ?? 0} class${fee.creditsGranted === 1 ? '' : 'es'}`
                    : `${formatDate(fee.periodStart)} – ${formatDate(fee.periodEnd)}`}
                </div>
                <div className="text-xs text-muted-foreground">
                  {fee.kind === 'topup'
                    ? `${fee.feePlanName ?? 'Pay per class'} · valid ${formatDate(fee.periodStart)} – ${formatDate(fee.periodEnd)}`
                    : `${fee.feePlanName ?? 'Fee'} · due ${formatDate(fee.dueDate)}`}
                </div>
              </div>
              <StatusBadge tone={feeStatusTone(fee.status)}>
                {feeStatusLabel(fee.status)}
              </StatusBadge>
              <div className="text-right">
                <div className="font-extrabold tracking-tight">{formatRupees(fee.amount)}</div>
                {balance > 0 && fee.status !== 'waived' && (
                  <div className="text-xs font-semibold text-brand-400">
                    {formatRupees(balance)} due
                  </div>
                )}
              </div>
            </div>

            {fee.status === 'waived' && fee.waivedReason && (
              <div className="mt-2 rounded-md bg-muted px-2.5 py-1.5 text-xs text-muted-foreground">
                Waived — {fee.waivedReason}
              </div>
            )}

            {canManage && (
              <div className="mt-2 flex flex-wrap items-center gap-2 border-t pt-2.5">
                {balance > 0 && fee.status !== 'waived' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setPayTarget({
                        studentFeeId: fee.id,
                        studentName,
                        amount: fee.amount,
                        paid,
                      })
                    }}
                  >
                    Record payment
                  </Button>
                )}
                {canWaive(fee.status) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setWaiveTarget({ studentFeeId: fee.id, studentName, amount: balance })
                    }}
                  >
                    Waive
                  </Button>
                )}
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="ml-auto text-brand-400 hover:text-brand-300"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete period
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>
                        {fee.payments.length > 0
                          ? "This period can't be deleted yet"
                          : 'Delete this fee period?'}
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        {formatDate(fee.periodStart)} – {formatDate(fee.periodEnd)},{' '}
                        {formatRupees(fee.amount)}.{' '}
                        {fee.payments.length > 0
                          ? `It has payment history (${fee.payments.length} ${fee.payments.length === 1 ? 'entry' : 'entries'}, including any voided). A period with payments on record is kept as history — void a wrong payment instead, and the fee's status and balance recalculate on their own.`
                          : "This can't be undone."}
                      </AlertDialogDescription>
                      {fee.payments.length === 0 &&
                        fee.status === 'waived' &&
                        (fee.creditsGranted ?? 0) > 0 && (
                          <label className="mt-2 flex items-start gap-2 text-sm">
                            <Checkbox
                              checked={deleteCancelsBookings}
                              onCheckedChange={(v) => {
                                setDeleteCancelsBookings(v === true)
                              }}
                            />
                            <span>
                              This period granted {fee.creditsGranted} classes. If the skater has
                              booked with them, cancel their newest upcoming bookings to cover the
                              difference and notify the parent.
                            </span>
                          </label>
                        )}
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>
                        {fee.payments.length > 0 ? 'Got it' : 'Keep it'}
                      </AlertDialogCancel>
                      {fee.payments.length === 0 && (
                        <AlertDialogAction
                          onClick={() => {
                            deleteFee.mutate({ studentFeeId: fee.id, cancelBookings: deleteCancelsBookings }, {
                              onSuccess: () => {
                                toast.success('Fee period deleted.')
                              },
                              onError: (error) => {
                                toast.error(
                                  error instanceof Error
                                    ? error.message
                                    : 'Could not delete this fee period.',
                                )
                              },
                            })
                          }}
                        >
                          Delete period
                        </AlertDialogAction>
                      )}
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            )}

            {fee.payments.length > 0 && (
              <ul className="mt-3 space-y-1.5 border-t pt-3">
                {fee.payments.map((p) => {
                  const voided = p.voidedAt !== null
                  return (
                    <li key={p.id} className="text-sm">
                      <div className="flex items-center gap-2.5">
                        {voided ? (
                          <Ban className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        ) : (
                          <Receipt className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        )}
                        <span
                          className={cn(
                            'font-semibold',
                            voided && 'text-muted-foreground line-through',
                          )}
                        >
                          {formatRupees(p.amount)}
                        </span>
                        <span className={cn('text-muted-foreground', voided && 'line-through')}>
                          {formatDate(p.paidDate)} · {PAYMENT_METHOD_LABEL[p.method]}
                          {p.reference && ` · ${p.reference}`}
                        </span>
                        {p.receiptNo && (
                          <span
                            className={cn(
                              'shrink-0 font-mono text-[11px] text-muted-foreground',
                              voided && 'line-through',
                            )}
                          >
                            {p.receiptNo}
                          </span>
                        )}
                        {p.recordedByName && (
                          <span
                            className={cn(
                              'shrink-0 text-xs text-muted-foreground',
                              (!canManage || voided) && 'ml-auto',
                            )}
                          >
                            by {p.recordedByName}
                          </span>
                        )}
                        {canManage && !voided && (
                          <button
                            type="button"
                            aria-label="Void payment"
                            className="ml-auto shrink-0 text-muted-foreground hover:text-brand-400"
                            onClick={() => {
                              setVoidTarget({
                                paymentId: p.id,
                                amount: p.amount,
                                paidDate: p.paidDate,
                                receiptNo: p.receiptNo,
                                studentId,
                                // Credits only go if the fee drops out of 'paid'.
                                creditsAtRisk:
                                  fee.status === 'paid' && paid - p.amount < fee.amount
                                    ? (fee.creditsGranted ?? 0)
                                    : 0,
                              })
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                      {voided && (
                        <div className="ml-6 text-xs text-muted-foreground">
                          Voided — {p.voidReason}
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </li>
        )
      })}

      {canManage && (
        <>
          <RecordPaymentDialog
            fee={payTarget}
            onClose={() => {
              setPayTarget(null)
            }}
          />
          <WaiveFeeDialog
            fee={waiveTarget}
            onClose={() => {
              setWaiveTarget(null)
            }}
          />
          <VoidPaymentDialog
            payment={voidTarget}
            onClose={() => {
              setVoidTarget(null)
            }}
          />
          <TopupDialog
            target={topupTarget}
            onClose={() => {
              setTopupTarget(null)
            }}
          />
        </>
      )}
    </ul>
  )
}
