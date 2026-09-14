import { z } from 'zod'

import type { Enums, Tables } from '@/shared/types'

export type FeePlan = Tables<'fee_plans'>
export type StudentFeeRow = Tables<'student_fees'>
export type PaymentRow = Tables<'payments'>
export type FeeStatus = Enums<'fee_status'>
export type BillingCycle = Enums<'billing_cycle'>
export type PaymentMethod = Enums<'payment_method'>

export const FEE_STATUSES: FeeStatus[] = ['pending', 'overdue', 'paid', 'waived']
export const BILLING_CYCLES: BillingCycle[] = ['monthly', 'quarterly', 'annual']
export const PAYMENT_METHODS: PaymentMethod[] = [
  'cash',
  'upi',
  'card',
  'bank_transfer',
  'cheque',
  'other',
]

export const BILLING_CYCLE_LABEL: Record<BillingCycle, string> = {
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  annual: 'Annual',
}

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  cash: 'Cash',
  upi: 'UPI',
  card: 'Card',
  bank_transfer: 'Bank transfer',
  cheque: 'Cheque',
  other: 'Other',
}

export interface FeePlanOption {
  id: string
  name: string
  amount: number
  billingCycle: BillingCycle
}

export interface FeeListRow {
  studentFeeId: string
  studentId: string
  fullName: string
  batchNames: string | null
  feePlanName: string | null
  periodStart: string
  periodEnd: string
  dueDate: string
  amount: number
  paid: number
  balance: number
  status: FeeStatus
}

export interface FeeDashboardSummary {
  month: string
  collected: number
  paymentCount: number
  expected: number
  outstanding: number
  overdueCount: number
  pendingCount: number
  paidCount: number
  waivedCount: number
}

export interface PaymentRecord {
  id: string
  amount: number
  paidDate: string
  method: PaymentMethod
  reference: string | null
  notes: string | null
  recordedByName: string | null
}

export interface StudentFeeWithPayments {
  id: string
  periodStart: string
  periodEnd: string
  dueDate: string
  amount: number
  status: FeeStatus
  waivedReason: string | null
  feePlanName: string | null
  payments: PaymentRecord[]
}

export const FeePlanFormSchema = z.object({
  name: z.string().min(1, 'Plan name is required'),
  amount: z.number().min(0, 'Amount must be 0 or more'),
  billingCycle: z.enum(['monthly', 'quarterly', 'annual']),
  description: z.string().optional(),
})
export type FeePlanForm = z.infer<typeof FeePlanFormSchema>

export const PaymentFormSchema = z.object({
  amount: z.number().positive('Enter an amount greater than 0'),
  paidDate: z.string().min(1, 'Pick a date'),
  method: z.enum(['cash', 'upi', 'card', 'bank_transfer', 'cheque', 'other']),
  reference: z.string().optional(),
  notes: z.string().optional(),
})
export type PaymentForm = z.infer<typeof PaymentFormSchema>

export const WaiveFormSchema = z.object({
  reason: z.string().min(1, 'A reason is required to waive a fee'),
})
export type WaiveForm = z.infer<typeof WaiveFormSchema>
