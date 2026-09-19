// Edge Function: invite-user
// =============================================================================
// The ONLY place a new parent or coach account gets created. Runs with the
// service-role key (never sent to the browser) so it can call the Supabase
// Admin API — the anon key the frontend uses cannot create auth users at all.
//
// Two actions:
//   (default)          create the account, link it, and hand back a sign-in
//                      link — emailing it too when the mailer allows.
//   { action: 'link' } a fresh sign-in link for an existing account (the
//                      admin re-shares it when the first one was lost).
//
// Why a link and not just an email: Supabase's built-in mailer allows a
// handful of emails an hour, and until a custom SMTP provider is set up
// invites simply stop arriving. The account is therefore created with
// generateLink() — which never sends anything — and the admin gets a link to
// share over WhatsApp. When the mailer does work, the email goes out as well.
// The link carries a one-time token the app verifies itself (/welcome), so
// it works on any origin without touching the auth redirect allow-list.
//
// Deploy: npx supabase functions deploy invite-user
// Called from the frontend via supabase.functions.invoke('invite-user', {...})
// which automatically forwards the caller's session JWT in the Authorization
// header — that JWT is what this function checks below, before doing anything
// privileged, so a non-admin can never use this endpoint to create accounts.
// =============================================================================

import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2'

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

interface LinkBody {
  action: 'link'
  profile_id: string
}

type InviteBody = InviteParentBody | InviteCoachBody | LinkBody

/** What the admin gets back: the account, plus how to get the person in. */
interface InviteResult {
  profile_id: string
  coach_id?: string
  /** One-time token for the app's /welcome page (verifyOtp). */
  token_hash: string | null
  token_type: 'invite' | 'recovery' | null
  /** Whether Supabase's mailer accepted an email for this invite. */
  emailed: boolean
  email_error?: string
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

/** A sign-in token for an account that already exists. 'recovery' works for
 * any user (confirmed or not) and lets them set a password on arrival. */
async function recoveryToken(admin: SupabaseClient, email: string) {
  const { data, error } = await admin.auth.admin.generateLink({ type: 'recovery', email })
  if (error || !data.properties?.hashed_token) return null
  return data.properties.hashed_token
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS })

  try {
    const body = (await req.json()) as InviteBody

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

    // Full privileges from here on — never exposed to the browser.
    const admin = createClient(supabaseUrl, serviceRoleKey)

    // ---- action: link — a fresh sign-in link for an existing account ----
    if ('action' in body && body.action === 'link') {
      if (!body.profile_id) return json({ error: 'profile_id is required' }, 400)
      const { data: target } = await admin
        .from('profiles')
        .select('id, email, academy_id, status')
        .eq('id', body.profile_id)
        .maybeSingle()
      if (!target || target.academy_id !== academyId) return json({ error: 'Not found' }, 404)
      if (!target.email) return json({ error: 'This account has no email address' }, 400)

      const token = await recoveryToken(admin, target.email)
      if (!token) return json({ error: 'Could not create a sign-in link' }, 500)

      // Try to email it too; a mailer failure is reported, not fatal.
      const { error: mailError } = await admin.auth.resetPasswordForEmail(target.email)
      const result: InviteResult = {
        profile_id: target.id,
        token_hash: token,
        token_type: 'recovery',
        emailed: !mailError,
        email_error: mailError?.message,
      }
      return json(result)
    }

    if (!body.email || !body.full_name || !body.role) {
      return json({ error: 'email, full_name and role are required' }, 400)
    }
    if (body.role === 'parent' && !body.student_id) {
      return json({ error: 'student_id is required to invite a parent' }, 400)
    }
    const email = body.email.trim().toLowerCase()

    // Reuse an existing account (e.g. a parent already linked to a sibling)
    // instead of creating a duplicate.
    const { data: existingProfile } = await admin
      .from('profiles')
      .select('id, academy_id')
      .eq('email', email)
      .maybeSingle()

    let profileId: string
    let tokenHash: string | null = null
    let tokenType: InviteResult['token_type'] = null
    let emailed = false
    let emailError: string | undefined

    if (existingProfile) {
      if (existingProfile.academy_id !== academyId) {
        return json({ error: 'That email already belongs to a different academy' }, 409)
      }
      profileId = existingProfile.id
    } else {
      // 1. Create the account WITHOUT sending anything — this never hits the
      //    mailer's rate limit, so the skater/coach is always created.
      const { data: gen, error: genError } = await admin.auth.admin.generateLink({
        type: 'invite',
        email,
      })
      if (genError || !gen.user) {
        return json({ error: genError?.message ?? 'Could not create the account' }, 500)
      }
      profileId = gen.user.id
      tokenHash = gen.properties?.hashed_token ?? null
      tokenType = tokenHash ? 'invite' : null

      const { error: profileError } = await admin.from('profiles').insert({
        id: profileId,
        academy_id: academyId,
        role: body.role,
        full_name: body.full_name,
        phone: body.phone ?? null,
        email,
        status: 'invited',
      })
      if (profileError) {
        // Don't leave an auth user with no profile behind.
        await admin.auth.admin.deleteUser(profileId)
        return json({ error: profileError.message }, 500)
      }

      // 2. Best effort: also email a link. resetPasswordForEmail works for an
      //    unconfirmed user and its link sets a password — which is what an
      //    invite does. If the mailer refuses (rate limit, no SMTP), the admin
      //    still has the token above to share by hand.
      const { error: mailError } = await admin.auth.resetPasswordForEmail(email)
      emailed = !mailError
      emailError = mailError?.message
    }

    if (body.role === 'parent') {
      const { error } = await admin.from('parents_students').insert({
        academy_id: academyId,
        parent_profile_id: profileId,
        student_id: body.student_id,
        relationship: body.relationship,
      })
      if (error) return json({ error: error.message }, 500)
      const result: InviteResult = {
        profile_id: profileId,
        token_hash: tokenHash,
        token_type: tokenType,
        emailed,
        email_error: emailError,
      }
      return json(result)
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
    const result: InviteResult = {
      profile_id: profileId,
      coach_id: coach.id,
      token_hash: tokenHash,
      token_type: tokenType,
      emailed,
      email_error: emailError,
    }
    return json(result)
  } catch {
    return json({ error: 'Unexpected error' }, 500)
  }
})
