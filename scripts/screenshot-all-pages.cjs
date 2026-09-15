// One-off script: logs in as each seeded role and screenshots every page.
// Not part of the app or the test suite — run with:
//   node scripts/screenshot-all-pages.cjs
// Requires the dev server already running (PORT env var, default 5183) and
// supabase/seed.sql applied to the linked project.
const { chromium } = require('@playwright/test')
const path = require('node:path')
const fs = require('node:fs')

const PORT = process.env.PORT || '5183'
const BASE_URL = `http://localhost:${PORT}`
const PASSWORD = 'Password123!'
const OUT_DIR = path.join(__dirname, '..', 'screenshots')

// Real seeded ids (looked up live) used for detail/edit pages that need one.
const IDS = {
  studentId: 'ce04cefb-8b54-9add-784d-985ef9c7182f', // Ira Sen
  coachId: '2270d3f2-fa30-d461-d506-8781dde7f2cb', // Karthik Menon
  batchId: '9ac642c9-ab9d-6b4a-f6c6-b67f3177c50f', // Weekend Juniors
}

const PAGES = {
  auth: [
    { path: '/login', name: 'login' },
    { path: '/forgot-password', name: 'forgot-password' },
  ],
  admin: [
    { path: '/admin', name: '01-dashboard' },
    { path: '/admin/students', name: '02-students-list' },
    { path: '/admin/students/new', name: '03-student-add' },
    { path: `/admin/students/${IDS.studentId}`, name: '04-student-detail' },
    { path: `/admin/students/${IDS.studentId}/edit`, name: '05-student-edit' },
    { path: '/admin/coaches', name: '06-coaches-list' },
    { path: '/admin/coaches/new', name: '07-coach-add' },
    { path: `/admin/coaches/${IDS.coachId}`, name: '08-coach-detail' },
    { path: `/admin/coaches/${IDS.coachId}/edit`, name: '09-coach-edit' },
    { path: '/admin/batches', name: '10-batches-list' },
    { path: '/admin/batches/new', name: '11-batch-add' },
    { path: `/admin/batches/${IDS.batchId}`, name: '12-batch-detail' },
    { path: `/admin/batches/${IDS.batchId}/edit`, name: '13-batch-edit' },
    { path: '/admin/schedule', name: '14-schedule' },
    { path: '/admin/attendance', name: '15-attendance' },
    { path: '/admin/progression', name: '16-progression' },
    { path: '/admin/levels', name: '17-levels-skills' },
    { path: '/admin/fees', name: '18-fees-dashboard' },
    { path: '/admin/fee-plans', name: '19-fee-plans' },
    { path: '/admin/announcements', name: '20-announcements' },
    { path: '/admin/reports', name: '21-reports' },
  ],
  coach: [
    { path: '/coach', name: '01-today' },
    { path: '/coach/inbox', name: '02-inbox' },
  ],
  parent: [
    { path: '/parent', name: '01-home' },
    { path: '/parent/progress', name: '02-progress' },
    { path: '/parent/schedule', name: '03-schedule' },
    { path: '/parent/attendance', name: '04-attendance' },
    { path: '/parent/fees', name: '05-fees' },
    { path: '/parent/announcements', name: '06-announcements' },
    { path: '/parent/profile', name: '07-profile' },
  ],
}

const LOGINS = {
  admin: { email: 'admin@skating.test', home: '/admin' },
  coach: { email: 'coach1@skating.test', home: '/coach' },
  parent: { email: 'anil.mehta7@skating.test', home: '/parent' },
}

async function login(page, email, home) {
  await page.goto(`${BASE_URL}/login`)
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(PASSWORD)
  await page.getByRole('button', { name: 'Sign in' }).click()
  // Wait for the actual post-login redirect, not just network idle —
  // a failed login (wrong password, slow auth) still goes network-idle
  // right on the login page, which silently poisoned every screenshot
  // after it last time.
  await page.waitForURL((url) => url.pathname.startsWith(home), { timeout: 15000 })
  await page.waitForLoadState('networkidle')
}

/** Waits past the "networked but not yet painted" gap that produced blank
 * white screenshots last run — networkidle only means requests finished,
 * not that React has committed real content to the DOM yet. */
async function waitForRealContent(page) {
  await page.waitForFunction(() => document.body.innerText.trim().length > 20, null, {
    timeout: 30000,
  })
  // Let layout/fonts/chart animations settle after content first appears.
  await page.waitForTimeout(700)
}

async function shootOnce(page, p, dest, expectSignedIn) {
  await page.goto(`${BASE_URL}${p}`, { waitUntil: 'networkidle', timeout: 20000 })
  await waitForRealContent(page)

  // Catch the exact bug from last time: a bounced/expired session
  // silently lands back on /login instead of the intended page, and every
  // screenshot after that is a duplicate of the login screen.
  const finalPath = new URL(page.url()).pathname
  if (expectSignedIn && (finalPath === '/login' || finalPath === '/')) {
    return { ok: false, reason: `redirected to ${finalPath} (not signed in / wrong route)` }
  }

  await page.screenshot({ path: dest, fullPage: true })

  // Verify what we just wrote isn't blank — an independent check catching
  // the exact "networkidle fired before paint" bug that slipped past
  // waitForRealContent's own DOM check last time.
  const bodyTextLength = await page.evaluate(() => document.body.innerText.trim().length)
  if (bodyTextLength < 20) {
    return { ok: false, reason: `page looks empty after render wait (${bodyTextLength} chars)` }
  }

  return { ok: true, finalPath, bodyTextLength }
}

async function shootGroup(page, groupDir, pages, { expectSignedIn = false } = {}) {
  fs.mkdirSync(groupDir, { recursive: true })
  const failures = []
  for (const { path: p, name } of pages) {
    const dest = path.join(groupDir, `${name}.png`)
    let result
    try {
      result = await shootOnce(page, p, dest, expectSignedIn)
      if (!result.ok) {
        console.log(`  retry ${p}: ${result.reason}`)
        await page.waitForTimeout(1000)
        result = await shootOnce(page, p, dest, expectSignedIn)
      }
    } catch (err) {
      console.log(`  FAIL ${p}: ${err.message.split('\n')[0]}`)
      failures.push(p)
      continue
    }

    if (result.ok) {
      console.log(`  ok  ${p} -> ${name}.png (landed on ${result.finalPath}, ${result.bodyTextLength} chars)`)
    } else {
      console.log(`  FAIL ${p}: ${result.reason} (after retry)`)
      failures.push(p)
    }
  }
  return failures
}

async function main() {
  const browser = await chromium.launch()
  const allFailures = []

  // Signed-out pages get their own clean context.
  const authContext = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const authPage = await authContext.newPage()
  console.log('Auth pages (signed out)...')
  allFailures.push(...(await shootGroup(authPage, path.join(OUT_DIR, 'auth'), PAGES.auth)))
  await authContext.close()

  // Each role gets its own fresh context (isolated storage) rather than
  // trying to sign out via the UI between roles.
  for (const role of ['admin', 'coach', 'parent']) {
    const { email, home } = LOGINS[role]
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
    const page = await context.newPage()
    console.log(`Logging in as ${role} (${email})...`)
    try {
      await login(page, email, home)
    } catch (err) {
      console.log(`  LOGIN FAILED for ${role}: ${err.message.split('\n')[0]}`)
      allFailures.push(`${role} login`)
      await context.close()
      continue
    }
    console.log(`${role} pages...`)
    allFailures.push(
      ...(await shootGroup(page, path.join(OUT_DIR, role), PAGES[role], { expectSignedIn: true })),
    )
    await context.close()
  }

  await browser.close()
  console.log(`\nDone. Screenshots saved under ${OUT_DIR}`)
  if (allFailures.length > 0) {
    console.log(`\n${allFailures.length} FAILURE(S):`)
    for (const f of allFailures) console.log(`  - ${f}`)
    process.exitCode = 1
  } else {
    console.log('All pages captured successfully.')
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
