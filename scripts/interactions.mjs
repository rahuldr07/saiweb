/**
 * Drives the parts of the application that only exist at runtime: navigation
 * between a register and its detail screen, form validation, and the writes that
 * are supposed to leave a trace.
 *
 *   npm run build && npm run preview &
 *   npm run check
 *
 * `npm run smoke` proves every route renders something. This proves the things
 * it renders actually do what they claim — the two answer different questions,
 * and a screen can pass the first while being inert.
 *
 * Assertions match case-insensitively on purpose: the stylesheet uppercases KPI
 * titles and table headings, and `innerText` returns rendered text, so a
 * case-sensitive check here fails on styling rather than on behaviour.
 */
import { chromium } from 'playwright'

const BASE = process.env.SMOKE_URL ?? 'http://localhost:4173'

/* `--single-process` is the fallback for sandboxes that cannot spawn the usual
   multi-process browser. It also makes the browser fragile enough to drop pages
   mid-run, so it is opt-in rather than the default. */
const launchOptions = {
  args: [
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    ...(process.env.SMOKE_SINGLE_PROCESS === 'true' ? ['--single-process'] : []),
  ],
  timeout: 30_000,
  ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
}

/* Every route is behind sign-in, and the seed session that used to serve here is
   refused unless the demonstration flag is on — which is the point of it being
   refused. So this signs in the way a person does, against Better Auth and the
   database, and needs the API running and the database seeded. Harry Whitfield
   is the identity that reaches every screen under test. See scripts/smoke.mjs,
   which signs in the same way. */
const EMAIL = process.env.SMOKE_EMAIL ?? 'harry.whitfield@keystoneabstract.com'
const PASSWORD = process.env.SMOKE_PASSWORD ?? 'titlecrm-dev'

const failures = []
const check = (passed, what) => {
  console.log((passed ? '  ok    ' : '  FAIL  ') + what)
  if (!passed) failures.push(what)
}

const browser = await chromium.launch(launchOptions)
const page = await browser.newPage()
page.on('pageerror', (e) => failures.push('threw: ' + e.message))

await page.goto(BASE + '/signin', { waitUntil: 'domcontentloaded', timeout: 15_000 })
await page.waitForSelector('main input', { timeout: 10_000 })
await page.locator('main input[type="email"]').fill(EMAIL)
await page.locator('main input[type="password"]').fill(PASSWORD)
await page.getByRole('button', { name: /sign in/i }).click()
try {
  await page.waitForURL((u) => !u.pathname.startsWith('/signin'), { timeout: 15_000 })
} catch {
  console.error(
    `could not sign in as ${EMAIL}. This check drives the real sign-in form, so ` +
      'it needs the API running and the database seeded.',
  )
  await browser.close().catch(() => {})
  process.exit(1)
}
console.log(`signed in as ${EMAIL}`)

const open = async (path, settle = 600) => {
  await page.goto(BASE + path, { waitUntil: 'domcontentloaded', timeout: 15_000 })
  await page.waitForSelector('main', { timeout: 10_000 })
  await page.waitForTimeout(settle)
}
const text = async () => (await page.locator('main').innerText()).toLowerCase()
const tab = async (name) => {
  await page.getByRole('tab', { name }).click()
  await page.waitForTimeout(350)
}

try {
  console.log('\nregister rows reach their detail screen')
  await open('/company')
  await tab('Staff')
  /* Registers come in two markups: the stacked `.rw` row and the table the
     roster uses, whose header shares the row class and is not clickable. Both
     expose the clickable ones as buttons, which is the part worth matching on. */
  await page.locator('.rw, .trow[role="button"]').first().click()
  await page.waitForTimeout(600)
  check(/\/staff\//.test(page.url()), 'a roster row opens the person')

  console.log('\nperson detail')
  await open('/staff/pd')
  check((await text()).includes('prasad'), 'names the person')
  await tab('Work')
  check(/stages today|inside budget/.test(await text()), 'the work tab renders')
  await tab('Quality')
  check(/ratings|defects/.test(await text()), 'the quality tab renders')
  await tab('Access')
  check(/works the orders|see orders/.test(await text()), 'the access tab spells out the role')

  console.log('\nclient detail')
  await open('/clients/MGR', 1500)
  check((await text()).includes('outstanding'), 'shows the outstanding balance')
  check((await text()).includes('invoiced'), 'shows what has been invoiced against it')
  check((await text()).includes('payment terms'), 'and the terms it is billed on')
  await tab('Turnaround')
  /* The tab label is in `main` too, so matching on the word 'turnaround' would
     pass on an empty panel. These are things only the panel says. */
  check(/incl\. weekends|24h/.test(await text()), 'turnaround is stated per product')
  await tab('Invoices')
  check(/inv-\d{4}|part paid/.test(await text()), 'the invoice register renders')
  await tab('Order prefixes')
  check((await text()).includes('incoming mail'), 'prefixes say what they route')

  /*
   * This used to assert that moving the status wrote a note saying what changed.
   * Nothing ever did that — not this application, and not the design it is built
   * from, whose `setLeadStatus` sets the status, drops the follow-up flag on a
   * won or lost lead, and re-renders. The assertion was aspirational and failed
   * the moment anybody ran it. What follows is the rule that is actually there,
   * and is worth holding: won and lost are not waiting on anybody, so the flag
   * comes off with them, and no other move touches it.
   */
  console.log('\nlead detail — the status moves, and winning it drops the flag')
  await open('/leads/l1')
  const status = page.locator('main select[aria-label="Status"]')
  /* The flag's own control is the honest read on it. Matching the phrase in the
     page text instead catches "Keep flagged for follow-up", a checkbox label
     that is there whatever the flag is doing. */
  const clearFlag = page.getByRole('button', { name: 'Clear flag' })
  check((await clearFlag.count()) === 1, 'this one starts flagged')

  await status.selectOption('interested')
  await page.waitForTimeout(400)
  check((await status.inputValue()) === 'interested', 'the status sticks')
  check((await clearFlag.count()) === 1, 'an ordinary move leaves the flag alone')

  await status.selectOption('won')
  await page.waitForTimeout(400)
  check((await clearFlag.count()) === 0, 'winning it drops the flag')

  console.log('\nnew lead — validation')
  await open('/leads/new')
  const add = page.getByRole('button', { name: 'Add lead' })
  await add.click()
  await page.waitForTimeout(300)
  check((await text()).includes('a company name is required'), 'an empty save is refused, with a reason')
  check(page.url().includes('/leads/new'), 'and stays on the form')

  /* Two fields are labelled "Name" — the company's and the contact's — so the
     label is not enough to tell them apart. The ids are. */
  const field = (id) => page.locator(`#nl-${id}`)

  await field('co').fill('Testworth Title Co')
  await field('cn').fill('Jo Tester')
  await field('ce').fill('not-an-email')
  await add.click()
  await page.waitForTimeout(300)
  check((await text()).includes('does not look right'), 'a malformed email is caught')

  await field('ce').fill('jo@testworth.com')
  await add.click()
  await page.waitForTimeout(300)
  /* The note is not decoration: staleness is measured from the newest one, so a
     lead saved without one would be born looking abandoned. */
  check((await text()).includes('write a first note'), 'and a lead cannot be saved without a first note')

  await field('note').fill('Spoke to Jo, quoted standard turnaround.')
  await add.click()
  await page.waitForTimeout(800)
  check(/\/leads\/l\d+/.test(page.url()), 'a valid lead saves and opens')
  check((await text()).includes('testworth'), 'and the new lead shows')
  check(/notes\s+1\b/.test(await text()), 'carrying the note it was created with, so it is not stale on day one')

  console.log('\nmissing records')
  for (const [path, what] of [
    ['/staff/nobody', 'person'],
    ['/clients/NOPE', 'client'],
    ['/leads/nope', 'lead'],
  ]) {
    await open(path, 300)
    check((await text()).includes('not here'), `a missing ${what} says so rather than blanking`)
  }
} finally {
  await browser.close().catch(() => {})
}

console.log(failures.length ? `\n${failures.length} failed:\n  ` + failures.join('\n  ') : '\nall checks passed')
process.exit(failures.length ? 1 : 0)
