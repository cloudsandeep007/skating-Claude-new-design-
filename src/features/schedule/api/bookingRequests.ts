import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { supabase } from '@/shared/lib/supabase'

import { invalidateBookings } from './classBookings'

export type RequestScope = 'pending' | 'decided' | 'all'

export interface BookingRequest {
  bookingId: string
  status: 'pending' | 'booked' | 'rejected' | 'cancelled'
  source: 'parent' | 'attendance'
  requestedAt: string
  decidedAt: string | null
  decidedBy: string | null
  decisionNote: string | null
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
  /** The skater's balance right now — a request already holds one credit. */
  creditsLeft: number | null
}

/** booking_requests() RPC — the approvals queue. A coach sees requests on
 * their own sessions, an admin the whole academy; 'decided' lists recent
 * approvals and declines so a decision can be checked or reversed. */
export function useBookingRequests(scope: RequestScope, days = 30) {
  return useQuery({
    queryKey: ['bookings', 'requests', scope, days],
    queryFn: async (): Promise<BookingRequest[]> => {
      const { data, error } = await supabase.rpc('booking_requests', {
        p_status: scope,
        p_days: days,
      })
      if (error) throw error
      return data.map((r) => ({
        bookingId: r.booking_id,
        status: r.status as BookingRequest['status'],
        source: r.source as BookingRequest['source'],
        requestedAt: r.requested_at,
        decidedAt: r.decided_at,
        decidedBy: r.decided_by,
        decisionNote: r.decision_note,
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
        creditsLeft: r.credits_left,
      }))
    },
  })
}

/** How many requests are waiting on the signed-in coach / admin — drives
 * the nav badge. Polls every minute so a request made while the app is
 * open still shows up. */
export function usePendingBookingCount() {
  return useQuery({
    queryKey: ['bookings', 'pending-count'],
    refetchInterval: 60_000,
    queryFn: async (): Promise<number> => {
      const { data, error } = await supabase.rpc('pending_booking_count')
      if (error) throw error
      return data
    },
  })
}

export function useApproveBooking() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (bookingId: string) => {
      const { data, error } = await supabase.rpc('approve_booking', { p_booking_id: bookingId })
      if (error) throw error
      return data
    },
    onSuccess: () => {
      invalidateBookings(queryClient)
    },
  })
}

export function useRejectBooking() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ bookingId, note }: { bookingId: string; note: string | null }) => {
      const { data, error } = await supabase.rpc('reject_booking', {
        p_booking_id: bookingId,
        p_note: note ?? undefined,
      })
      if (error) throw error
      return data
    },
    onSuccess: () => {
      invalidateBookings(queryClient)
    },
  })
}

/** Approve every request still waiting on one session. */
export function useApproveSessionBookings() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (sessionId: string) => {
      const { data, error } = await supabase.rpc('approve_session_bookings', {
        p_session_id: sessionId,
      })
      if (error) throw error
      return data
    },
    onSuccess: () => {
      invalidateBookings(queryClient)
    },
  })
}
