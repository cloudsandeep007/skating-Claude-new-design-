// Captures the screenshots used by build-deck.mjs. Run from the repo root
// with the dev server on 5183:  node docs/presentation/capture.mjs
import { chromium, devices } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const BASE = 'http://localhost:5183'
const OUT = fileURLToPath(new URL('./shots/', import.meta.url))
const PW = 'Password123!'
mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch()

async function login(page, email) {
  await page.goto(`${BASE}/login`)
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(PW)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.waitForURL((u) => !u.pathname.startsWith('/login'))
}
async function shot(page, name, opts = {}) {
  await page.waitForTimeout(opts.wait ?? 2500)
  await page.screenshot({ path: `${OUT}${name}.png`, fullPage: false })
  console.log('shot', name)
}

// ---------- Admin (desktop) ----------
let ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 })
let page = await ctx.newPage()
await page.goto(`${BASE}/login`)
await shot(page, 'login', { wait: 1500 })
await login(page, 'admin@skating.test')
await shot(page, 'admin-dashboard', { wait: 4000 })
await page.goto(`${BASE}/admin/students`); await shot(page, 'admin-students')
await page.goto(`${BASE}/admin/students/fe3e680b-ba66-47db-805f-3b6ee12b79c3`)
await page.waitForTimeout(1500)
await page.getByRole('tab', { name: 'attendance' }).click(); await shot(page, 'admin-student-credits')
await page.getByRole('tab', { name: 'fees' }).click(); await shot(page, 'admin-student-fees')
await page.getByRole('tab', { name: 'activity' }).click(); await shot(page, 'admin-student-activity')
await page.goto(`${BASE}/admin/batches`); await shot(page, 'admin-batches')
await page.goto(`${BASE}/admin/batches/9ac642c9-ab9d-6b4a-f6c6-b67f3177c50f`).catch(() => {})
await page.goto(`${BASE}/admin/coaches/2270d3f2-fa30-d461-d506-8781dde7f2cb`); await shot(page, 'admin-coach-detail')
await page.goto(`${BASE}/admin/schedule`); await shot(page, 'admin-schedule')
await page.goto(`${BASE}/admin/schedule/coming-up`); await shot(page, 'admin-coming-up')
await page.goto(`${BASE}/admin/schedule/bookings`); await shot(page, 'admin-bookings')
await page.goto(`${BASE}/admin/attendance`); await shot(page, 'admin-attendance')
await page.goto(`${BASE}/admin/fees`); await shot(page, 'admin-fees')
await page.goto(`${BASE}/admin/fee-plans`); await shot(page, 'admin-fee-plans')
await page.goto(`${BASE}/admin/reports`); await shot(page, 'admin-reports-attendance', { wait: 3500 })
await page.getByRole('tab', { name: 'Reconciliation' }).click(); await shot(page, 'admin-reports-reconciliation', { wait: 3500 })
await page.goto(`${BASE}/admin/announcements`); await shot(page, 'admin-announcements')
await page.getByRole('button', { name: 'New announcement' }).click(); await shot(page, 'admin-announcement-dialog', { wait: 1000 })
await page.keyboard.press('Escape')
await page.goto(`${BASE}/admin/progression`); await shot(page, 'admin-progression')
await page.goto(`${BASE}/admin/levels`); await shot(page, 'admin-levels')
await ctx.close()

// ---------- Coach (phone) ----------
ctx = await browser.newContext({ ...devices['Pixel 5'], deviceScaleFactor: 2 })
page = await ctx.newPage()
await login(page, 'coach1@skating.test')
await shot(page, 'coach-today')
await page.goto(`${BASE}/coach/bookings`); await shot(page, 'coach-bookings')
await page.goto(`${BASE}/coach/attendance/4540eb5e-4f4c-4b26-8ea9-136b978a5433`); await shot(page, 'coach-mark')
await ctx.close()

// ---------- Parent (phone) ----------
ctx = await browser.newContext({ ...devices['Pixel 5'], deviceScaleFactor: 2 })
page = await ctx.newPage()
await login(page, 'ravi.bhat11@skating.test')
await shot(page, 'parent-home')
await page.goto(`${BASE}/parent/schedule`); await shot(page, 'parent-schedule')
await page.goto(`${BASE}/parent/fees`); await shot(page, 'parent-fees')
await page.goto(`${BASE}/parent/attendance`); await shot(page, 'parent-attendance')
await page.goto(`${BASE}/parent/announcements`); await shot(page, 'parent-news')
await ctx.close()

await browser.close()
console.log('done')
