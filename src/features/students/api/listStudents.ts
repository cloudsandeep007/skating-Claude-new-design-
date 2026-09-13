import { keepPreviousData, useQuery } from '@tanstack/react-query'

import { supabase } from '@/shared/lib/supabase'

import type { StudentListItem, StudentListParams } from '../types'

interface StudentRow {
  id: string
  full_name: string
  photo_url: string | null
  status: StudentListItem['status']
  current_level: { name: string } | null
  student_batches: { batch_id: string; batch: { id: string; name: string } | null }[]
}

async function fetchStudentsPage(params: StudentListParams) {
  const from = params.page * params.pageSize
  const to = from + params.pageSize - 1

  let query = supabase
    .from('students')
    .select(
      `id, full_name, photo_url, status,
       current_level:levels(name),
       student_batches!inner(batch_id, status, batch:batches(id, name))`,
      { count: 'exact' },
    )
    .eq('student_batches.status', 'active')

  if (params.status !== 'all') query = query.eq('status', params.status)
  if (params.search) query = query.ilike('full_name', `%${params.search}%`)
  if (params.batchId !== 'all') query = query.eq('student_batches.batch_id', params.batchId)

  query = query.order(params.sortBy, { ascending: params.sortDir === 'asc' }).range(from, to)

  const { data, error, count } = await query.overrideTypes<StudentRow[], { merge: false }>()
  if (error) throw error

  const ids = data.map((row) => row.id)

  const [attendanceByStudent, feeByStudent, lastActiveByStudent, parentByStudent] =
    await Promise.all([
      fetchAttendancePcts(ids),
      fetchLatestFeeStatuses(ids),
      fetchLastActive(ids),
      fetchPrimaryParentNames(ids),
    ])

  const items: StudentListItem[] = data.map((row) => ({
    id: row.id,
    fullName: row.full_name,
    photoUrl: row.photo_url,
    status: row.status,
    batchId: row.student_batches[0]?.batch_id ?? null,
    batchName: row.student_batches[0]?.batch?.name ?? null,
    levelName: row.current_level?.name ?? null,
    attendancePct: attendanceByStudent.get(row.id) ?? null,
    feeStatus: feeByStudent.get(row.id) ?? null,
    lastActiveAt: lastActiveByStudent.get(row.id) ?? null,
    parentName: parentByStudent.get(row.id) ?? null,
  }))

  return { items, total: count ?? 0 }
}

async function fetchAttendancePcts(studentIds: string[]) {
  const map = new Map<string, number | null>()
  if (studentIds.length === 0) return map
  const { data } = await supabase
    .from('student_attendance_summary')
    .select('student_id, attendance_pct')
    .in('student_id', studentIds)
  for (const row of data ?? []) {
    if (row.student_id) map.set(row.student_id, row.attendance_pct)
  }
  return map
}

async function fetchLatestFeeStatuses(studentIds: string[]) {
  const map = new Map<string, StudentListItem['feeStatus']>()
  if (studentIds.length === 0) return map
  const { data } = await supabase
    .from('student_fees')
    .select('student_id, status, due_date')
    .in('student_id', studentIds)
    .order('due_date', { ascending: false })
  for (const row of data ?? []) {
    if (!map.has(row.student_id)) map.set(row.student_id, row.status)
  }
  return map
}

async function fetchLastActive(studentIds: string[]) {
  const map = new Map<string, string | null>()
  if (studentIds.length === 0) return map
  const { data } = await supabase
    .from('attendance')
    .select('student_id, marked_at')
    .in('student_id', studentIds)
    .order('marked_at', { ascending: false })
  for (const row of data ?? []) {
    if (!map.has(row.student_id)) map.set(row.student_id, row.marked_at)
  }
  return map
}

async function fetchPrimaryParentNames(studentIds: string[]) {
  const map = new Map<string, string>()
  if (studentIds.length === 0) return map
  const { data } = await supabase
    .from('parents_students')
    .select('student_id, relationship, parent:profiles(full_name)')
    .in('student_id', studentIds)
    .order('relationship', { ascending: true })
  for (const row of data ?? []) {
    if (!map.has(row.student_id)) map.set(row.student_id, row.parent.full_name)
  }
  return map
}

export function useStudents(params: StudentListParams) {
  return useQuery({
    queryKey: ['students', params],
    queryFn: () => fetchStudentsPage(params),
    placeholderData: keepPreviousData,
  })
}
