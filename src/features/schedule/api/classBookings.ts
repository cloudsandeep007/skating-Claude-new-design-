import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { supabase } from '@/shared/lib/supabase'

/** class_credit_balance() RPC — the one running, never-reset balance: every
 * credit ever granted, minus every active booking ever made, plus any
 * still-pending make-up credit as a bonus. Null for a student not on a
 * batch-scoped plan (nothing to book). */
export function useClassCreditBalance(studentId: string | null) {
  return useQuery({
    queryKey: ['bookings', 'balance', studentId],
    enabled: studentId !== null,
    queryFn: async (): Promise<number | null> => {
      if (!studentId) return null
      const { data, error } = await supabase.rpc('class_credit_balance', {
        p_student_id: studentId,
      })
      if (error) throw error
      return data
    },
  })
}

export interface ClassCreditSummary {
  granted: number
  spent: number
  refunded: number
  expired: number
  adjusted: number
  available: number | null
  termEnd: string | null
  termStatus: TermStatus | null
}

export type TermStatus = 'none' | 'active' | 'expiring' | 'expired'

/** class_credit_summary() RPC — the ledger totalled by kind (granted from
 * paid fees and top-ups, spent on classes, refunded, expired, adjusted)
 * plus the balance and the current term, for the admin side where a plain
 * number isn't enough to explain "why is this 0". */
export function useClassCreditSummary(studentId: string | null) {
  return useQuery({
    queryKey: ['bookings', 'summary', studentId],
    enabled: studentId !== null,
    queryFn: async (): Promise<ClassCreditSummary | null> => {
      if (!studentId) return null
      const { data, error } = await supabase
        .rpc('class_credit_summary', { p_student_id: studentId })
        .single()
      if (error) throw error
      return {
        granted: data.granted,
        spent: data.spent,
        refunded: data.refunded,
        expired: data.expired,
        adjusted: data.adjusted,
        available: data.available,
        termEnd: data.term_end,
        termStatus: data.term_status as TermStatus | null,
      }
    },
  })
}

export interface CreditPlanStatus {
  usesCredits: boolean
  pricingMode: 'cycle' | 'per_class' | null
  billingCycle: 'monthly' | 'quarterly' | 'annual' | null
  rate: number | null
  /** Classes a top-up must be to start or renew a term (8 / 24 / 96). */
  minTopup: number | null
  termStart: string | null
  termEnd: string | null
  daysLeft: number | null
  termStatus: TermStatus
  available: number | null
  /** How many days ahead a class can be booked (academy setting, default 7). */
  bookingWindowDays: number
  /** The plan the skater is on, and the batch it is scoped to (null = all). */
  planName: string | null
  planBatchId: string | null
  planBatchName: string | null
}

/** credit_plan_status() RPC — the skater's current plan term: when it ends,
 * whether it's lapsed, the top-up minimum, and the balance. Drives the
 * parent's credits card, the admin's credits card and the Top-up dialog. */
export function useCreditPlanStatus(studentId: string | null) {
  return useQuery({
    queryKey: ['bookings', 'plan-status', studentId],
    enabled: studentId !== null,
    queryFn: async (): Promise<CreditPlanStatus | null> => {
      if (!studentId) return null
      const { data, error } = await supabase
        .rpc('credit_plan_status', { p_student_id: studentId })
        .single()
      if (error) throw error
      return {
        usesCredits: data.uses_credits,
        pricingMode: data.pricing_mode,
        billingCycle: data.billing_cycle,
        rate: data.rate,
        minTopup: data.min_topup,
        termStart: data.term_start,
        termEnd: data.term_end,
        daysLeft: data.days_left,
        termStatus: data.term_status as TermStatus,
        available: data.available,
        bookingWindowDays: data.booking_window_days,
        planName: data.plan_name,
        planBatchId: data.plan_batch_id,
        planBatchName: data.plan_batch_name,
      }
    },
  })
}

export type CreditLedgerKind = 'grant' | 'clawback' | 'spend' | 'refund' | 'expire' | 'adjust'

export interface CreditLedgerEntry {
  id: string
  delta: number
  kind: CreditLedgerKind
  reason: string | null
  createdAt: string
  actorName: string | null
}

/** Every credit movement for a skater, newest first — the statement. */
export function useCreditLedger(studentId: string | null) {
  return useQuery({
    queryKey: ['bookings', 'ledger', studentId],
    enabled: studentId !== null,
    queryFn: async (): Promise<CreditLedgerEntry[]> => {
      if (!studentId) return []
      const { data, error } = await supabase
        .from('credit_ledger')
        .select(
          'id, delta, kind, reason, created_at, actor:profiles!credit_ledger_actor_id_fkey(full_name)',
        )
        .eq('student_id', studentId)
        .order('created_at', { ascending: false })
        .overrideTypes<
          {
            id: string
            delta: number
            kind: CreditLedgerKind
            reason: string | null
            created_at: string
            actor: { full_name: string } | null
          }[],
          { merge: false }
        >()
      if (error) throw error
      return data.map((r) => ({
        id: r.id,
        delta: r.delta,
        kind: r.kind,
        reason: r.reason,
        createdAt: r.created_at,
        actorName: r.actor?.full_name ?? null,
      }))
    },
  })
}

export interface UpcomingBooking {
  sessionId: string
  sessionDate: string
  startTime: string
  endTime: string
  batchId: string
  batchName: string
  venue: string | null
  coachName: string | null
  studentId: string
  fullName: string
  photoUrl: string | null
  /** 'parent' booked it; 'attendance' means a walk-in recorded at marking. */
  source: 'parent' | 'attendance'
  /** 'booked' is confirmed; 'pending' is still waiting for approval. */
  status: 'booked' | 'pending'
}

/** upcoming_bookings() RPC — every active booking on a scheduled session in
 * the next N days, for the admin's "who's coming" view. */
export function useUpcomingBookings(days = 7) {
  return useQuery({
    queryKey: ['bookings', 'upcoming', days],
    queryFn: async (): Promise<UpcomingBooking[]> => {
      const { data, error } = await supabase.rpc('upcoming_bookings', { p_days: days })
      if (error) throw error
      return data.map((r) => ({
        sessionId: r.session_id,
        sessionDate: r.session_date,
        startTime: r.start_time,
        endTime: r.end_time,
        batchId: r.batch_id,
        batchName: r.batch_name,
        venue: r.venue,
        coachName: r.coach_name,
        studentId: r.student_id,
        fullName: r.full_name,
        photoUrl: r.photo_url,
        source: r.source as 'parent' | 'attendance',
        status: r.status as 'booked' | 'pending',
      }))
    },
  })
}

export type BookingStatus = 'pending' | 'booked' | 'rejected' | 'cancelled'

export interface StudentBooking {
  status: BookingStatus
  /** Why a request was declined — shown to the parent. */
  decisionNote: string | null
  decidedAt: string | null
}

/** Every booking a student has on any session, keyed by session id —
 * pending requests, confirmed places, and declined ones (so the parent sees
 * the reason and can ask again). Cancelled rows are left out. */
export function useStudentBookings(studentId: string | null) {
  return useQuery({
    queryKey: ['bookings', 'by-student', studentId],
    enabled: studentId !== null,
    queryFn: async (): Promise<Map<string, StudentBooking>> => {
      if (!studentId) return new Map()
      const { data, error } = await supabase
        .from('class_bookings')
        .select('session_id, status, decision_note, decided_at')
        .eq('student_id', studentId)
        .in('status', ['pending', 'booked', 'rejected'])
      if (error) throw error
      return new Map(
        data.map((r) => [
          r.session_id,
          {
            status: r.status as BookingStatus,
            decisionNote: r.decision_note,
            decidedAt: r.decided_at,
          },
        ]),
      )
    },
  })
}

export function invalidateBookings(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: ['bookings'] })
  void queryClient.invalidateQueries({ queryKey: ['notifications'] })
  void queryClient.invalidateQueries({ queryKey: ['sessions'] })
  void queryClient.invalidateQueries({ queryKey: ['attendance', 'session'] })
  void queryClient.invalidateQueries({ queryKey: ['parent', 'upcoming'] })
}

export interface BookingSlotInput {
  sessionId: string
  /** Which child — a parent with two children in the same batch must say
   * whose credit is being spent. */
  studentId: string
}

/** book_class_slot() RPC — reserves one of the named child's credits
 * against a specific upcoming session in their batch. */
export function useBookClassSlot() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ sessionId, studentId }: BookingSlotInput) => {
      const { data, error } = await supabase.rpc('book_class_slot', {
        p_session_id: sessionId,
        p_student_id: studentId,
      })
      if (error) throw error
      return data
    },
    onSuccess: () => {
      invalidateBookings(queryClient)
    },
  })
}

/** cancel_class_slot() RPC — frees the credit, only while the session is
 * still scheduled (not yet marked). */
export function useCancelClassSlot() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ sessionId, studentId }: BookingSlotInput) => {
      const { data, error } = await supabase.rpc('cancel_class_slot', {
        p_session_id: sessionId,
        p_student_id: studentId,
      })
      if (error) throw error
      return data
    },
    onSuccess: () => {
      invalidateBookings(queryClient)
    },
  })
}
