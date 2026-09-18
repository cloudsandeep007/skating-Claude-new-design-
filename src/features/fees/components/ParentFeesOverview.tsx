import { CheckCircle2, ChevronDown, Clock3, Receipt, Wallet } from 'lucide-react'
import { useState } from 'react'

import { useCreditPlanStatus } from '@/features/schedule'
import { formatDate, todayIso } from '@/shared/lib/format'
import { cn } from '@/shared/lib/utils'
import { EmptyState } from '@/shared/ui/EmptyState'
import { Skeleton } from '@/shared/ui/skeleton'
import { StatusBadge } from '@/shared/ui/StatusBadge'

import { useStudentAdvance, useStudentFees } from '../api/payments'
import { paidTotal } from '../hooks/feeMath'
import { feeStatusLabel, feeStatusTone, formatRupees } from '../hooks/feeTone'
import { feeBalance, summarizeParentFees } from '../hooks/parentFeeSummary'
import { PAYMENT_METHOD_LABEL, type PaymentRecord, type StudentFeeWithPayments } from '../types'

/** The parent's fees screen: what is owed now, the current period with its
 * receipts, live top-ups, and everything older tucked away. Read-only —
 * payments are recorded at the academy. */
export function ParentFeesOverview({ studentId }: { studentId: string }) {
  const today = todayIso()
  const { data: fees, isLoading } = useStudentFees(studentId)
  const { data: advance } = useStudentAdvance(studentId)
  const { data: plan } = useCreditPlanStatus(studentId)
  const [showOlder, setShowOlder] = useState(false)

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-28 w-full rounded-lg" />
        <Skeleton className="h-20 w-full rounded-lg" />
        <Skeleton className="h-40 w-full rounded-lg" />
      </div>
    )
  }
  if (!fees || fees.length === 0) {
    return (
      <EmptyState
        icon={Receipt}
        title="No fees yet"
        description="Your first fee appears here once the academy sets up the plan."
      />
    )
  }

  const s = summarizeParentFees(fees, today)
  const advanceBalance = advance?.balance ?? 0

  return (
    <div className="space-y-4">
      {/* What's owed right now — the one thing every parent opens this page for. */}
      <div
        className={cn(
          'rounded-lg border p-4 shadow-sm',
          s.dueNow > 0
            ? s.overdue
              ? 'border-brand-500/40 bg-brand-500/10'
              : 'border-warning-500/40 bg-warning-500/10'
            : 'border-success-500/40 bg-success-500/10',
        )}
      >
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {s.dueNow > 0 ? (
            <Clock3 className="h-3.5 w-3.5" />
          ) : (
            <CheckCircle2 className="h-3.5 w-3.5" />
          )}
          {s.dueNow > 0 ? (s.overdue ? 'Overdue' : 'Due now') : 'All paid up'}
        </div>
        <div
          className={cn(
            'mt-1 font-display text-3xl font-extrabold tracking-tight',
            s.dueNow > 0 ? (s.overdue ? 'text-brand-400' : 'text-warning-300') : 'text-success-400',
          )}
        >
          {s.dueNow > 0 ? formatRupees(s.dueNow) : 'Nothing due'}
        </div>
        <div className="mt-1 text-sm text-muted-foreground">
          {s.dueNow > 0 && s.dueBy
            ? `Pay at the academy by ${formatDate(s.dueBy)}.`
            : 'Nothing to pay right now.'}
          {advanceBalance > 0 && (
            <span className="block">
              <Wallet className="mr-1 inline h-3.5 w-3.5 align-[-2px]" />
              {formatRupees(advanceBalance)} paid in advance — applied to the next fee
              automatically.
            </span>
          )}
        </div>
      </div>

      {/* The plan, and when its classes run out. */}
      {plan?.usesCredits && (
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border bg-card p-3">
            <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
              Classes left
            </div>
            <div className="mt-0.5 text-2xl font-extrabold text-primary">{plan.available ?? 0}</div>
            <div className="text-[11px] text-muted-foreground">
              {plan.pricingMode === 'per_class' ? 'pay per class' : (plan.billingCycle ?? 'plan')}
            </div>
          </div>
          <div
            className={cn(
              'rounded-lg border p-3',
              plan.termStatus === 'expired'
                ? 'border-brand-500/40 bg-brand-500/10'
                : plan.termStatus === 'expiring'
                  ? 'border-warning-500/40 bg-warning-500/10'
                  : 'bg-card',
            )}
          >
            <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
              {plan.termStatus === 'expired' ? 'Expired on' : 'Credits expire'}
            </div>
            <div className="mt-0.5 text-lg font-extrabold">
              {plan.termEnd ? formatDate(plan.termEnd) : '—'}
            </div>
            <div className="text-[11px] text-muted-foreground">
              {plan.termStatus === 'expired'
                ? 'Top up to renew'
                : plan.daysLeft !== null
                  ? `${plan.daysLeft} day${plan.daysLeft === 1 ? '' : 's'} left`
                  : 'No active term'}
            </div>
          </div>
        </div>
      )}

      {s.current && (
        <section>
          <SectionTitle>Current period</SectionTitle>
          <FeeCard fee={s.current} expanded />
        </section>
      )}

      {s.activeTopups.length > 0 && (
        <section>
          <SectionTitle>Top-ups this term</SectionTitle>
          <div className="space-y-2">
            {s.activeTopups.map((f) => (
              <FeeCard key={f.id} fee={f} />
            ))}
          </div>
        </section>
      )}

      {s.lastReceipt && (
        <section>
          <SectionTitle>Last receipt</SectionTitle>
          <div className="rounded-lg border bg-card px-4 py-3">
            <ReceiptRow payment={s.lastReceipt} label={s.lastReceipt.feeLabel} />
          </div>
        </section>
      )}

      {s.older.length > 0 && (
        <section>
          <button
            type="button"
            onClick={() => {
              setShowOlder((v) => !v)
            }}
            className="flex w-full items-center gap-2 rounded-lg border border-dashed px-4 py-3 text-sm font-semibold text-muted-foreground hover:text-foreground"
          >
            <ChevronDown
              className={cn('h-4 w-4 transition-transform', showOlder && 'rotate-180')}
            />
            {showOlder ? 'Hide' : 'Show'} older periods ({s.older.length})
          </button>
          {showOlder && (
            <div className="mt-2 space-y-2">
              {s.older.map((f) => (
                <FeeCard key={f.id} fee={f} />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  )
}

/** "15 – 30 Sep" within one month, "15 Sep – 14 Oct" across two — short
 * enough for a phone row. */
function periodLabel(start: string, end: string): string {
  const a = new Date(`${start}T00:00:00`)
  const b = new Date(`${end}T00:00:00`)
  const day = (d: Date) => d.toLocaleDateString(undefined, { day: 'numeric' })
  const dayMonth = (d: Date) => d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
  return a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear()
    ? `${day(a)} – ${dayMonth(b)}`
    : `${dayMonth(a)} – ${dayMonth(b)}`
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
      {children}
    </h2>
  )
}

/** One fee, collapsed to a single line unless it is the current period or
 * the parent taps it. Receipts hide voided entries behind a toggle. */
function FeeCard({ fee, expanded = false }: { fee: StudentFeeWithPayments; expanded?: boolean }) {
  const [open, setOpen] = useState(expanded)
  const [showVoided, setShowVoided] = useState(false)
  const balance = feeBalance(fee)
  const live = fee.payments.filter((p) => !p.voidedAt)
  const voided = fee.payments.filter((p) => p.voidedAt)
  const isTopup = fee.kind === 'topup'
  const voidedTopup = isTopup && fee.amount === 0

  return (
    <div className="overflow-hidden rounded-lg border bg-card shadow-sm">
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v)
        }}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
      >
        <div className="min-w-0 flex-1">
          <div className="truncate font-bold">
            {isTopup
              ? voidedTopup
                ? 'Top-up · voided'
                : `Top-up · ${fee.creditsGranted ?? 0} class${fee.creditsGranted === 1 ? '' : 'es'}`
              : periodLabel(fee.periodStart, fee.periodEnd)}
          </div>
          <div className="truncate text-xs text-muted-foreground">
            {fee.feePlanName ?? 'Fee'}
            {isTopup
              ? ` · valid till ${formatDate(fee.periodEnd)}`
              : fee.status === 'paid' || fee.status === 'waived'
                ? ''
                : ` · due ${formatDate(fee.dueDate)}`}
          </div>
        </div>
        <div className="text-right">
          <div className="font-bold">{formatRupees(fee.amount)}</div>
          {balance > 0 && fee.status !== 'waived' && (
            <div className="text-[11px] font-semibold text-warning-300">
              {formatRupees(balance)} due
            </div>
          )}
        </div>
        <StatusBadge tone={voidedTopup ? 'neutral' : feeStatusTone(fee.status)}>
          {voidedTopup ? 'Voided' : feeStatusLabel(fee.status)}
        </StatusBadge>
        <ChevronDown
          className={cn(
            'h-4 w-4 shrink-0 text-muted-foreground transition-transform',
            open && 'rotate-180',
          )}
        />
      </button>

      {open && (
        <div className="border-t px-4 py-3 text-sm">
          {fee.status === 'waived' && fee.waivedReason && (
            <div className="mb-2 text-xs text-muted-foreground">Waived — {fee.waivedReason}</div>
          )}
          {live.length === 0 ? (
            <div className="text-xs text-muted-foreground">No payments yet.</div>
          ) : (
            <ul className="space-y-2">
              {live.map((p) => (
                <li key={p.id}>
                  <ReceiptRow payment={p} />
                </li>
              ))}
            </ul>
          )}
          {live.length > 0 && !isTopup && (
            <div className="mt-2 text-xs text-muted-foreground">
              Paid {formatRupees(paidTotal(fee.payments))} of {formatRupees(fee.amount)}
            </div>
          )}
          {voided.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setShowVoided((v) => !v)
              }}
              className="mt-2 text-[11px] font-bold text-muted-foreground underline-offset-2 hover:underline"
            >
              {showVoided ? 'Hide' : 'Show'} {voided.length} voided{' '}
              {voided.length === 1 ? 'entry' : 'entries'}
            </button>
          )}
          {showVoided && (
            <ul className="mt-2 space-y-2 opacity-60">
              {voided.map((p) => (
                <li key={p.id}>
                  <ReceiptRow payment={p} />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

function ReceiptRow({ payment: p, label }: { payment: PaymentRecord; label?: string }) {
  return (
    <div className="flex items-start gap-3">
      <Receipt className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <div className={cn('font-semibold', p.voidedAt && 'line-through')}>
          {formatRupees(p.amount)}
          {label && <span className="font-normal text-muted-foreground"> · {label}</span>}
        </div>
        <div className="text-xs text-muted-foreground">
          {formatDate(p.paidDate)} · {PAYMENT_METHOD_LABEL[p.method]}
          {p.reference && ` · ${p.reference}`}
          {p.receiptNo && ` · ${p.receiptNo}`}
        </div>
        {p.voidedAt && (
          <div className="text-xs text-brand-400">
            Voided{p.voidReason ? ` — ${p.voidReason}` : ''}
          </div>
        )}
      </div>
    </div>
  )
}
