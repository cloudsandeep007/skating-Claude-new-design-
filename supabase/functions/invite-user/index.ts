// Edge Function: invite-user
// =============================================================================
// The ONLY place a new parent or coach account gets created. Runs with the
// service-role key (never sent to the browser) so it can call the Supabase
// Admin API — the anon key the frontend uses cannot create auth users at all.
//
// Deploy: npx supabase functions deploy invite-user
// Called from the frontend via supabase.functions.invoke('invite-user', {...})
// which automatically forwards the caller's session JWT in the Authorization
// header — that JWT is what this function checks below, before doing anything
// privileged, so a non-admin can never use this endpoint to create accounts.
// =============================================================================

import { createClient } from 'jsr:@supabase/supabase-js@2'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface InviteParentBody {
  role: 'parent'
  email: string
  full_name: string
  phone?: string
  student_id: string
  relationship: 'father' | 'mother' | 'guardian' | 'other'
}

interface InviteCoachBody {
  role: 'coach'
  email: string
  full_name: string
  phone?: string
  specialization?: string
}

type InviteBody = InviteParentBody | InviteCoachBody

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS })

  try {
    const body = (await req.json()) as InviteBody
    if (!body.email || !body.full_name || !body.role) {
      return json({ error: 'email, full_name and role are required' }, 400)
    }

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Missing Authorization header' }, 401)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // Scoped to the caller's own session — used only to verify who's asking.
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const {
      data: { user: caller },
    } = await callerClient.auth.getUser()
    if (!caller) return json({ error: 'Not signed in' }, 401)

    const { data: callerProfile } = await callerClient
      .from('profiles')
      .select('role, academy_id')
      .eq('id', caller.id)
      .single()

    if (!callerProfile || callerProfile.role !== 'academy_admin' || !callerProfile.academy_id) {
      return json({ error: 'Only an academy admin can invite accounts' }, 403)
    }
    const academyId = callerProfile.academy_id

    if (body.role === 'parent' && !body.student_id) {
      return json({ error: 'student_id is required to invite a parent' }, 400)
    }

    // Full privileges from here on — never exposed to the browser.
    const admin = createClient(supabaseUrl, serviceRoleKey)

    // Reuse an existing account (e.g. a parent already linked to a sibling)
    // instead of creating a duplicate.
    const { data: existingProfile } = await admin
      .from('profiles')
      .select('id, academy_id')
      .eq('email', body.email)
      .maybeSingle()

    let profileId: string

    if (existingProfile) {
      if (existingProfile.academy_id !== academyId) {
        return json({ error: 'That email already belongs to a different academy' }, 409)
      }
      profileId = existingProfile.id
    } else {
      const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(
        body.email,
      )
      if (inviteError || !invited.user) {
        return json({ error: inviteError?.message ?? 'Could not send the invite email' }, 500)
      }

      const { error: profileError } = await admin.from('profiles').insert({
        id: invited.user.id,
        academy_id: academyId,
        role: body.role,
        full_name: body.full_name,
        phone: body.phone ?? null,
        email: body.email,
        status: 'invited',
      })
      if (profileError) return json({ error: profileError.message }, 500)

      profileId = invited.user.id
    }

    if (body.role === 'parent') {
      const { error } = await admin.from('parents_students').insert({
        academy_id: academyId,
        parent_profile_id: profileId,
        student_id: body.student_id,
        relationship: body.relationship,
      })
      if (error) return json({ error: error.message }, 500)
      return json({ profile_id: profileId })
    }

    const { data: coach, error } = await admin
      .from('coaches')
      .insert({
        academy_id: academyId,
        profile_id: profileId,
        specialization: body.specialization ?? null,
      })
      .select('id')
      .single()
    if (error) return json({ error: error.message }, 500)
    return json({ profile_id: profileId, coach_id: coach.id })
  } catch {
    return json({ error: 'Unexpected error' }, 500)
  }
})
