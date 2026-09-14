// Edge Function: delete-user
// =============================================================================
// Permanently removes a coach's account — the only way to actually revoke
// their login (not just their coaches row). Runs with the service-role key
// (never sent to the browser) so it can call the Supabase Admin API; deleting
// auth.users cascades to profiles (on delete cascade) which cascades to
// coaches (on delete cascade) — see 0001_initial_schema.sql.
//
// Deploy: npx supabase functions deploy delete-user
// Called from the frontend via supabase.functions.invoke('delete-user', {...})
// which automatically forwards the caller's session JWT — checked below,
// before anything privileged, so a non-admin can never call this, and an
// admin can never delete someone outside their own academy.
// =============================================================================

import { createClient } from 'jsr:@supabase/supabase-js@2'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface DeleteUserBody {
  profile_id: string
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS })

  try {
    const body = (await req.json()) as DeleteUserBody
    if (!body.profile_id) return json({ error: 'profile_id is required' }, 400)

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
      return json({ error: 'Only an academy admin can remove accounts' }, 403)
    }

    if (body.profile_id === caller.id) {
      return json({ error: "You can't remove your own account this way" }, 400)
    }

    // Full privileges from here on — never exposed to the browser.
    const admin = createClient(supabaseUrl, serviceRoleKey)

    const { data: targetProfile } = await admin
      .from('profiles')
      .select('academy_id, role')
      .eq('id', body.profile_id)
      .single()

    if (!targetProfile || targetProfile.academy_id !== callerProfile.academy_id) {
      return json({ error: 'No such account in your academy' }, 404)
    }
    if (targetProfile.role !== 'coach') {
      return json({ error: 'This endpoint only removes coach accounts' }, 400)
    }

    const { error } = await admin.auth.admin.deleteUser(body.profile_id)
    if (error) return json({ error: error.message }, 500)

    return json({ ok: true })
  } catch {
    return json({ error: 'Unexpected error' }, 500)
  }
})
