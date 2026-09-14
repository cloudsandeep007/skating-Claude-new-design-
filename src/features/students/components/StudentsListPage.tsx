import { useEffect, useState } from 'react'
import { Plus, Search, Users } from 'lucide-react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'

import { useBatchOptions } from '@/features/batches'
import { useDebouncedValue } from '@/shared/hooks'
import { Avatar, AvatarFallback } from '@/shared/ui/avatar'
import { Button } from '@/shared/ui/button'
import { EmptyState } from '@/shared/ui/EmptyState'
import { Input } from '@/shared/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Skeleton } from '@/shared/ui/skeleton'
import { StatusBadge } from '@/shared/ui/StatusBadge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table'

import { useStudents } from '../api/listStudents'
import {
  attendanceBarColorClass,
  attendancePctColorClass,
  feeStatusLabel,
  feeStatusTone,
} from '../hooks/statusPresentation'
import type { StudentListParams, StudentSortColumn, StudentStatus } from '../types'

const PAGE_SIZE = 10

function initials(name: string) {
  return name
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

function formatLastActive(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export function StudentsListPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [page, setPage] = useState(0)
  // The admin top bar's global search lands here with ?q=…
  const [searchInput, setSearchInput] = useState(searchParams.get('q') ?? '')
  const [batchId, setBatchId] = useState<string>('all')
  const [status, setStatus] = useState<StudentStatus | 'all'>('active')
  const [sortBy, setSortBy] = useState<StudentSortColumn>('full_name')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const search = useDebouncedValue(searchInput)

  useEffect(() => {
    const q = searchParams.get('q')
    if (q !== null) {
      setSearchInput(q)
      setPage(0)
    }
  }, [searchParams])
  const { data: batches } = useBatchOptions()

  const params: StudentListParams = {
    page,
    pageSize: PAGE_SIZE,
    search,
    batchId,
    status,
    sortBy,
    sortDir,
  }
  const { data, isLoading, isPlaceholderData } = useStudents(params)

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1
  const filtersActive = search !== '' || batchId !== 'all' || status !== 'active'

  function resetToFirstPage() {
    setPage(0)
  }

  function toggleSort(column: StudentSortColumn) {
    if (sortBy === column) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortBy(column)
      setSortDir('asc')
    }
    resetToFirstPage()
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Students</h1>
        </div>
        <Button asChild>
          <Link to="/admin/students/new">
            <Plus className="h-4 w-4" />
            Add student
          </Link>
        </Button>
      </div>

      <div className="rounded-lg border bg-card shadow-sm">
        <div className="flex flex-wrap items-center gap-2.5 border-b p-3.5">
          <div className="relative min-w-[180px] max-w-[300px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by name"
              className="pl-9"
              value={searchInput}
              onChange={(event) => {
                setSearchInput(event.target.value)
                resetToFirstPage()
              }}
            />
          </div>

          <Select
            value={batchId}
            onValueChange={(value) => {
              setBatchId(value)
              resetToFirstPage()
            }}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All batches" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All batches</SelectItem>
              {batches?.map((batch) => (
                <SelectItem key={batch.id} value={batch.id}>
                  {batch.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={status}
            onValueChange={(value) => {
              setStatus(value as StudentStatus | 'all')
              resetToFirstPage()
            }}
          >
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
              <SelectItem value="all">All statuses</SelectItem>
            </SelectContent>
          </Select>

          {filtersActive && (
            <Button
              variant="ghost"
              className="text-brand-700 hover:bg-brand-50 hover:text-brand-800"
              onClick={() => {
                setSearchInput('')
                setBatchId('all')
                setStatus('active')
                resetToFirstPage()
              }}
            >
              Clear
            </Button>
          )}
        </div>

        {isLoading ? (
          <StudentsSkeleton />
        ) : !data || data.items.length === 0 ? (
          <div className="p-2">
            <EmptyState
              className="border-0 shadow-none"
              icon={Users}
              title={filtersActive ? 'No students match those filters' : 'No students yet'}
              description={
                filtersActive
                  ? 'Try widening the batch filter or clearing the search.'
                  : 'Add your first student to get started.'
              }
              action={
                filtersActive ? (
                  <Button
                    variant="outline"
                    className="mt-2"
                    onClick={() => {
                      setSearchInput('')
                      setBatchId('all')
                      setStatus('active')
                      resetToFirstPage()
                    }}
                  >
                    Clear filters
                  </Button>
                ) : undefined
              }
            />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      <button
                        type="button"
                        onClick={() => {
                          toggleSort('full_name')
                        }}
                        className="font-semibold uppercase tracking-wide"
                      >
                        Student
                      </button>
                    </TableHead>
                    <TableHead>Batch</TableHead>
                    <TableHead>Level</TableHead>
                    <TableHead>Attendance</TableHead>
                    <TableHead>Fee status</TableHead>
                    <TableHead>
                      <button
                        type="button"
                        onClick={() => {
                          toggleSort('joined_date')
                        }}
                        className="font-semibold uppercase tracking-wide"
                      >
                        Last active
                      </button>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className={isPlaceholderData ? 'opacity-60' : undefined}>
                  {data.items.map((student) => (
                    <TableRow
                      key={student.id}
                      className="cursor-pointer"
                      onClick={() => {
                        void navigate(`/admin/students/${student.id}`)
                      }}
                    >
                      <TableCell>
                        <div className="flex min-w-0 items-center gap-2.5">
                          <Avatar className="h-9 w-9 shrink-0">
                            <AvatarFallback className="bg-neutral-200 text-xs font-bold text-neutral-800">
                              {initials(student.fullName)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <div className="truncate font-bold">{student.fullName}</div>
                            {student.parentName && (
                              <div className="truncate text-xs text-muted-foreground">
                                {student.parentName}
                              </div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{student.batchName ?? '—'}</TableCell>
                      <TableCell className="font-bold">{student.levelName ?? '—'}</TableCell>
                      <TableCell className="min-w-[100px]">
                        <div
                          className={`font-bold ${attendancePctColorClass(student.attendancePct)}`}
                        >
                          {student.attendancePct === null ? '—' : `${student.attendancePct}%`}
                        </div>
                        {student.attendancePct !== null && (
                          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-neutral-200">
                            <div
                              className={`h-full rounded-full ${attendanceBarColorClass(student.attendancePct)}`}
                              style={{ width: `${student.attendancePct}%` }}
                            />
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <StatusBadge tone={feeStatusTone(student.feeStatus)}>
                          {feeStatusLabel(student.feeStatus)}
                        </StatusBadge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatLastActive(student.lastActiveAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex items-center gap-3 border-t p-3.5">
              <span className="text-sm text-muted-foreground">
                Page {page + 1} of {totalPages} · {data.total} student
                {data.total === 1 ? '' : 's'}
              </span>
              <div className="ml-auto flex gap-2">
                <Button
                  variant="outline"
                  disabled={page === 0}
                  onClick={() => {
                    setPage((p) => Math.max(0, p - 1))
                  }}
                >
                  Prev
                </Button>
                <Button
                  variant="outline"
                  disabled={page + 1 >= totalPages}
                  onClick={() => {
                    setPage((p) => p + 1)
                  }}
                >
                  Next
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function StudentsSkeleton() {
  return (
    <div className="divide-y">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-4">
          <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-1/3" />
            <Skeleton className="h-3 w-1/4" />
          </div>
          <Skeleton className="h-6 w-16 rounded-full" />
        </div>
      ))}
    </div>
  )
}
