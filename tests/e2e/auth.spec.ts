import { expect, test, type Page } from '@playwright/test'

// Uses the accounts created by supabase/seed.sql — run that against your
// Supabase project before running this test. See docs/RUNBOOK.md.
const PASSWORD = 'Password123!'

async function login(page: Page, email: string) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(PASSWORD)
  await page.getByRole('button', { name: 'Sign in' }).click()
}

test('super_admin lands on the dev console', async ({ page }) => {
  await login(page, 'super@skating.test')
  await expect(page).toHaveURL('/dev')
  await expect(page.getByText('Dev overview')).toBeVisible()
})

test('academy_admin lands on the admin dashboard', async ({ page }) => {
  await login(page, 'admin@skating.test')
  await expect(page).toHaveURL('/admin')
  await expect(page.getByText('Admin dashboard')).toBeVisible()
})

test('coach lands on the coach home', async ({ page }) => {
  await login(page, 'coach1@skating.test')
  await expect(page).toHaveURL('/coach')
  await expect(page.getByText('Coach home')).toBeVisible()
})

test('parent lands on the parent home', async ({ page }) => {
  await login(page, 'rajesh.sharma1@skating.test')
  await expect(page).toHaveURL('/parent')
  await expect(page.getByText('Parent home')).toBeVisible()
})
