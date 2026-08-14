/**
 * Measures what each route actually costs in a browser: how long the main thread
 * is blocked, when the largest paint lands, and how much script had to be parsed
 * and evaluated to get there.
 *
 *   npm run build && npm run preview &
 *   npm run profile
 *
 * Long tasks are the number that matters for "does it feel laggy" — anything over
 * 50ms is a frame the browser could not respond in.
 */
import { chromium } from 'playwright'

const BASE = process.env.SMOKE_URL ?? 'http://localhost:4173'
const routes = process.env.PROFILE_ROUTES?.split(',') ?? [
  '/dash', '/orders', '/performance', '/assign', '/company', '/payroll',
]

const launchOptions = {
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--single-process'],
  timeout: 30_000,
  ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
}

const pad = (s, n) => String(s).padStart(n)

console.log('route            JS bytes  scripts   longest   blocked')
console.log('─'.repeat(56))

const results = []

for (const route of routes) {
  const browser = await chromium.launch(launchOptions)
  try {
    const page = await browser.newPage()

    /* Counted from resource timing rather than headers: the preview server uses
       chunked encoding, so content-length is absent and would read as zero. */

    await page.addInitScript(() => {
      window.__long = []
      new PerformanceObserver((list) => {
        for (const e of list.getEntries()) window.__long.push(e.duration)
      }).observe({ type: 'longtask', buffered: true })

      window.__lcp = 0
      new PerformanceObserver((list) => {
        for (const e of list.getEntries()) window.__lcp = e.startTime
      }).observe({ type: 'largest-contentful-paint', buffered: true })
    })

    await page.goto(BASE + route, { waitUntil: 'load', timeout: 20_000 })
    await page.waitForSelector('main', { timeout: 10_000 })
    await page.waitForTimeout(1200)

    const m = await page.evaluate(() => {
      const long = window.__long ?? []
      const scripts = performance
        .getEntriesByType('resource')
        .filter((r) => r.name.endsWith('.js'))
      return {
        longest: long.length ? Math.max(...long) : 0,
        /* Total blocking time: the part of each long task beyond 50ms. */
        blocked: long.reduce((a, d) => a + Math.max(0, d - 50), 0),
        lcp: window.__lcp ?? 0,
        scriptCount: scripts.length,
        bytes: scripts.reduce((a, r) => a + (r.decodedBodySize || 0), 0),
      }
    })

    results.push({ route, ...m })
    console.log(
      route.padEnd(14) +
        pad((m.bytes / 1024).toFixed(0) + ' KB', 9) +
        pad(m.scriptCount, 9) +
        pad(m.longest.toFixed(0) + 'ms', 10) +
        pad(m.blocked.toFixed(0) + 'ms', 10),
    )
  } catch (e) {
    console.log(route.padEnd(14) + 'FAILED: ' + e.message.split('\n')[0].slice(0, 40))
  } finally {
    await browser.close().catch(() => {})
  }
}

const total = results.reduce((a, r) => a + r.bytes, 0) / results.length
console.log('\nmean JS per route: ' + (total / 1024).toFixed(0) + ' KB')
const worst = [...results].sort((a, b) => b.blocked - a.blocked)[0]
if (worst) console.log('worst blocking:    ' + worst.route + ' ' + worst.blocked.toFixed(0) + 'ms')
