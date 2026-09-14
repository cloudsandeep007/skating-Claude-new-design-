// Edge Function: generate-fees
// =============================================================================
// The scheduled job for fee management. On a cron (set up in the Supabase
// Dashboard — see docs/RUNBOOK.md "Scheduled jobs"), this:
//   1. Generates the coming period's student_fees for every academy, for
//      every active student on a fee plan whose current period has ended
//      (or who has none yet) — generate_upcoming_fees() with no academy
//      filter, run with the service-role key so it isn't scoped to one
//      admin's academy.
//   2. Flips any pending fee whose due date has passed to 'overdue' —
//      mark_fees_overdue(), same reasoning.
//
// Both RPCs are SECURITY INVOKER; it's the service-role key (which bypasses
// RLS) that lets this one call cover every academy in one run. An admin's
// "Generate now" button in the app calls the same generate_upcoming_fees()
// RPC directly with their own session — RLS then naturally scopes it to
// their academy alone, so that path doesn't need this function at all.
//
// Deploy: npx supabase functions deploy generate-fees
//
// IMPORTANT: this function runs with full service-role privileges across
// every academy, so it must NOT be reachable by an ordinary caller.
// Supabase's default JWT verification only checks that *some* valid
// project JWT was presented — the public anon key and any logged-in
// user's session token both pass that check just as well as the
// service-role key would. So this function additionally requires the
// Authorization header to be the exact service-role key, which only a
// trusted caller (Supabase's own Cron trigger, or you invoking it by
// hand with that key) would ever have.
// =============================================================================

import { createClient } from 'jsr:@supabase/supabase-js@2'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // Only the service-role key itself may call this — see the note above.
    const authHeader = req.headers.get('Authorization') ?? ''
    if (authHeader !== `Bearer ${serviceRoleKey}`) {
      return json({ error: 'Not permitted' }, 403)
    }

    const admin = createClient(supabaseUrl, serviceRoleKey)

    const { data: generated, error: genError } = await admin.rpc('generate_upcoming_fees')
    if (genError) return json({ error: genError.message }, 500)

    const { data: overdueCount, error: overdueError } = await admin.rpc('mark_fees_overdue')
    if (overdueError) return json({ error: overdueError.message }, 500)

    return json({
      generated: generated?.length ?? 0,
      markedOverdue: overdueCount ?? 0,
    })
  } catch {
    return json({ error: 'Unexpected error' }, 500)
  }
})
