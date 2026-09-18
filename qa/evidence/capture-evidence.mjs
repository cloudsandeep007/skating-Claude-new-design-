import { chromium, devices } from '@playwright/test'
import { mkdirSync } from 'node:fs'

const BASE = 'http://localhost:5183'
const OUT = 'D:/Claude/Skatting - Copy/qa/evidence'
const PW = 'Password123!'
mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch()
const shots = []
async function shot(page, name) {
  const p = `${OUT}/${name}.png`
  await page.screenshot({ path: p, fullPage: false })
  shots.push(name)
}
async function login(page, email) {
  await page.goto(`${BASE}/login`)
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(PW)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.waitForURL(u => !u.pathname.startsWith('/login'))
}

// ---- Desktop admin ----
let ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } })
let page = await ctx.newPage()
await page.goto(`${BASE}/login`)
await page.getByRole('button', { name: 'Sign in' }).click()
await page.waitForTimeout(500)
await shot(page, 'TC-AUTH-002_login_empty_submit_validation')
await page.getByLabel('Email').fill('admin@skating.test')
await page.getByLabel('Password').fill('wrong-password')
await page.getByRole('button', { name: 'Sign in' }).click()
await page.waitForTimeout(2500)
await shot(page, 'TC-AUTH-004_login_wrong_password_generic_error')

await login(page, 'admin@skating.test')
await page.waitForTimeout(2500)
await shot(page, 'TC-DASH-001_admin_dashboard_desktop')

await page.goto(`${BASE}/admin/students`)
await page.waitForTimeout(2000)
await shot(page, 'TC-STU-001_students_list')

await page.goto(`${BASE}/admin/students/00000000-0000-4000-8000-000000000000`)
await page.waitForTimeout(4000)
await shot(page, 'BUG-001_student_invalid_id_endless_skeleton')

await page.goto(`${BASE}/admin/students/new`)
await page.waitForTimeout(1500)
await page.getByText('Existing parent', { exact: false }).first().click().catch(() => {})
await page.waitForTimeout(800)
await shot(page, 'BUG-003_add_student_existing_parent_no_picker')

await page.goto(`${BASE}/admin/fees`)
await page.waitForTimeout(2500)
await shot(page, 'BUG-010_fees_negative_balance_and_BUG-011_zero_paid_row')

await page.goto(`${BASE}/admin/fees?month=2026-10`)
await page.waitForTimeout(2500)
await shot(page, 'TC-FEE-010_fees_dashboard_oct_after_void')

await page.goto(`${BASE}/admin/students/aaf375a6-3cd8-4cd5-8a72-5ca833d682d0`)
await page.waitForTimeout(1500)
await page.getByRole('tab', { name: 'fees' }).click()
await page.waitForTimeout(1500)
await shot(page, 'TC-FEE-020_student_fees_tab_voided_qa_payment')
await page.getByRole('tab', { name: 'activity' }).click()
await page.waitForTimeout(1500)
await shot(page, 'TC-ACT-001_student_activity_trail')

await page.goto(`${BASE}/admin/schedule`)
await page.waitForTimeout(2000)
await shot(page, 'TC-SCH-001_week_calendar')
await page.goto(`${BASE}/admin/schedule/coming-up`)
await page.waitForTimeout(2000)
await shot(page, 'TC-SCH-010_coming_up_bookings')

await page.goto(`${BASE}/admin/reports`)
await page.waitForTimeout(2500)
await shot(page, 'TC-REP-001_reports_attendance')
await page.getByRole('tab', { name: 'Reconciliation' }).click()
await page.waitForTimeout(2500)
await shot(page, 'TC-REP-003_reports_reconciliation')

await page.goto(`${BASE}/admin/batches/new`)
await page.waitForTimeout(1000)
await page.getByRole('button', { name: 'Create batch' }).click()
await page.waitForTimeout(500)
await shot(page, 'TC-BAT-003_new_batch_empty_validation')

await page.goto(`${BASE}/this-route-does-not-exist`)
await page.waitForTimeout(1000)
await shot(page, 'TC-ERR-001_404_page')
await ctx.close()

// ---- Coach ----
ctx = await browser.newContext({ ...devices['Pixel 5'] })
page = await ctx.newPage()
await login(page, 'coach1@skating.test')
await page.waitForTimeout(2000)
await shot(page, 'TC-COACH-001_coach_home_mobile')
await page.goto(`${BASE}/coach/attendance/4540eb5e-4f4c-4b26-8ea9-136b978a5433`)
await page.waitForTimeout(2500)
await shot(page, 'TC-ATT-001_coach_mark_attendance_roster_mobile')
await page.goto(`${BASE}/admin`)
await page.waitForTimeout(1500)
await shot(page, 'TC-ROLE-002_coach_blocked_from_admin')
await ctx.close()

// ---- Parent ----
ctx = await browser.newContext({ ...devices['Pixel 5'] })
page = await ctx.newPage()
await login(page, 'ravi.bhat11@skating.test')
await page.waitForTimeout(2000)
await shot(page, 'TC-PAR-001_parent_home_mobile')
await page.goto(`${BASE}/parent/schedule`)
await page.waitForTimeout(2500)
await shot(page, 'TC-PAR-010_parent_schedule_book_cancel_mobile')
await page.goto(`${BASE}/parent/fees`)
await page.waitForTimeout(2500)
await shot(page, 'TC-PAR-020_parent_fees_mobile')
await page.goto(`${BASE}/admin/fees`)
await page.waitForTimeout(1500)
await shot(page, 'TC-ROLE-003_parent_blocked_from_admin')
await ctx.close()

// ---- Responsive admin ----
for (const [name, vp] of [['mobile', { width: 375, height: 812 }], ['tablet', { width: 768, height: 1024 }]]) {
  ctx = await browser.newContext({ viewport: vp })
  page = await ctx.newPage()
  await login(page, 'admin@skating.test')
  await page.goto(`${BASE}/admin/fees`)
  await page.waitForTimeout(2500)
  await shot(page, `TC-RESP-${name}_admin_fees`)
  await page.goto(`${BASE}/admin/schedule`)
  await page.waitForTimeout(2000)
  await shot(page, `TC-RESP-${name}_admin_schedule`)
  await ctx.close()
}

await browser.close()
console.log(JSON.stringify(shots, null, 2))
