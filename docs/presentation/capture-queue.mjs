// Shows the approvals queue with a real request in it, then restores state.
import { chromium, devices } from '@playwright/test'
import { fileURLToPath } from 'node:url'
const BASE = 'http://localhost:5183', PW = 'Password123!'
const OUT = fileURLToPath(new URL('./shots/', import.meta.url))
const browser = await chromium.launch()
async function login(page, email) {
  await page.goto(`${BASE}/login`); await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(PW); await page.getByRole('button', { name: 'Sign in' }).click()
  await page.waitForURL((u) => !u.pathname.startsWith('/login'))
}
// parent: free one confirmed class and request it again
let ctx = await browser.newContext({ ...devices['Pixel 5'], deviceScaleFactor: 2 })
let page = await ctx.newPage()
await login(page, 'ravi.bhat11@skating.test')
await page.goto(`${BASE}/parent/schedule`)
await page.getByRole('button', { name: 'Cancel', exact: true }).last().waitFor()
await page.getByRole('button', { name: 'Cancel', exact: true }).last().click()
await page.getByRole('button', { name: 'Cancel class' }).click()
await page.getByText(/back in your balance/).waitFor()
await page.getByRole('button', { name: 'Book', exact: true }).first().click()
await page.getByText(/coach will confirm/).waitFor()
await page.evaluate(() => window.scrollTo(0, 0))
await page.waitForTimeout(1500)
await page.screenshot({ path: `${OUT}parent-schedule-requested.png` })
await ctx.close()
// coach queue
ctx = await browser.newContext({ ...devices['Pixel 5'], deviceScaleFactor: 2 })
page = await ctx.newPage()
await login(page, 'coach1@skating.test')
await page.goto(`${BASE}/coach/bookings`); await page.waitForTimeout(2500)
await page.screenshot({ path: `${OUT}coach-bookings.png` })
await ctx.close()
// admin queue
ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
page = await ctx.newPage()
await login(page, 'admin@skating.test')
await page.goto(`${BASE}/admin/schedule/bookings`); await page.waitForTimeout(2500)
await page.screenshot({ path: `${OUT}admin-bookings.png` })
// approve it to restore the family's state
await page.getByRole('button', { name: /^Approve S1/ }).click()
await page.getByText(/confirmed for/).waitFor()
await ctx.close()
await browser.close()
console.log('queue shots done')
