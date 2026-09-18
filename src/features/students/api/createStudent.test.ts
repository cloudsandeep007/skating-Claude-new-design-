import { beforeEach, describe, expect, it, vi } from 'vitest'

// BUG-005: adding a skater must not leave a half-made record behind when a
// later step (enrolment, parent invite) fails. The Supabase client is
// replaced with a tiny recorder so the test can see exactly which tables
// were written and whether the compensating delete ran.

const calls: { table: string; op: string; payload?: unknown }[] = []
let failOn: 'none' | 'enroll' | 'invite' = 'none'

vi.mock('@/shared/lib/supabase', () => {
  function table(name: string) {
    return {
      insert(payload: unknown) {
        calls.push({ table: name, op: 'insert', payload })
        if (name === 'students') {
          return {
            select: () => ({
              single: () => Promise.resolve({ data: { id: 'stu-1' }, error: null }),
            }),
          }
        }
        if (name === 'student_batches' && failOn === 'enroll') {
          return Promise.resolve({ error: { code: '23503', message: 'batch missing' } })
        }
        return Promise.resolve({ error: null })
      },
      delete() {
        return {
          eq: (col: string, val: unknown) => {
            calls.push({ table: name, op: 'delete', payload: { [col]: val } })
            return Promise.resolve({ error: null })
          },
        }
      },
      update() {
        return { eq: () => Promise.resolve({ error: null }) }
      },
    }
  }
  return {
    supabase: {
      from: (name: string) => table(name),
      rpc: () => Promise.resolve({ data: [], error: null }),
    },
  }
})

vi.mock('./inviteParent', () => ({
  linkParent: () => {
    calls.push({ table: 'invite-user', op: 'invoke' })
    if (failOn === 'invite') return Promise.reject(new Error('email rate limit exceeded'))
    return Promise.resolve()
  },
}))

vi.mock('./uploadStudentPhoto', () => ({ uploadStudentPhoto: () => Promise.resolve('p.jpg') }))

import { createStudent } from './createStudent'
import type { StudentForm } from '../types'

const form: StudentForm = {
  fullName: 'QA Skater',
  batchId: 'batch-1',
  emergencyContact: { name: 'A', phone: '9845000011', relationship: 'aunt' },
  parent: { mode: 'new', fullName: 'P', email: 'p@example.com', phone: '9845000012', relationship: 'guardian' },
}

describe('createStudent', () => {
  beforeEach(() => {
    calls.length = 0
    failOn = 'none'
  })

  it('creates, enrols and links in order when everything works', async () => {
    const id = await createStudent({ academyId: 'ac-1', form, photoFile: null })
    expect(id).toBe('stu-1')
    expect(calls.map((c) => `${c.table}:${c.op}`)).toEqual([
      'students:insert',
      'student_batches:insert',
      'invite-user:invoke',
    ])
  })

  it('removes the skater again when the parent invite fails, and rethrows the reason', async () => {
    failOn = 'invite'
    await expect(createStudent({ academyId: 'ac-1', form, photoFile: null })).rejects.toThrow(
      /rate limit/,
    )
    expect(calls[calls.length - 1]).toEqual({ table: 'students', op: 'delete', payload: { id: 'stu-1' } })
  })

  it('removes the skater again when enrolment fails', async () => {
    failOn = 'enroll'
    await expect(createStudent({ academyId: 'ac-1', form, photoFile: null })).rejects.toMatchObject({
      code: '23503',
    })
    expect(calls.some((c) => c.table === 'invite-user')).toBe(false)
    expect(calls[calls.length - 1]).toEqual({ table: 'students', op: 'delete', payload: { id: 'stu-1' } })
  })
})
