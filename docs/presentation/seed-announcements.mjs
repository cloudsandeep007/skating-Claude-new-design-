// Two realistic announcements so the demo screens are not empty.
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import WebSocket from 'ws'
const env = Object.fromEntries(readFileSync('../../.env', 'utf8').split(/\r?\n/).map(l => l.split('=')).filter(a => a.length === 2).map(([k, v]) => [k.trim(), v.trim().replace(/^["']|["']$/g, '')]))
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, { realtime: { transport: WebSocket } })
await sb.auth.signInWithPassword({ email: 'admin@skating.test', password: 'Password123!' })
const { data: { user } } = await sb.auth.getUser()
const { data: prof } = await sb.from('profiles').select('academy_id').eq('id', user.id).single()
const rows = [
  { title: 'Rink maintenance — Sunday 27 Sept', body: 'The rink is closed on Sunday 27 September for surface maintenance. Sunday classes move to Saturday 26 September at the usual time; make-up sessions are already on the schedule. Please book as normal.', audience: 'all' },
  { title: 'October term: top up before 30 Sept', body: 'Pay-per-class credits for the current term expire on 30 September. Top up at the front desk before then to carry unused classes forward into October.', audience: 'parents' },
]
for (const r of rows) {
  const { error } = await sb.from('announcements').insert({ academy_id: prof.academy_id, title: r.title, body: r.body, audience: r.audience, published_at: new Date().toISOString(), created_by: user.id })
  console.log(r.title, error?.message ?? 'ok')
}
await sb.rpc('publish_due_announcements')
process.exit(0)
