import { toInviteOutcome, type InviteOutcome } from '@/features/auth'
import { invokeFunction } from '@/shared/lib/invokeFunction'
import { supabase } from '@/shared/lib/supabase'

import type { ParentLink } from '../types'

interface InviteResponse {
  profile_id: string
  token_hash: string | null
  token_type: 'invite' | 'recovery' | null
  emailed: boolean
  email_error?: string
}

/** Links a parent to a student — inserts the link directly for an existing
 * parent, or invokes the invite-user Edge Function (which creates the auth
 * account, sends the invite email, and creates the link) for a new one. */
export async function linkParent(
  academyId: string,
  studentId: string,
  parent: ParentLink,
): Promise<InviteOutcome | null> {
  // Zod's superRefine (see types.ts) guarantees the fields for each mode are
  // present before a submit reaches here; the throws below are belt-and-braces.
  if (parent.mode === 'existing') {
    if (!parent.parentProfileId) throw new Error('Missing parent')
    const { error } = await supabase.from('parents_students').insert({
      academy_id: academyId,
      parent_profile_id: parent.parentProfileId,
      student_id: studentId,
      relationship: parent.relationship,
    })
    if (error) throw error
    return null
  }

  if (!parent.email || !parent.fullName) throw new Error('Missing parent details')
  const raw = await invokeFunction<InviteResponse>('invite-user', {
    role: 'parent',
    email: parent.email,
    full_name: parent.fullName,
    phone: parent.phone,
    student_id: studentId,
    relationship: parent.relationship,
  })
  return toInviteOutcome(raw)
}
