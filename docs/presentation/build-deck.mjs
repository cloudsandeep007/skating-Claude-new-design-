// Builds PRSA_Client_Presentation.pptx from the screenshots in ./shots.
// Run from this folder:  node build-deck.mjs
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { existsSync } from 'node:fs'
const require = createRequire(import.meta.url)
const pptxgen = require('pptxgenjs')

const SHOTS = fileURLToPath(new URL('./shots/', import.meta.url))
const OUT = fileURLToPath(new URL('./PRSA_Client_Presentation.pptx', import.meta.url))

// Palette — lifted from the app itself (dark rink, cyan primary, coral alert).
const C = {
  bg: '0B1220',
  card: '121B2E',
  card2: '182338',
  line: '25324A',
  cyan: '22D3EE',
  cyanDeep: '0E7490',
  coral: 'FF5A5F',
  amber: 'F5B400',
  green: '34D399',
  text: 'F8FAFC',
  muted: '94A3B8',
  dim: '64748B',
}
const FONT = 'Arial'

const pres = new pptxgen()
pres.layout = 'LAYOUT_WIDE' // 13.33 x 7.5
pres.author = 'PRSA'
pres.title = 'PRSA Skating Academy — Academy Management Platform'

const W = 13.33
const H = 7.5
const M = 0.6 // margin

function base(opts = {}) {
  const s = pres.addSlide()
  s.background = { color: opts.bg ?? C.bg }
  if (opts.footer !== false) {
    s.addText('PRSA Skating Academy · Academy Management Platform', {
      x: M, y: H - 0.42, w: 8, h: 0.3, fontFace: FONT, fontSize: 9, color: C.dim, isTextBox: true, margin: 0,
    })
    s.addText(String(pres.slides.length), {
      x: W - M - 0.6, y: H - 0.42, w: 0.6, h: 0.3, fontFace: FONT, fontSize: 9, color: C.dim, align: 'right', isTextBox: true, margin: 0,
    })
  }
  return s
}

function title(s, text, sub, opts = {}) {
  s.addText(text, {
    x: M, y: 0.45, w: opts.w ?? W - 2 * M, h: 0.7, fontFace: FONT, fontSize: 30, bold: true, color: C.text,
    isTextBox: true, margin: 0,
  })
  if (sub) {
    s.addText(sub, {
      x: M, y: 1.12, w: opts.w ?? W - 2 * M, h: 0.4, fontFace: FONT, fontSize: 14, color: C.muted, isTextBox: true, margin: 0,
    })
  }
}

/** A screenshot in a rounded dark frame. Keeps the image's aspect ratio inside w×h. */
function shot(s, file, x, y, w, h, opts = {}) {
  const path = `${SHOTS}${file}.png`
  if (!existsSync(path)) {
    s.addText(`[missing: ${file}]`, { x, y, w, h, fontFace: FONT, fontSize: 12, color: C.coral, isTextBox: true })
    return
  }
  const ratio = opts.ratio ?? (file.startsWith('parent') || file.startsWith('coach') ? 786 / 1456 : 1440 / 900)
  let iw = w, ih = w / ratio
  if (ih > h) { ih = h; iw = h * ratio }
  const ix = x + (w - iw) / 2
  const iy = y + (h - ih) / 2
  const pad = 0.08
  s.addShape(pres.ShapeType.roundRect, {
    x: ix - pad, y: iy - pad, w: iw + 2 * pad, h: ih + 2 * pad, rectRadius: 0.12,
    fill: { color: C.card2 }, line: { color: C.line, width: 0.75 },
    shadow: { type: 'outer', color: '000000', blur: 12, offset: 4, angle: 90, opacity: 0.45 },
  })
  s.addImage({ path, x: ix, y: iy, w: iw, h: ih, rounding: !!opts.rounding })
  if (opts.caption) {
    s.addText(opts.caption, {
      x: ix, y: iy + ih + 0.12, w: iw, h: 0.3, fontFace: FONT, fontSize: 10, color: C.muted, align: 'center', isTextBox: true, margin: 0,
    })
  }
}

function bullets(s, items, x, y, w, h, opts = {}) {
  const arr = items.map((t, i) => ({
    text: t,
    options: { bullet: { indent: 14 }, breakLine: i < items.length - 1, paraSpaceAfter: opts.gap ?? 8 },
  }))
  s.addText(arr, {
    x, y, w, h, fontFace: FONT, fontSize: opts.size ?? 14, color: opts.color ?? C.text, valign: 'top',
    isTextBox: true, margin: 0,
  })
}

/** Icon-ish circle with a short glyph + bold header + one-line description. */
function featureRow(s, glyph, head, desc, x, y, w, opts = {}) {
  const d = 0.46
  s.addShape(pres.ShapeType.ellipse, {
    x, y: y + 0.02, w: d, h: d, fill: { color: opts.color ?? C.cyanDeep }, line: { color: opts.color ?? C.cyanDeep },
  })
  s.addText(glyph, {
    x, y: y + 0.02, w: d, h: d, fontFace: FONT, fontSize: 13, bold: true, color: C.text, align: 'center', valign: 'middle',
    isTextBox: true, margin: 0,
  })
  s.addText(head, {
    x: x + d + 0.18, y, w: w - d - 0.18, h: 0.28, fontFace: FONT, fontSize: 14, bold: true, color: C.text, isTextBox: true, margin: 0,
  })
  s.addText(desc, {
    x: x + d + 0.18, y: y + 0.28, w: w - d - 0.18, h: opts.descH ?? 0.5, fontFace: FONT, fontSize: 11.5, color: C.muted,
    isTextBox: true, margin: 0, valign: 'top',
  })
}

function card(s, x, y, w, h, opts = {}) {
  s.addShape(pres.ShapeType.roundRect, {
    x, y, w, h, rectRadius: 0.14, fill: { color: opts.fill ?? C.card }, line: { color: opts.line ?? C.line, width: 0.75 },
  })
}

function stat(s, value, label, x, y, w, opts = {}) {
  card(s, x, y, w, 1.55)
  s.addText(value, {
    x: x + 0.25, y: y + 0.18, w: w - 0.5, h: 0.8, fontFace: FONT, fontSize: opts.size ?? 40, bold: true,
    color: opts.color ?? C.cyan, isTextBox: true, margin: 0,
  })
  s.addText(label, {
    x: x + 0.25, y: y + 0.98, w: w - 0.5, h: 0.45, fontFace: FONT, fontSize: 11.5, color: C.muted, isTextBox: true, margin: 0,
  })
}

function pill(s, text, x, y, opts = {}) {
  const w = opts.w ?? text.length * 0.085 + 0.4
  s.addShape(pres.ShapeType.roundRect, {
    x, y, w, h: 0.32, rectRadius: 0.16, fill: { color: opts.fill ?? '0F2A33' }, line: { color: opts.line ?? C.cyanDeep, width: 0.75 },
  })
  s.addText(text, {
    x, y, w, h: 0.32, fontFace: FONT, fontSize: 10, bold: true, color: opts.color ?? C.cyan, align: 'center', valign: 'middle',
    isTextBox: true, margin: 0,
  })
  return w
}

// =====================================================================
// 1. Title
// =====================================================================
{
  const s = base({ footer: false })
  s.addShape(pres.ShapeType.ellipse, { x: 8.6, y: -1.6, w: 7.5, h: 7.5, fill: { color: '0F2A33' }, line: { color: '0F2A33' } })
  s.addShape(pres.ShapeType.ellipse, { x: 10.2, y: 0.2, w: 4.2, h: 4.2, fill: { color: '113B47' }, line: { color: '113B47' } })
  s.addText('PRSA', { x: M, y: 1.6, w: 6, h: 0.5, fontFace: FONT, fontSize: 16, bold: true, color: C.cyan, charSpacing: 6, isTextBox: true, margin: 0 })
  s.addText('Skating Academy\nManagement Platform', {
    x: M, y: 2.1, w: 8.5, h: 2.0, fontFace: FONT, fontSize: 44, bold: true, color: C.text, isTextBox: true, margin: 0, lineSpacingMultiple: 1.05,
  })
  s.addText('One app for the academy office, the coach at the rink, and every family — skaters, batches, schedule, bookings, attendance, fees and progress in one place.', {
    x: M, y: 4.25, w: 8.2, h: 1.0, fontFace: FONT, fontSize: 15, color: C.muted, isTextBox: true, margin: 0,
  })
  s.addText('Client presentation · September 2026', { x: M, y: 6.3, w: 6, h: 0.35, fontFace: FONT, fontSize: 11, color: C.dim, isTextBox: true, margin: 0 })
  s.addNotes('Opening: what the platform is in one sentence. Four roles, one system of record.')
}

// =====================================================================
// 2. Why
// =====================================================================
{
  const s = base()
  title(s, 'Running an academy today', 'What the office, the coach and the parent each struggle with — and what changes')
  const rows = [
    ['Registers and WhatsApp', 'Enrolment, attendance and who is coming are scattered across notebooks, chats and memory.', 'One roster, live counts, a schedule everyone sees.'],
    ['Cash book reconciliation', 'Receipts, partial payments, advances and refunds are hard to tie out at month-end.', 'Numbered receipts, an append-only payment ledger, a daily reconciliation report.'],
    ['Who actually turned up?', 'Pay-per-class families argue over how many classes are left.', 'A credit ledger driven by attendance — every class explained, line by line.'],
    ['Parents kept in the dark', 'Fee reminders, cancellations and confirmations go out by hand.', 'Parents see credits, bookings, fees and news on their phone, with notifications.'],
  ]
  s.addText('Today', { x: 4.55, y: 1.7, w: 4, h: 0.3, fontFace: FONT, fontSize: 11, bold: true, color: C.dim, isTextBox: true, margin: 0 })
  s.addText('With PRSA', { x: 8.75, y: 1.7, w: 4, h: 0.3, fontFace: FONT, fontSize: 11, bold: true, color: C.cyan, isTextBox: true, margin: 0 })
  rows.forEach(([h, a, b], i) => {
    const y = 2.1 + i * 1.15
    card(s, M, y, W - 2 * M, 1.0)
    s.addText(h, { x: M + 0.25, y: y + 0.12, w: 3.5, h: 0.76, fontFace: FONT, fontSize: 14, bold: true, color: C.text, valign: 'middle', isTextBox: true, margin: 0 })
    s.addText(a, { x: 4.55, y: y + 0.12, w: 3.9, h: 0.76, fontFace: FONT, fontSize: 11.5, color: C.muted, valign: 'middle', isTextBox: true, margin: 0 })
    s.addText(b, { x: 8.75, y: y + 0.12, w: 3.85, h: 0.76, fontFace: FONT, fontSize: 11.5, color: C.text, valign: 'middle', isTextBox: true, margin: 0 })
  })
}

// =====================================================================
// 3. Four roles
// =====================================================================
{
  const s = base()
  title(s, 'One platform, four roles', 'Each person sees only their own screens and their own data')
  const roles = [
    ['Academy admin', 'The office', ['Skaters, coaches, batches', 'Schedule & holidays', 'Fees, receipts, reports', 'Booking approvals', 'Announcements'], C.cyan],
    ['Coach', 'Rink-side, on a phone', ['Today’s sessions', 'Mark attendance', 'Approve booking requests', 'Assess skills', 'Inbox'], C.green],
    ['Parent', 'On a phone', ['Credits & expiry', 'Book classes', 'Fees & receipts', 'Attendance calendar', 'News & notifications'], C.amber],
    ['Super admin', 'Platform owner', ['Academies', 'Health & errors', 'Audit trail'], C.coral],
  ]
  const cw = (W - 2 * M - 3 * 0.3) / 4
  roles.forEach(([name, where, items, color], i) => {
    const x = M + i * (cw + 0.3)
    card(s, x, 1.8, cw, 4.9)
    s.addShape(pres.ShapeType.ellipse, { x: x + 0.3, y: 2.1, w: 0.6, h: 0.6, fill: { color }, line: { color } })
    s.addText(name[0], { x: x + 0.3, y: 2.1, w: 0.6, h: 0.6, fontFace: FONT, fontSize: 18, bold: true, color: C.bg, align: 'center', valign: 'middle', isTextBox: true, margin: 0 })
    s.addText(name, { x: x + 0.3, y: 2.85, w: cw - 0.6, h: 0.4, fontFace: FONT, fontSize: 17, bold: true, color: C.text, isTextBox: true, margin: 0 })
    s.addText(where, { x: x + 0.3, y: 3.25, w: cw - 0.6, h: 0.3, fontFace: FONT, fontSize: 11, color: C.muted, isTextBox: true, margin: 0 })
    bullets(s, items, x + 0.3, 3.75, cw - 0.6, 2.7, { size: 12.5, gap: 6 })
  })
}

// =====================================================================
// 4. At a glance
// =====================================================================
{
  const s = base()
  title(s, 'The platform at a glance')
  const gw = (W - 2 * M - 3 * 0.3) / 4
  const stats = [
    ['12', 'modules — from enrolment to reconciliation'],
    ['4', 'roles with separate apps and data access'],
    ['187', 'QA test cases executed in the browser'],
    ['130', 'automated tests run before every release'],
  ]
  stats.forEach(([v, l], i) => stat(s, v, l, M + i * (gw + 0.3), 1.7, gw))
  const feats = [
    ['Skaters & families', 'Profiles, parents, batches, levels, photos, activity trail'],
    ['Scheduling', 'Weekly calendar generated from batch days; holidays; extra & make-up sessions'],
    ['Bookings with approval', 'Parents request, coach or admin confirms; credit held until decided'],
    ['Attendance', 'One-tap marking on a phone; attendance is the source of truth for credits'],
    ['Fees & payments', 'Plans, calendar-aligned billing, receipts, partial payments, advances, voids'],
    ['Pay-per-class credits', 'Prepaid top-ups with a term and expiry; ledger explains every class'],
    ['Reports', 'Attendance, collection, reconciliation, progress, coach activity — CSV & PDF'],
    ['Communication', 'Announcements by audience; in-app notifications for every money and booking event'],
  ]
  feats.forEach(([h, d], i) => {
    const col = i % 2, row = Math.floor(i / 2)
    featureRow(s, String(i + 1), h, d, M + col * 6.2, 3.65 + row * 0.85, 5.9)
  })
}

// =====================================================================
// 5. Admin dashboard
// =====================================================================
{
  const s = base()
  title(s, 'Admin dashboard', 'Where the academy stands right now, and who needs a call today')
  shot(s, 'admin-dashboard', 5.2, 1.7, 7.55, 5.0)
  bullets(s, [
    'Active skaters, today’s attendance, fees collected this month and outstanding dues — with last-month comparisons',
    'Attendance trend, revenue collected vs expected, students per batch, skill distribution, retention, coach load',
    'Renewals due — pay-per-class terms ending within 7 days, with a one-tap reminder',
    'Needs attention — skaters under 60% attendance in the last 30 days',
    'Export the dashboard to PDF for the monthly committee meeting',
  ], M, 1.75, 4.3, 5, { size: 13, gap: 10 })
}

// =====================================================================
// 6. Skaters
// =====================================================================
{
  const s = base()
  title(s, 'Skaters & families', 'Everything about a skater on one profile — and every change recorded automatically')
  shot(s, 'admin-students', M, 1.7, 6.0, 3.75)
  shot(s, 'admin-student-activity', 6.85, 1.7, 5.9, 3.75)
  const items = [
    ['Search & filter', 'By name, batch, status; sort any column'],
    ['Add in one form', 'Skater, emergency contact, batch, level, fee plan, parent (invite or link)'],
    ['Profile tabs', 'Overview · Attendance & credits · Progress · Fees · Activity · Notes'],
    ['Activity trail', 'Fees, payments, bookings, attendance — who changed what, when'],
    ['Archive & restore', 'Leaving skaters keep their history; nothing is deleted'],
  ]
  items.forEach(([h, d], i) => featureRow(s, '✓', h, d, M + (i % 3) * 4.1, 5.65 + Math.floor(i / 3) * 0.75, 3.9, { descH: 0.4 }))
}

// =====================================================================
// 7. Batches & coaches
// =====================================================================
{
  const s = base()
  title(s, 'Batches & coaches', 'Timing, days, venue, capacity and a coach per batch')
  shot(s, 'admin-batches', M, 1.7, 6.0, 3.75)
  shot(s, 'admin-coach-detail', 6.85, 1.7, 5.9, 3.75)
  bullets(s, [
    'Batch = days of the week + start/end time + venue + capacity; enrolment is tracked against capacity',
    'Generate the schedule for any date range from the batch’s days — holidays skipped, coach clashes reported, existing sessions left alone',
    'Coaches are invited by email, assigned to batches, and see only their own sessions in the coach app',
    'Removing a batch is explicit and explained: sessions and attendance go with it; deactivating pauses it instead',
  ], M, 5.6, W - 2 * M, 1.4, { size: 12.5, gap: 5 })
}

// =====================================================================
// 8. Scheduling
// =====================================================================
{
  const s = base()
  title(s, 'Scheduling', 'A weekly calendar the office, the coach and the parents all read from')
  shot(s, 'admin-schedule', M, 1.7, 7.3, 4.6)
  shot(s, 'admin-coming-up', 8.2, 1.7, 4.55, 2.6)
  const items = [
    ['Week view', 'Booked and requested counts on every card'],
    ['Extra & make-up sessions', 'Cancelled classes get a linked make-up'],
    ['Holidays', 'Dates the generator skips'],
    ['Coming up', 'Who has booked in the next 7 days'],
  ]
  items.forEach(([h, d], i) => featureRow(s, String(i + 1), h, d, 8.2, 4.5 + i * 0.62, 4.55, { descH: 0.3 }))
}

// =====================================================================
// 9. Booking approvals
// =====================================================================
{
  const s = base()
  title(s, 'Bookings with approval', 'A parent requests a class; the batch coach or the office confirms it')
  shot(s, 'parent-schedule-requested', M, 1.7, 2.75, 5.0, { caption: 'Parent: “Awaiting approval”' })
  shot(s, 'coach-bookings', 3.6, 1.7, 2.75, 5.0, { caption: 'Coach: approve or decline' })
  shot(s, 'admin-bookings', 6.6, 1.7, 6.15, 3.7, { caption: 'Admin: the whole academy’s queue' })
  bullets(s, [
    'Credit is held at request time, returned if declined or withdrawn',
    'Decline with a reason the parent sees; “Approve all” per session',
    'Everyone sees the status: Requested · Confirmed · Declined',
    'Attendance still wins — a request marked present is confirmed',
  ], 6.65, 6.0, 6.1, 1.05, { size: 11, gap: 2 })
}

// =====================================================================
// 10. Attendance
// =====================================================================
{
  const s = base()
  title(s, 'Attendance at the rink', 'One tap per skater on the coach’s phone — and it drives the credits')
  shot(s, 'coach-today', M, 1.7, 2.75, 5.05, { caption: 'Coach: today’s sessions' })
  shot(s, 'coach-mark', 3.55, 1.7, 2.75, 5.05, { caption: 'Tap to mark, confirm once' })
  const rules = [
    ['Booked · present', 'Credit spent (already held at booking)', C.green],
    ['Booked · absent', 'Credit returned to the family', C.amber],
    ['Not booked · present', 'Walk-in: one credit spent', C.cyan],
    ['Never marked', 'Released when the session is closed', C.dim],
  ]
  s.addText('Credit rules', { x: 6.65, y: 1.7, w: 3.0, h: 0.3, fontFace: FONT, fontSize: 12, bold: true, color: C.muted, isTextBox: true, margin: 0 })
  rules.forEach(([h, d, color], i) => {
    const y = 2.1 + i * 0.8
    card(s, 6.65, y, 3.0, 0.68)
    s.addShape(pres.ShapeType.ellipse, { x: 6.8, y: y + 0.22, w: 0.24, h: 0.24, fill: { color }, line: { color } })
    s.addText(h, { x: 7.15, y: y + 0.08, w: 2.45, h: 0.26, fontFace: FONT, fontSize: 11.5, bold: true, color: C.text, isTextBox: true, margin: 0 })
    s.addText(d, { x: 7.15, y: y + 0.34, w: 2.45, h: 0.3, fontFace: FONT, fontSize: 9.5, color: C.muted, isTextBox: true, margin: 0 })
  })
  s.addText('How it works', { x: 9.95, y: 1.7, w: 2.8, h: 0.3, fontFace: FONT, fontSize: 12, bold: true, color: C.muted, isTextBox: true, margin: 0 })
  bullets(s, [
    'Roster shows Booked / Requested / Not booked per skater',
    '“Mark all present”, then tap the exceptions',
    'Works offline — marks queue on the phone and save when the signal returns',
    'Yesterday stays open for corrections; older sessions are locked',
    'Admin sees attendance by date, batch or skater',
  ], 9.95, 2.1, 2.8, 4.6, { size: 11, gap: 8 })
}

// =====================================================================
// 11. Credits & ledger
// =====================================================================
{
  const s = base()
  title(s, 'Class credits, explained line by line', 'Pay-per-class families buy classes in blocks; the ledger shows where each one went')
  shot(s, 'admin-student-credits', 5.0, 1.7, 7.75, 5.0)
  const items = [
    ['Prepaid top-ups', 'Blocks of classes at the batch rate; minimum 8 / 24 / 96 for monthly, quarterly, annual'],
    ['A term with an expiry', 'Credits are valid till the term ends; renew before then to carry unused classes forward'],
    ['Append-only ledger', 'Bought · spent · returned · expired · adjusted — every line with who and why'],
    ['No negative surprises', 'A void that would take back used credits shows the consequence first (clawback preview)'],
  ]
  items.forEach(([h, d], i) => featureRow(s, String(i + 1), h, d, M, 1.8 + i * 1.2, 4.2, { descH: 0.75 }))
}

// =====================================================================
// 12. Fees dashboard
// =====================================================================
{
  const s = base()
  title(s, 'Fees & billing', 'Plans, calendar-aligned periods, and a dashboard that answers “who owes what”')
  shot(s, 'admin-fees', M, 1.7, 7.3, 4.6)
  shot(s, 'admin-fee-plans', 8.2, 1.7, 4.55, 2.6)
  const items = [
    ['Fee plans', 'Flat cycle (monthly / quarterly / annual) or per-class; scoped to a batch'],
    ['Billing that can’t stop', 'Generated ahead, pro-rated for mid-month joins, re-priced when a plan changes'],
    ['Collected · Pending · Overdue', 'Month picker, batch and status filters, CSV export, bulk reminders'],
  ]
  items.forEach(([h, d], i) => featureRow(s, String(i + 1), h, d, 8.2, 4.45 + i * 0.85, 4.55, { descH: 0.55 }))
}

// =====================================================================
// 13. Payments ledger
// =====================================================================
{
  const s = base()
  title(s, 'Payments you can trust', 'Numbered receipts, partial payments, advances and voids — nothing is ever deleted')
  shot(s, 'admin-student-fees', 5.0, 1.7, 7.75, 5.0)
  const items = [
    ['Receipt numbers', 'PRSA-2026-000027 — sequential per year; the parent gets the receipt as a notification'],
    ['Partial & overpayment', 'Pay in parts; extra is kept as an advance and applied to the next fee (or “Apply now”)'],
    ['Void, never delete', 'A wrong entry is crossed out with a reason; status and balance recalculate'],
    ['Waive with a reason', 'Sibling discounts and hardship cases are recorded, not hidden'],
  ]
  items.forEach(([h, d], i) => featureRow(s, '₹', h, d, M, 1.8 + i * 1.2, 4.2, { descH: 0.75 }))
}

// =====================================================================
// 14. Reports
// =====================================================================
{
  const s = base()
  title(s, 'Reports & month-end reconciliation', 'Five reports, any date range, CSV and PDF')
  shot(s, 'admin-reports-reconciliation', M, 1.7, 7.3, 4.6)
  shot(s, 'admin-reports-attendance', 8.2, 1.7, 4.55, 2.6)
  const items = [
    ['Reconciliation', 'Per day: cash / UPI / card / bank / cheque, receipt range, voided, advances'],
    ['Attendance & fee collection', 'Per skater, per batch, for any range'],
    ['Progress & coach activity', 'Skills achieved, sessions taken, attendance per coach'],
  ]
  items.forEach(([h, d], i) => featureRow(s, String(i + 1), h, d, 8.2, 4.45 + i * 0.85, 4.55, { descH: 0.55 }))
}

// =====================================================================
// 15. Announcements
// =====================================================================
{
  const s = base()
  title(s, 'Announcements & notifications', 'Reach everyone, only parents, only coaches, or one batch')
  shot(s, 'admin-announcement-dialog', M, 1.7, 7.3, 4.6)
  shot(s, 'parent-news', 8.3, 1.7, 2.6, 4.8, { caption: 'Parent: News tab' })
  const notif = [
    'Payment received (with receipt no.)',
    'Fee due / overdue reminders (opt-in, nightly)',
    'Plan term ending — renew',
    'Booking confirmed / declined',
    'Session cancelled · make-up scheduled',
    'New announcement',
  ]
  s.addText('Automatic notifications', { x: 11.15, y: 1.7, w: 1.6, h: 0.5, fontFace: FONT, fontSize: 11, bold: true, color: C.muted, isTextBox: true, margin: 0 })
  bullets(s, notif, 11.15, 2.25, 1.65, 4.4, { size: 10, gap: 6 })
}

// =====================================================================
// 16. Progression
// =====================================================================
{
  const s = base()
  title(s, 'Skill progression', 'A ladder of levels and skills the coach assesses from the roster')
  shot(s, 'admin-progression', M, 1.7, 6.0, 3.75)
  shot(s, 'admin-levels', 6.85, 1.7, 5.9, 3.75)
  bullets(s, [
    'Levels & skills are the academy’s own — add, rename, reorder by drag',
    'Coach taps “Assess skills” on any skater from the attendance roster; achievements are dated',
    'Dashboard shows the distribution across levels and who hasn’t progressed in 60 days',
    'Parents see their child’s level and achievements on the Progress tab',
  ], M, 5.6, W - 2 * M, 1.4, { size: 12.5, gap: 5 })
}

// =====================================================================
// 17. Parent app (1)
// =====================================================================
{
  const s = base()
  title(s, 'The parent app', 'Phone-first. Credits, bookings and fees at a glance')
  shot(s, 'parent-home', M, 1.7, 2.75, 5.05, { caption: 'Home' })
  shot(s, 'parent-schedule', 3.65, 1.7, 2.75, 5.05, { caption: 'Schedule & bookings' })
  shot(s, 'parent-fees', 6.7, 1.7, 2.75, 5.05, { caption: 'Fees' })
  const items = [
    ['Credits & expiry', 'Classes left and the date they expire, on every screen that matters'],
    ['Book in seconds', 'This week / next week; Book, Withdraw, Cancel; see Requested → Confirmed'],
    ['Fees, simply', '“Due now” or “All paid up”, current period, top-ups, last receipt; older periods folded away'],
  ]
  items.forEach(([h, d], i) => featureRow(s, String(i + 1), h, d, 9.85, 1.8 + i * 1.5, 2.9, { descH: 1.0 }))
}

// =====================================================================
// 18. Parent app (2)
// =====================================================================
{
  const s = base()
  title(s, 'The parent app', 'Attendance as a calendar, news that reaches them, one login for every child')
  shot(s, 'parent-attendance', M, 1.7, 2.75, 5.05, { caption: 'Attendance calendar' })
  shot(s, 'parent-news', 3.65, 1.7, 2.75, 5.05, { caption: 'News & notifications' })
  const items = [
    ['Month at a glance', 'A dot per class — present, late, absent, not marked; tap a day for detail'],
    ['Family login', 'Switch between children; each has their own credits, bookings and fees'],
    ['Profile', 'Update phone, change password'],
    ['Only their own data', 'Row-level security in the database — a parent can never see another family'],
  ]
  items.forEach(([h, d], i) => featureRow(s, String(i + 1), h, d, 6.75, 1.8 + i * 1.2, 6.0, { descH: 0.7 }))
}

// =====================================================================
// 19. Security & trust
// =====================================================================
{
  const s = base()
  title(s, 'Built for trust', 'The rules live in the database, not just on the screen')
  const items = [
    ['Role-based access', 'Admin, coach, parent and platform owner each get their own app; the wrong URL shows a 403.', C.cyan],
    ['Row-level security', 'Every table is fenced by academy and by role — a parent’s query only ever returns their children.', C.cyan],
    ['Append-only money', 'Payments are never edited or deleted; voids keep the record with a reason. Fee status is derived, never typed.', C.green],
    ['Ledgers for credits & advances', 'Class credits and advance balances are sums of dated, attributed lines.', C.green],
    ['Audit trail', 'Every change to a skater’s fees, payments, bookings and attendance is logged automatically and shown on the Activity tab.', C.amber],
    ['Guards in the database', 'A payment can’t be dated in the future; a booking can’t exceed the window; a fee can’t be flipped to paid by hand.', C.amber],
  ]
  items.forEach(([h, d, color], i) => {
    const col = i % 2, row = Math.floor(i / 2)
    const x = M + col * 6.2, y = 1.85 + row * 1.6
    card(s, x, y, 5.9, 1.4)
    s.addShape(pres.ShapeType.ellipse, { x: x + 0.25, y: y + 0.25, w: 0.5, h: 0.5, fill: { color }, line: { color } })
    s.addText(String(i + 1), { x: x + 0.25, y: y + 0.25, w: 0.5, h: 0.5, fontFace: FONT, fontSize: 14, bold: true, color: C.bg, align: 'center', valign: 'middle', isTextBox: true, margin: 0 })
    s.addText(h, { x: x + 0.95, y: y + 0.2, w: 4.7, h: 0.3, fontFace: FONT, fontSize: 14, bold: true, color: C.text, isTextBox: true, margin: 0 })
    s.addText(d, { x: x + 0.95, y: y + 0.52, w: 4.7, h: 0.8, fontFace: FONT, fontSize: 11, color: C.muted, isTextBox: true, margin: 0, valign: 'top' })
  })
}

// =====================================================================
// 20. Automation
// =====================================================================
{
  const s = base()
  title(s, 'It runs itself overnight', 'A scheduled job keeps billing, credits and reminders current without anyone logging in')
  const steps = [
    ['Generate fees', 'Next period for every skater, 7 days ahead, pro-rated'],
    ['Mark overdue', 'Past the grace period → overdue, in the academy’s timezone'],
    ['Expire lapsed credits', 'Unused classes on an ended term are expired, with a ledger line'],
    ['Apply advances', 'Money paid ahead goes onto the open fee'],
    ['Send reminders', 'Fee due, overdue, renewal — opt-in, never more than weekly per family'],
  ]
  const sw = (W - 2 * M - 4 * 0.25) / 5
  steps.forEach(([h, d], i) => {
    const x = M + i * (sw + 0.25)
    card(s, x, 2.0, sw, 2.4)
    s.addShape(pres.ShapeType.ellipse, { x: x + 0.25, y: 2.25, w: 0.5, h: 0.5, fill: { color: C.cyan }, line: { color: C.cyan } })
    s.addText(String(i + 1), { x: x + 0.25, y: 2.25, w: 0.5, h: 0.5, fontFace: FONT, fontSize: 14, bold: true, color: C.bg, align: 'center', valign: 'middle', isTextBox: true, margin: 0 })
    s.addText(h, { x: x + 0.25, y: 2.9, w: sw - 0.5, h: 0.45, fontFace: FONT, fontSize: 13, bold: true, color: C.text, isTextBox: true, margin: 0 })
    s.addText(d, { x: x + 0.25, y: 3.35, w: sw - 0.5, h: 0.95, fontFace: FONT, fontSize: 10.5, color: C.muted, isTextBox: true, margin: 0, valign: 'top' })
  })
  s.addText('Academy settings the office can change without a developer', { x: M, y: 4.8, w: W - 2 * M, h: 0.35, fontFace: FONT, fontSize: 13, bold: true, color: C.muted, isTextBox: true, margin: 0 })
  const settings = ['Timezone & currency', 'Fee lead & grace days', 'Receipt prefix', 'Top-up minimums (8 / 24 / 96)', 'Booking window (days)', 'Booking approval on / off', 'Auto-reminders & days before']
  let px = M, py = 5.3
  settings.forEach((t) => {
    const w = t.length * 0.085 + 0.4
    if (px + w > W - M) { px = M; py += 0.45 }
    px += pill(s, t, px, py) + 0.15
  })
}

// =====================================================================
// 21. Quality
// =====================================================================
{
  const s = base()
  title(s, 'Tested like a product, not a prototype', 'A full QA cycle was executed in the browser, every defect fixed and re-verified')
  const gw = (W - 2 * M - 3 * 0.3) / 4
  stat(s, '187', 'test cases executed across every module and role', M, 1.7, gw)
  stat(s, '21 → 0', 'defects found → open after the fix cycle', M + (gw + 0.3), 1.7, gw, { color: C.green, size: 34 })
  stat(s, '122', 'unit tests on the business rules', M + 2 * (gw + 0.3), 1.7, gw)
  stat(s, '8', 'end-to-end browser tests (login, payments, bookings)', M + 3 * (gw + 0.3), 1.7, gw)
  s.addChart(pres.ChartType.bar, [
    { name: 'Test cases', labels: ['Pass', 'Blocked (email config)', 'Not run (out of scope)'], values: [152, 2, 33] },
  ], {
    x: M, y: 3.55, w: 6.2, h: 3.2, barDir: 'bar',
    chartColors: [C.cyan], showLegend: false, showTitle: true, title: 'Outcome of the 187 cases', titleColor: C.text, titleFontSize: 12, titleFontFace: FONT,
    showValue: true, dataLabelPosition: 'outEnd', dataLabelColor: C.text, dataLabelFontSize: 11, dataLabelFontFace: FONT,
    catAxisLabelColor: C.muted, valAxisLabelColor: C.dim, catAxisLabelFontFace: FONT, valAxisLabelFontFace: FONT,
    catAxisLabelFontSize: 11, valAxisLabelFontSize: 9, catAxisOrientation: 'maxMin', valGridLine: { color: C.line, size: 0.5 }, catGridLine: { style: 'none' },
    plotArea: { fill: { color: C.card } }, chartArea: { fill: { color: C.card }, roundedCorners: true },
  })
  bullets(s, [
    'Smoke, functional, negative, boundary, role isolation, responsive (375 / 768 / 1280), error handling, regression',
    'Money rules proven end to end: partial payments, overpay cap, voids, receipts, reconciliation all matched the ledger',
    'Credits verified in the ledger for every attendance transition',
    'Typecheck, lint, unit and browser tests must be green before any release',
  ], 7.1, 3.6, 5.65, 3.2, { size: 12, gap: 8 })
}

// =====================================================================
// 22. Maintainable
// =====================================================================
{
  const s = base()
  title(s, 'Built to be maintained', 'Modern, mainstream stack — and documentation written for a non-technical owner')
  const stack = [
    ['Web app', 'React 18 · TypeScript · Vite · Tailwind'],
    ['Data & auth', 'Supabase (Postgres, row-level security, storage)'],
    ['Server logic', '34 versioned database migrations; nightly Edge Function'],
    ['Quality', 'Vitest · Playwright · ESLint · strict TypeScript · Sentry'],
  ]
  stack.forEach(([h, d], i) => {
    const y = 1.85 + i * 1.05
    card(s, M, y, 5.9, 0.9)
    s.addText(h, { x: M + 0.25, y: y + 0.12, w: 1.9, h: 0.66, fontFace: FONT, fontSize: 13, bold: true, color: C.cyan, valign: 'middle', isTextBox: true, margin: 0 })
    s.addText(d, { x: M + 2.2, y: y + 0.12, w: 3.5, h: 0.66, fontFace: FONT, fontSize: 12, color: C.text, valign: 'middle', isTextBox: true, margin: 0 })
  })
  s.addText('Documentation that ships with the code', { x: 7.0, y: 1.85, w: 5.7, h: 0.35, fontFace: FONT, fontSize: 14, bold: true, color: C.text, isTextBox: true, margin: 0 })
  bullets(s, [
    'RUNBOOK — step-by-step operations: settings, month-end, email provider, approvals',
    'CHANGELOG — every change in plain language, dated',
    'DECISIONS — why each rule works the way it does, with the alternatives considered',
    'DATA-MODEL — every table, column and policy',
    'Feature guides — screens, rules, edge cases and known limits per module',
    'QA pack — test plan, 187 cases, execution report, readiness report (PDF)',
  ], 7.0, 2.3, 5.7, 3.6, { size: 12, gap: 8 })
}

// =====================================================================
// 23. Next steps
// =====================================================================
{
  const s = base()
  title(s, 'Go-live plan', 'What happens between today and the first family logging in')
  const steps = [
    ['1', 'Configure email', 'Custom SMTP provider in Supabase so invites and reminders are not rate-limited (the only open item from QA)'],
    ['2', 'Load the academy', 'Batches, coaches, fee plans, levels & skills; import skaters and parents; set timezone, receipt prefix and minimums'],
    ['3', 'Pilot with one batch', 'Two weeks: coach marks attendance, parents book, office records fees; adjust settings'],
    ['4', 'Roll out', 'Invite every family; announce through the app; switch reminders on'],
    ['5', 'Hand over', 'Owner walkthrough of the RUNBOOK; monthly reconciliation routine; support contact'],
  ]
  steps.forEach(([n, h, d], i) => {
    const y = 1.8 + i * 1.0
    s.addShape(pres.ShapeType.ellipse, { x: M, y: y + 0.08, w: 0.6, h: 0.6, fill: { color: C.cyan }, line: { color: C.cyan } })
    s.addText(n, { x: M, y: y + 0.08, w: 0.6, h: 0.6, fontFace: FONT, fontSize: 16, bold: true, color: C.bg, align: 'center', valign: 'middle', isTextBox: true, margin: 0 })
    s.addText(h, { x: M + 0.85, y, w: 3.2, h: 0.75, fontFace: FONT, fontSize: 16, bold: true, color: C.text, valign: 'middle', isTextBox: true, margin: 0 })
    s.addText(d, { x: M + 4.2, y, w: W - 2 * M - 4.2, h: 0.75, fontFace: FONT, fontSize: 12.5, color: C.muted, valign: 'middle', isTextBox: true, margin: 0 })
    if (i < steps.length - 1) {
      s.addShape(pres.ShapeType.line, { x: M + 0.3, y: y + 0.7, w: 0, h: 0.3, line: { color: C.line, width: 1 } })
    }
  })
}

// =====================================================================
// 24. Close
// =====================================================================
{
  const s = base({ footer: false })
  s.addShape(pres.ShapeType.ellipse, { x: -2.5, y: 2.5, w: 7, h: 7, fill: { color: '0F2A33' }, line: { color: '0F2A33' } })
  s.addText('Thank you', { x: M, y: 2.4, w: 10, h: 1.0, fontFace: FONT, fontSize: 44, bold: true, color: C.text, isTextBox: true, margin: 0 })
  s.addText('Questions, a live walkthrough, or a pilot batch — whenever you are ready.', { x: M, y: 3.5, w: 9, h: 0.6, fontFace: FONT, fontSize: 16, color: C.muted, isTextBox: true, margin: 0 })
  s.addText('PRSA · Skating Academy Management Platform', { x: M, y: 6.3, w: 8, h: 0.35, fontFace: FONT, fontSize: 11, color: C.dim, isTextBox: true, margin: 0 })
}

await pres.writeFile({ fileName: OUT })
console.log('wrote', OUT, 'slides:', pres.slides.length)
