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
//   3. Expires the remaining class credits of any skater whose plan term
//      has ended without a renewal — expire_lapsed_credits(). Recorded as
//      a visible 'expire' line on the skater's credit statement.
//   4. Applies any advance a family holds to their open fees —
//      apply_all_advances().
//   5. Sends automatic fee / renewal reminders for academies that have
//      turned them on (settings.auto_fee_reminders) — run_auto_reminders().
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

    const { data: expiredCount, error: expireError } = await admin.rpc('expire_lapsed_credits')
    if (expireError) return json({ error: expireError.message }, 500)

    const { data: advanceApplied, error: advanceError } = await admin.rpc('apply_all_advances')
    if (advanceError) return json({ error: advanceError.message }, 500)

    const { data: reminders, error: reminderError } = await admin.rpc('run_auto_reminders')
    if (reminderError) return json({ error: reminderError.message }, 500)

    return json({
      generated: generated?.length ?? 0,
      markedOverdue: overdueCount ?? 0,
      creditsExpiredFor: expiredCount ?? 0,
      advanceApplied: advanceApplied ?? 0,
      reminders: reminders?.[0] ?? { fee_reminders: 0, renewal_reminders: 0 },
    })
  } catch {
    return json({ error: 'Unexpected error' }, 500)
  }
})
