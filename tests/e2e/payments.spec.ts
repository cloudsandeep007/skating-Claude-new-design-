import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { expect, test, type Page } from '@playwright/test'
import type { WebSocketLikeConstructor } from '@supabase/realtime-js'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import WebSocket from 'ws'

import type { Database } from '../../src/shared/types/database'

type Db = SupabaseClient<Database>

// End-to-end check of the payment ledger (audit Phase 1): record a payment
// through the real form and get a receipt number, void it with a reason,
// and see the fee's status and balance recalculate. Runs against the same
// Supabase project the dev server points at (.env / .env.local), using the
// seeded admin account, on a dedicated skater it creates for itself and
// leaves in a clean (unpaid) state at the end — so it can run repeatedly.
// Voided payments accumulate on that skater as history; that's the point
// of a ledger.

const PASSWORD = 'Password123!'
const ADMIN_EMAIL = 'admin@skating.test'
const SKATER_NAME = 'E2E Payments Skater'

function readEnv(): { url: string; anonKey: string } {
  const vars: Record<string, string> = {}
  for (const file of ['.env', '.env.local']) {
    let text = ''
    try {
      text = readFileSync(resolve(process.cwd(), file), 'utf8')
    } catch {
      continue
    }
    for (const line of text.split(/\r?\n/)) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line)
      if (m) vars[m[1]] = m[2].replace(/^["']|["']$/g, '')
    }
  }
  const url = vars.VITE_SUPABASE_URL
  const anonKey = vars.VITE_SUPABASE_ANON_KEY
  if (!url || !anonKey) throw new Error('VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY not found in .env')
  return { url, anonKey }
}

async function login(page: Page, email: string) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(PASSWORD)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL(/\/admin/)
}

interface Fixture {
  studentId: string
  feeId: string
  amount: number
}

/** Find-or-create the dedicated skater on a batch-scoped plan, make sure
 * it has exactly one open (unpaid) fee, and return it. */
async function prepareFixture(db: Db): Promise<Fixture> {
  const { data: auth, error: authError } = await db.auth.signInWithPassword({
    email: ADMIN_EMAIL,
    password: PASSWORD,
  })
  if (authError) throw new Error(`admin sign-in failed: ${authError.message}`)

  const { data: profile } = await db
    .from('profiles')
    .select('academy_id')
    .eq('id', auth.user.id)
    .single()
  const academyId = profile?.academy_id
  if (!academyId) throw new Error('admin profile has no academy')

  const { data: batch } = await db
    .from('batches')
    .select('id')
    .eq('academy_id', academyId)
    .eq('status', 'active')
    .order('name')
    .limit(1)
    .single()
  if (!batch) throw new Error('No active batch to enrol the e2e skater in')

  let { data: plan } = await db
    .from('fee_plans')
    .select('id')
    .eq('academy_id', academyId)
    .eq('name', 'E2E Monthly')
    .maybeSingle()
  if (!plan) {
    const inserted = await db
      .from('fee_plans')
      .insert({
        academy_id: academyId,
        name: 'E2E Monthly',
        amount: 1200,
        billing_cycle: 'monthly',
        pricing_mode: 'cycle',
        batch_id: batch.id,
      })
      .select('id')
      .single()
    if (inserted.error) throw inserted.error
    plan = inserted.data
  }

  let { data: student } = await db
    .from('students')
    .select('id')
    .eq('academy_id', academyId)
    .eq('full_name', SKATER_NAME)
    .maybeSingle()
  if (!student) {
    const inserted = await db
      .from('students')
      .insert({ academy_id: academyId, full_name: SKATER_NAME, fee_plan_id: plan.id })
      .select('id')
      .single()
    if (inserted.error) throw inserted.error
    student = inserted.data
    const enrol = await db
      .from('student_batches')
      .insert({ academy_id: academyId, student_id: student.id, batch_id: batch.id })
    if (enrol.error) throw enrol.error
  } else {
    await db.from('students').update({ fee_plan_id: plan.id, status: 'active' }).eq('id', student.id)
  }

  const gen = await db.rpc('generate_upcoming_fees', { p_academy_id: academyId })
  if (gen.error) throw gen.error

  const { data: fee } = await db
    .from('student_fees')
    .select('id, amount, payments(id, voided_at)')
    .eq('student_id', student.id)
    .order('period_start', { ascending: false })
    .limit(1)
    .single()
  if (!fee) throw new Error('No fee generated for the e2e skater')

  // A previous run that failed half-way may have left a live payment —
  // void it so the fee starts unpaid.
  for (const p of fee.payments) {
    if (p.voided_at === null) {
      const v = await db.rpc('void_payment', { p_payment_id: p.id, p_reason: 'e2e reset' })
      if (v.error) throw v.error
    }
  }

  return { studentId: student.id, feeId: fee.id, amount: fee.amount }
}

test.describe('payment ledger', () => {
  // The second test relies on the payment history the first one creates.
  test.describe.configure({ mode: 'serial' })

  let fixture: Fixture
  let db: Db

  test.beforeAll(async () => {
    const { url, anonKey } = readEnv()
    // Node 20 has no native WebSocket; supabase-js's realtime client insists
    // on one at construction even though this test never subscribes.
    db = createClient<Database>(url, anonKey, {
      auth: { persistSession: false },
      realtime: { transport: WebSocket as unknown as WebSocketLikeConstructor },
    })
    fixture = await prepareFixture(db)
  })

  test('record a payment (with receipt), then void it', async ({ page }) => {
    await login(page, ADMIN_EMAIL)
    await page.goto(`/admin/students/${fixture.studentId}`)
    await page.getByRole('tab', { name: /fees/i }).click()

    const feeCard = page.locator('li', { hasText: 'E2E Monthly' }).first()
    await expect(feeCard).toBeVisible()
    await expect(feeCard.getByText(/Pending|Overdue/)).toBeVisible()

    // Record the full balance through the form.
    await feeCard.getByRole('button', { name: 'Record payment' }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByText(/still owed/)).toBeVisible()
    await dialog.getByRole('button', { name: 'Record payment' }).click()

    // Receipt number on the toast and on the payment line; fee now Paid.
    const receipt = /[A-Z0-9]{2,4}-\d{4}-\d{6}/
    await expect(page.getByText(/Receipt [A-Z0-9]{2,4}-\d{4}-\d{6}/)).toBeVisible()
    await expect(feeCard.getByText(receipt).last()).toBeVisible()
    await expect(feeCard.getByText('Paid', { exact: true })).toBeVisible()

    // Void it with a reason: it stays on the record, crossed out, and the
    // fee goes back to unpaid.
    await feeCard.getByRole('button', { name: 'Void payment' }).click()
    const voidDialog = page.getByRole('dialog')
    await voidDialog.getByLabel('Reason').fill('e2e: recorded on the wrong skater')
    await voidDialog.getByRole('button', { name: 'Void payment' }).click()

    await expect(page.getByText('Payment voided.')).toBeVisible()
    await expect(feeCard.getByText('Voided — e2e: recorded on the wrong skater').last()).toBeVisible()
    await expect(feeCard.getByText(/Pending|Overdue/)).toBeVisible()
    await expect(feeCard.getByRole('button', { name: 'Void payment' })).toHaveCount(0)

    // The database agrees: no live payment, fee not paid.
    const { data: fee } = await db
      .from('student_fees')
      .select('status, payments(voided_at)')
      .eq('id', fixture.feeId)
      .single()
    expect(fee?.status).not.toBe('paid')
    const live = (fee?.payments ?? []).filter((p) => p.voided_at === null)
    expect(live).toHaveLength(0)
  })

  test('a period with payment history cannot be deleted', async ({ page }) => {
    await login(page, ADMIN_EMAIL)
    await page.goto(`/admin/students/${fixture.studentId}`)
    await page.getByRole('tab', { name: /fees/i }).click()

    const feeCard = page.locator('li', { hasText: 'E2E Monthly' }).first()
    await feeCard.getByRole('button', { name: 'Delete period' }).click()
    const dialog = page.getByRole('alertdialog')
    await expect(dialog.getByText("This period can't be deleted yet")).toBeVisible()
    await expect(dialog.getByRole('button', { name: 'Delete period' })).toHaveCount(0)
    await dialog.getByRole('button', { name: 'Got it' }).click()
  })
})
