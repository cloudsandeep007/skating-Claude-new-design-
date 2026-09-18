// Re-captures the screens that show announcements (after seed-announcements.mjs).
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
let ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
let page = await ctx.newPage()
await login(page, 'admin@skating.test')
await page.goto(`${BASE}/admin/announcements`); await page.waitForTimeout(2500)
await page.screenshot({ path: `${OUT}admin-announcements.png` })
await page.getByRole('button', { name: 'New announcement' }).click(); await page.waitForTimeout(800)
await page.getByPlaceholder('Rink closed this Sunday').fill('Diwali break — 8 to 12 November')
await page.getByLabel('Message').fill('No classes from 8 to 12 November. The regular schedule resumes on Friday 13 November. Happy Diwali from everyone at PRSA!')
await page.waitForTimeout(500)
await page.screenshot({ path: `${OUT}admin-announcement-dialog.png` })
await ctx.close()
ctx = await browser.newContext({ ...devices['Pixel 5'], deviceScaleFactor: 2 })
page = await ctx.newPage()
await login(page, 'ravi.bhat11@skating.test')
await page.waitForTimeout(2500); await page.screenshot({ path: `${OUT}parent-home.png` })
await page.goto(`${BASE}/parent/announcements`); await page.waitForTimeout(2500)
await page.screenshot({ path: `${OUT}parent-news.png` })
await ctx.close(); await browser.close(); console.log('news shots done')
