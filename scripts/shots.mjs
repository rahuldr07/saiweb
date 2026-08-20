/**
 * Screenshots every screen worth looking at, in light and dark, at desktop and
 * phone widths.
 *
 *   npm run build && npm run preview &
 *   npm run shots
 *
 * This exists because the last round of design work found four defects by
 * looking at the screens and none by reading the code — a timeline whose
 * timestamps sat on top of the author's name, two back buttons stacked on top of
 * each other, a screen that was mostly empty space, and a table column that
 * wrapped on some rows and not others. All four are invisible in a diff.
 *
 * Output goes to ./shots (git-ignored) unless SHOTS_DIR says otherwise.
 */
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const BASE = process.env.SMOKE_URL ?? 'http://localhost:4173'
const OUT = process.env.SHOTS_DIR ?? 'shots'

/** [name, route, width, dark] */
const shots = [
  ['dash', '/dash', 1440, false],
  ['dash-dark', '/dash', 1440, true],
  ['orders', '/orders', 1440, false],
  ['assignment', '/assign', 1440, false],
  ['reports', '/reports', 1440, false],
  ['company', '/company', 1440, false],
  ['person', '/staff/pd', 1440, false],
  ['person-dark', '/staff/pd', 1440, true],
  ['client', '/clients/MGR', 1440, false],
  ['lead', '/leads/l1', 1440, false],
  ['lead-dark', '/leads/l1', 1440, true],
  ['lead-new', '/leads/new', 1440, false],
  ['dash-phone', '/dash', 420, false],
  ['lead-phone', '/leads/l1', 420, false],
]

const launchOptions = {
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--single-process'],
  timeout: 30_000,
  ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
}

mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch(launchOptions)
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })

for (const [name, route, width, dark] of shots) {
  await page.setViewportSize({ width, height: width < 700 ? 900 : 1000 })
  await page.goto(BASE + route, { waitUntil: 'domcontentloaded', timeout: 15_000 })
  await page.waitForSelector('main', { timeout: 10_000 })
  /* Long enough for the on-demand delivery history to land, so the tiles that
     read from it are captured with figures rather than skeletons. */
  await page.waitForTimeout(1600)
  if (dark) {
    await page.evaluate(() => document.body.classList.add('dark'))
    await page.waitForTimeout(400)
  }
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true })
  console.log(`  ${name.padEnd(14)} ${route}`)
}

await browser.close()
console.log(`\n${shots.length} screenshots in ${OUT}/`)
