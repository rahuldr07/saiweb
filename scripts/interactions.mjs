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

const launchOptions = {
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--single-process'],
  timeout: 30_000,
  ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
}

const failures = []
const check = (passed, what) => {
  console.log((passed ? '  ok    ' : '  FAIL  ') + what)
  if (!passed) failures.push(what)
}

const browser = await chromium.launch(launchOptions)
const page = await browser.newPage()
page.on('pageerror', (e) => failures.push('threw: ' + e.message))

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
  await page.locator('.rw').first().click()
  await page.waitForTimeout(600)
  check(/\/staff\//.test(page.url()), 'a roster row opens the person')

  console.log('\nperson detail')
  await open('/staff/pd')
  check((await text()).includes('prasad'), 'names the person')
  await tab('Coverage')
  check(/level|every state/.test(await text()), 'coverage tab renders')
  await tab('Leave')
  check(/earned|taken/.test(await text()), 'leave balances render')

  console.log('\nclient detail')
  await open('/clients/MGR', 1500)
  check((await text()).includes('outstanding'), 'shows the outstanding balance')
  check((await text()).includes('in production'), 'shows what is in production')
  await tab('Turnaround')
  check(/promised|delivered/.test(await text()), 'turnaround is stated against the promise')
  await tab('Contract')
  check((await text()).includes('payment terms'), 'contract tab renders')

  console.log('\nlead detail — moving the status writes a note')
  await open('/leads/l1')
  const before = Number((await page.locator('main').innerText()).match(/Timeline\n(\d+)/)?.[1] ?? 0)
  await page.getByRole('button', { name: 'Interested', exact: true }).click()
  await page.waitForTimeout(400)
  const after = Number((await page.locator('main').innerText()).match(/Timeline\n(\d+)/)?.[1] ?? 0)
  check(after === before + 1, `the timeline gained a line (${before} → ${after})`)
  check((await text()).includes('moved from'), 'and the note says what changed')

  console.log('\nnew lead — validation')
  await open('/leads/new')
  await page.getByRole('button', { name: 'Add lead' }).click()
  await page.waitForTimeout(300)
  check((await text()).includes('needs a company name'), 'an empty save is refused, with a reason')
  check(page.url().includes('/leads/new'), 'and stays on the form')

  const field = (label) =>
    page.locator('.fld').filter({ has: page.locator(`label:text-is("${label}")`) }).locator('input')

  await field('Company name').fill('Testworth Title Co')
  await field('Name').fill('Jo Tester')
  await field('Email').fill('not-an-email')
  await page.getByRole('button', { name: 'Add lead' }).click()
  await page.waitForTimeout(300)
  check((await text()).includes('does not look like an email'), 'a malformed email is caught')

  await field('Email').fill('jo@testworth.com')
  await page.getByRole('button', { name: 'Add lead' }).click()
  await page.waitForTimeout(800)
  check(/\/leads\/l\d+/.test(page.url()), 'a valid lead saves and opens')
  check((await text()).includes('testworth'), 'and the new lead shows')
  check(/lead created|timeline/.test(await text()), 'starting with a note, so it is not stale on day one')

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
