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
  /* Detail screens, reached from a register row. */
  '/staff/pd', '/clients/MGR', '/leads/l1', '/leads/new',
  /* And the not-found path each of them has to handle. */
  '/staff/nobody', '/clients/NOPE', '/leads/nope',
]

/* Some sandboxes cannot spawn the usual multi-process browser. */
const launchOptions = {
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--single-process'],
  timeout: 30_000,
  ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
}

let rendered = 0
const problems = []

for (const route of routes) {
  const browser = await chromium.launch(launchOptions)
  try {
    const page = await browser.newPage()
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
    if (text) rendered++
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
