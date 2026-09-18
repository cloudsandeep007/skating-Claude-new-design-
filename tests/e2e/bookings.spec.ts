import { expect, test, type Page } from '@playwright/test'

// End-to-end check of the booking approval workflow: a parent requests a
// class from the Schedule page, the coach sees it in Bookings and approves,
// and the parent's row flips to Confirmed. Uses the seeded family
// (ravi.bhat11 → "S1 pay per class", Beginner batch, coach1) and leaves
// the booking confirmed at the end, which is the state it started in.
//
// Needs: S1 on a credit plan with at least one credit, and a Beginner
// session inside the 7-day booking window (seed data + the schedule the
// admin keeps generated). Skips itself, with a reason, if neither is true.

const PASSWORD = 'Password123!'
const PARENT = 'ravi.bhat11@skating.test'
const COACH = 'coach1@skating.test'
const SKATER = 'S1 pay per class'

async function login(page: Page, email: string, landing: RegExp) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(PASSWORD)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL(landing)
}

async function logout(page: Page) {
  // Vite serves the app's own client module; importing it in the page is
  // the same sign-out the header button does, without hunting for the menu.
  await page.evaluate(async () => {
    const path = '/src/shared/lib/supabase.ts'
    const m = (await import(/* @vite-ignore */ path)) as {
      supabase: { auth: { signOut: () => Promise<unknown> } }
    }
    await m.supabase.auth.signOut()
  })
  await expect(page).toHaveURL(/\/login/)
}

test.describe('booking approval', () => {
  test('a parent request waits for the coach, who confirms it', async ({ page }) => {
    test.setTimeout(90_000)

    // --- Parent: find one bookable or already-confirmed class -------------
    await login(page, PARENT, /\/parent/)
    await page.goto('/parent/schedule')
    await expect(page.getByText('Class credits')).toBeVisible()

    // Make sure we are looking at S1.
    const selector = page.getByRole('combobox').first()
    if ((await selector.textContent())?.includes(SKATER) === false) {
      await selector.click()
      await page.getByRole('option', { name: SKATER }).click()
    }

    // Prefer a row we can Book; otherwise free one by cancelling a confirmed
    // booking (the credit comes straight back, so nothing is lost).
    const anyControl = page.getByRole('button', { name: /^(Book|Cancel)$/ }).first()
    await anyControl.waitFor({ state: 'visible', timeout: 15_000 }).catch(() => undefined)
    let bookButton = page.getByRole('button', { name: 'Book', exact: true }).first()
    if ((await bookButton.count()) === 0) {
      const cancel = page.getByRole('button', { name: 'Cancel', exact: true }).first()
      test.skip((await cancel.count()) === 0, 'No bookable Beginner class in the next 7 days')
      await cancel.click()
      // A confirmed place asks once before it is given up.
      await page.getByRole('button', { name: 'Cancel class' }).click()
      await expect(page.getByText(/back in your balance/)).toBeVisible()
      bookButton = page.getByRole('button', { name: 'Book', exact: true }).first()
    }
    // Pin the row by its date label — the Book button we found it by is
    // replaced by a status badge the moment the request goes through.
    const rowText = (await page.locator('li', { has: bookButton }).innerText()).split('\n')[0]
    const row = page.locator('li', { hasText: rowText }).first()
    await bookButton.click()

    await expect(page.getByText(/the coach will confirm shortly/)).toBeVisible()
    await expect(row.getByText('Awaiting approval')).toBeVisible()
    await expect(row.getByRole('button', { name: 'Withdraw' })).toBeVisible()

    await logout(page)

    // --- Coach: the request is waiting, approve it -----------------------
    await login(page, COACH, /\/coach/)
    await page.goto('/coach/bookings')
    await expect(page.getByRole('heading', { name: 'Bookings' })).toBeVisible()
    // The queue groups by session; pick the session we just requested.
    const session = page.locator('section', { hasText: rowText }).first()
    const request = session.locator('li', { hasText: SKATER }).first()
    await expect(request).toBeVisible()
    await request.getByRole('button', { name: `Approve ${SKATER}` }).click()
    await expect(page.getByText(/confirmed for/)).toBeVisible()

    await page.getByRole('button', { name: 'Decided' }).click()
    await expect(
      page
        .locator('section', { hasText: rowText })
        .first()
        .locator('li', { hasText: SKATER })
        .first()
        .getByText('Confirmed'),
    ).toBeVisible()

    await logout(page)

    // --- Parent: the row reads Confirmed ----------------------------------
    await login(page, PARENT, /\/parent/)
    await page.goto('/parent/schedule')
    const confirmedRow = page.locator('li', { hasText: rowText }).first()
    await expect(confirmedRow.getByText('Confirmed')).toBeVisible()
  })
})
