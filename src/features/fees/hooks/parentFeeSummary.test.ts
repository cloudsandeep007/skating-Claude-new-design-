import { describe, expect, it } from 'vitest'

import type { PaymentRecord, StudentFeeWithPayments } from '../types'
import { feeBalance, summarizeParentFees } from './parentFeeSummary'

function pay(over: Partial<PaymentRecord>): PaymentRecord {
  return {
    id: 'p',
    amount: 100,
    paidDate: '2026-09-01',
    method: 'cash',
    reference: null,
    notes: null,
    recordedByName: null,
    receiptNo: 'PRSA-2026-000001',
    voidedAt: null,
    voidReason: null,
    advanceDeposit: 0,
    ...over,
  }
}

function fee(over: Partial<StudentFeeWithPayments>): StudentFeeWithPayments {
  return {
    id: 'f',
    kind: 'period',
    creditsGranted: 8,
    periodStart: '2026-09-01',
    periodEnd: '2026-09-30',
    dueDate: '2026-09-06',
    amount: 1000,
    status: 'pending',
    waivedReason: null,
    feePlanName: 'Monthly',
    payments: [],
    ...over,
  }
}

describe('summarizeParentFees', () => {
  it('reports nothing due when every fee is settled', () => {
    const s = summarizeParentFees(
      [fee({ status: 'paid', payments: [pay({ amount: 1000 })] })],
      '2026-09-19',
    )
    expect(s.dueNow).toBe(0)
    expect(s.dueBy).toBeNull()
    expect(s.overdue).toBe(false)
  })

  it('adds up what is still owed across open fees and takes the earliest due date', () => {
    const s = summarizeParentFees(
      [
        fee({ id: 'a', amount: 1000, payments: [pay({ amount: 200 })], dueDate: '2026-09-20' }),
        fee({
          id: 'b',
          amount: 500,
          status: 'overdue',
          dueDate: '2026-09-06',
          periodStart: '2026-08-01',
          periodEnd: '2026-08-31',
        }),
        fee({ id: 'c', amount: 300, status: 'waived' }),
      ],
      '2026-09-19',
    )
    expect(s.dueNow).toBe(1300)
    expect(s.dueBy).toBe('2026-09-06')
    expect(s.overdue).toBe(true)
  })

  it('voided payments do not reduce what is owed', () => {
    expect(
      feeBalance(
        fee({ amount: 640, payments: [pay({ amount: 640, voidedAt: '2026-09-10T00:00:00Z' })] }),
      ),
    ).toBe(640)
  })

  it('picks the period covering today as current and parks the rest as older', () => {
    const s = summarizeParentFees(
      [
        fee({ id: 'oct', periodStart: '2026-10-01', periodEnd: '2026-10-31' }),
        fee({ id: 'sep', periodStart: '2026-09-01', periodEnd: '2026-09-30', status: 'paid' }),
        fee({ id: 'aug', periodStart: '2026-08-01', periodEnd: '2026-08-31', status: 'paid' }),
      ],
      '2026-09-19',
    )
    expect(s.current?.id).toBe('sep')
    expect(s.older.map((f) => f.id)).toEqual(['oct', 'aug'])
  })

  it('falls back to the latest period when none covers today', () => {
    const s = summarizeParentFees(
      [fee({ id: 'aug', periodStart: '2026-08-01', periodEnd: '2026-08-31', status: 'paid' })],
      '2026-09-19',
    )
    expect(s.current?.id).toBe('aug')
    expect(s.older).toEqual([])
  })

  it('keeps live top-ups beside the current period and hides voided ones', () => {
    const s = summarizeParentFees(
      [
        fee({ id: 'sep', status: 'paid' }),
        fee({
          id: 't1',
          kind: 'topup',
          periodStart: '2026-09-10',
          periodEnd: '2026-09-30',
          status: 'paid',
          amount: 4000,
        }),
        fee({
          id: 't0',
          kind: 'topup',
          periodStart: '2026-09-05',
          periodEnd: '2026-09-30',
          status: 'paid',
          amount: 0,
        }),
        fee({
          id: 'told',
          kind: 'topup',
          periodStart: '2026-08-05',
          periodEnd: '2026-08-31',
          status: 'paid',
          amount: 4000,
        }),
      ],
      '2026-09-19',
    )
    expect(s.activeTopups.map((f) => f.id)).toEqual(['t1'])
    expect(s.older.map((f) => f.id)).toEqual(['t0', 'told'])
  })

  it('finds the most recent live receipt', () => {
    const s = summarizeParentFees(
      [
        fee({
          id: 'sep',
          payments: [
            pay({ id: 'p1', paidDate: '2026-09-01', receiptNo: 'R1' }),
            pay({
              id: 'p2',
              paidDate: '2026-09-15',
              receiptNo: 'R2',
              voidedAt: '2026-09-16T00:00:00Z',
            }),
            pay({ id: 'p3', paidDate: '2026-09-10', receiptNo: 'R3' }),
          ],
        }),
      ],
      '2026-09-19',
    )
    expect(s.lastReceipt?.receiptNo).toBe('R3')
    expect(s.lastReceipt?.feeLabel).toBe('Monthly')
  })
})
