/**
 * Loads every route in a real browser and reports anything that fails to render
 * or throws.
 *
 *   npm run build && npm run preview &
 *   npm run smoke
 *
 * This is not in CI, because it needs a browser download that the rest of the
 * suite does not. It is here because a route can typecheck, lint, pass its unit
 * tests and still render an empty page — lazy chunks, a bad import, a hook order
 * that only breaks at runtime. Those cost minutes to find this way and an
 * afternoon to find any other way.
 *
 * A fresh browser per route keeps one bad page from taking the run down with it.
 */
import { chromium } from 'playwright'

const BASE = process.env.SMOKE_URL ?? 'http://localhost:4173'

const routes = [
  '/dash', '/orders', '/assign', '/attend', '/payroll', '/counties', '/linkcheck',
  '/reports', '/company', '/leads', '/billing', '/mywork', '/intake',
  '/commitment', '/leave', '/payslips', '/hiring', '/petty', '/integ', '/onboard',
  '/signin', '/myperf', '/mypay', '/orders/new',
  /* The root only redirects, but a broken redirect is a blank application. */
  '/',
  /* The payslip document, which is reached from a row in the payroll run. */
  '/payslips/pd',
  /* Detail screens, reached from a register row. */
  '/staff/pd', '/clients/MGR', '/leads/l1', '/leads/new',
  /* And the not-found path each of them has to handle. */
  '/staff/nobody', '/clients/NOPE', '/leads/nope',
]

/* Some sandboxes cannot spawn the usual multi-process browser. `--single-process`
   is the fallback for those, but it makes the browser itself fragile enough to
   drop pages mid-run, so it is opt-in rather than the default. */
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

/*
 * Every route is behind sign-in, so without a session this walks thirty-three
 * redirects to the same form and reports them all as rendering fine — which is
 * how this check quietly stopped testing anything the day sign-in landed.
 *
 * It signs in the way a person does: the real form, against Better Auth, against
 * the database. There is no back door left to use — the seed session that used
 * to serve here is refused unless the demonstration flag is on, which is the
 * point of it being refused. So this needs the API and a seeded database:
 *
 *   npm run server                       # with DATABASE_URL and friends set
 *   npm run build && npm run preview
 *   npm run smoke
 *
 * Harry Whitfield is the one identity that reaches every route; signing in as
 * anyone narrower turns half this list into permission redirects, which is the
 * same blindness in different clothes.
 */
const EMAIL = process.env.SMOKE_EMAIL ?? 'harry.whitfield@keystoneabstract.com'
const PASSWORD = process.env.SMOKE_PASSWORD ?? 'titlecrm-dev'

/** Signs in once and hands back the cookies, so each route need not repeat it. */
async function signIn() {
  const browser = await chromium.launch(launchOptions)
  try {
    const page = await browser.newPage()
    await page.goto(BASE + '/signin', { waitUntil: 'domcontentloaded', timeout: 15_000 })
    await page.waitForSelector('main input', { timeout: 10_000 })
    await page.locator('main input[type="email"]').fill(EMAIL)
    await page.locator('main input[type="password"]').fill(PASSWORD)
    await page.getByRole('button', { name: /sign in/i }).click()
    await page.waitForURL((u) => !u.pathname.startsWith('/signin'), { timeout: 15_000 })
    return await page.context().storageState()
  } finally {
    await browser.close().catch(() => {})
  }
}

let storageState
try {
  storageState = await signIn()
  console.log(`signed in as ${EMAIL}\n`)
} catch (e) {
  console.error(
    `could not sign in as ${EMAIL} — ${e.message.split('\n')[0]}\n` +
      'This check drives the real sign-in form, so it needs the API running and ' +
      'the database seeded. See the comment at the top of this file.',
  )
  process.exit(1)
}

let rendered = 0
const problems = []

for (const route of routes) {
  const browser = await chromium.launch(launchOptions)
  try {
    const context = await browser.newContext({ storageState })
    const page = await context.newPage()
    page.on('pageerror', (e) => problems.push(`${route} threw :: ${e.message}`))
    page.on('console', (m) => {
      const text = m.text()
      /* A missing favicon and a refused API call are expected when the front end
         is running on seed data with no server behind it. */
      if (m.type() === 'error' && !/favicon|Failed to load resource|net::ERR/.test(text)) {
        problems.push(`${route} logged :: ${text}`)
      }
    })

    await page.goto(BASE + route, { waitUntil: 'domcontentloaded', timeout: 15_000 })
    await page.waitForSelector('main', { timeout: 10_000 })
    await page.waitForTimeout(200)

    const text = (await page.locator('main').innerText().catch(() => '')).trim()
    const heading = text.split('\n').filter(Boolean)[0] ?? '(empty)'

    /* A route that bounced to the sign-in form is not a route that rendered.
       Without this the run counts every redirect as a pass, which is exactly how
       this check spent a stretch proving nothing at all. */
    const bounced = /^email$/i.test(heading) && /password/i.test(text)

    if (bounced) problems.push(`${route} bounced to the sign-in form`)
    else if (text) rendered++
    else problems.push(`${route} rendered an empty main`)
    console.log(route.padEnd(14) + heading.slice(0, 58))
  } catch (e) {
    problems.push(`${route} failed :: ${e.message.split('\n')[0]}`)
    console.log(route.padEnd(14) + 'FAILED')
  } finally {
    await browser.close().catch(() => {})
  }
}

console.log(`\nrendered: ${rendered}/${routes.length}`)
console.log(`problems: ${problems.length}`)
problems.forEach((p) => console.log('  ' + p))

process.exit(problems.length ? 1 : 0)
