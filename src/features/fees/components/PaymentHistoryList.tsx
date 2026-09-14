import { Receipt } from 'lucide-react'
import { useState } from 'react'

import { formatDate } from '@/shared/lib/format'
import { Button } from '@/shared/ui/button'
import { EmptyState } from '@/shared/ui/EmptyState'
import { Skeleton } from '@/shared/ui/skeleton'
import { StatusBadge } from '@/shared/ui/StatusBadge'

import { useStudentFees } from '../api/payments'
import { canWaive, remainingBalance } from '../hooks/feeMath'
import { feeStatusLabel, feeStatusTone, formatRupees } from '../hooks/feeTone'
import { PAYMENT_METHOD_LABEL } from '../types'
import { RecordPaymentDialog, type PaymentTarget } from './RecordPaymentDialog'
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

  if (!fees || fees.length === 0) {
    return (
      <EmptyState
        title="No fees yet"
        description="Fees show up here once a plan is assigned and generated."
      />
    )
  }

  return (
    <ul className="space-y-3">
      {fees.map((fee) => {
        const paid = fee.payments.reduce((sum, p) => sum + p.amount, 0)
        const balance = remainingBalance(fee.amount, paid)
        return (
          <li key={fee.id} className="rounded-lg border bg-card p-3.5 shadow-sm">
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="min-w-0 flex-1">
                <div className="font-bold">
                  {formatDate(fee.periodStart)} – {formatDate(fee.periodEnd)}
                </div>
                <div className="text-xs text-muted-foreground">
                  {fee.feePlanName ?? 'Fee'} · due {formatDate(fee.dueDate)}
                </div>
              </div>
              <StatusBadge tone={feeStatusTone(fee.status)}>
                {feeStatusLabel(fee.status)}
              </StatusBadge>
              <div className="text-right">
                <div className="font-extrabold tracking-tight">{formatRupees(fee.amount)}</div>
                {balance > 0 && fee.status !== 'waived' && (
                  <div className="text-xs font-semibold text-brand-700">
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

            {canManage && (balance > 0 || canWaive(fee.status)) && (
              <div className="mt-2 flex gap-2 border-t pt-2.5">
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
              </div>
            )}

            {fee.payments.length > 0 && (
              <ul className="mt-3 space-y-1.5 border-t pt-3">
                {fee.payments.map((p) => (
                  <li key={p.id} className="flex items-center gap-2.5 text-sm">
                    <Receipt className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className="font-semibold">{formatRupees(p.amount)}</span>
                    <span className="text-muted-foreground">
                      {formatDate(p.paidDate)} · {PAYMENT_METHOD_LABEL[p.method]}
                      {p.reference && ` · ${p.reference}`}
                    </span>
                    {p.recordedByName && (
                      <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                        by {p.recordedByName}
                      </span>
                    )}
                  </li>
                ))}
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
        </>
      )}
    </ul>
  )
}
