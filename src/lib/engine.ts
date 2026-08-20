/**
 * The assignment engine.
 *
 * It applies the rules in order and records WHY each choice was made, because the
 * engine never silently skips a person: when a stage cannot be placed it says
 * which of the five reasons stopped it. The trace is what the Assignment screen
 * shows, and it is also how a rule that never changes an answer becomes visible —
 * a rule consulted 2,160 times that never removed anybody is doing nothing.
 */
import { ASSIGN_STAGES, PAIRS, RULES, STAGES } from '@/data/org'
import { STAFF } from '@/data/people'
import { COUNTIES } from '@/data/catalog'
import { PRODMIX, CLIENTMIX } from '@/data/production'
import { fmtDate } from './format'
import { now } from '@/lib/clock'
import { COVSTAGES, coversPlace, coversProduct } from './coverage'
import type { Order, Person, Rule, RuleCondition } from '@/data/types'

/* ── what a run is given ────────────────────────────────────────────────── */

/**
 * Everything the engine reads about the world, passed in rather than imported.
 *
 * It used to read the seed modules directly, which meant the rules could only
 * ever be exercised against one roster — and a roster where load-balancing
 * happens to avoid self-review even with the self-review rule switched off. A
 * rule you cannot construct a counter-example for is a rule you cannot test.
 */
export interface RunContext {
  staff: Person[]
  rules: Rule[]
  /** The stages placed automatically, in the order they run. */
  assignStages: string[]
  /** Every stage, including the manual ones. */
  stages: string[]
  /** QC stage → the stage it reviews. */
  pairs: Record<string, string>
  /** Stages where place and product coverage apply. */
  covStages: string[]
  coversPlace: (id: string, state: string, county: string | null) => boolean
  coversProduct: (id: string, product: string) => boolean
}

export const defaultContext = (): RunContext => ({
  staff: STAFF,
  rules: RULES,
  assignStages: ASSIGN_STAGES,
  stages: STAGES,
  pairs: PAIRS,
  covStages: COVSTAGES,
  coversPlace,
  coversProduct,
})

/* ── the arriving day ───────────────────────────────────────────────────── */

/** Today and the four days before it. */
export const DAYCOUNT = 5

const dayDate = (i: number) =>
  new Date(now().getFullYear(), now().getMonth(), now().getDate() - (DAYCOUNT - 1 - i))

export interface Arrival {
  id: string
  hr: number
  date: Date
  dk: string
  today: boolean
  recv: Date
  pr: string
  st: string
  cl: string
  co: string
  plan?: Record<string, string>
  trace?: TraceStep[]
}

export interface DayBucket {
  date: Date
  dk: string
  arrivals: { hr: number; orders: Arrival[] }[]
}

export function makeDay(): DayBucket[] {
  const states = ['PA', 'GA', 'CT', 'KY', 'TN', 'AK']
  /* An order without a county cannot be judged against a county rule, and every
     real order has one — the property sits somewhere. */
  const cosIn: Record<string, string[]> = {}
  states.forEach((st) => {
    cosIn[st] = COUNTIES.filter((c) => c.st === st).map((c) => c.n)
  })
  const hours = [9, 10, 11, 12, 13, 14, 15, 16, 17]
  const perDay = [
    [9, 10, 8, 11, 9, 8, 10, 9, 7],
    [10, 11, 9, 12, 10, 9, 11, 10, 8],
    [8, 9, 7, 10, 8, 7, 9, 8, 6],
    [11, 12, 10, 13, 11, 10, 12, 11, 9],
    [10, 11, 9, 12, 10, 9, 11, 10, 8],
  ]
  let n = 0
  const days: DayBucket[] = []
  for (let di = 0; di < DAYCOUNT; di++) {
    const date = dayDate(di)
    const arrivals: DayBucket['arrivals'] = []
    hours.forEach((h, hi) => {
      const list: Arrival[] = []
      for (let i = 0; i < perDay[di][hi]; i++, n++) {
        const st = states[n % states.length]
        const pool = cosIn[st]?.length ? cosIn[st] : ['—']
        list.push({
          id: `4193${String(101 + n).padStart(3, '0')}-1`,
          hr: h,
          date,
          dk: fmtDate(date),
          today: di === DAYCOUNT - 1,
          recv: new Date(date.getFullYear(), date.getMonth(), date.getDate(), h, 0),
          pr: PRODMIX[n % PRODMIX.length],
          st,
          cl: CLIENTMIX[n % CLIENTMIX.length],
          co: pool[n % pool.length],
        })
      }
      arrivals.push({ hr: h, orders: list })
    })
    days.push({ date, dk: fmtDate(date), arrivals })
  }
  return days
}

/* ── rules ──────────────────────────────────────────────────────────────── */

export const ruleOn = (id: string, rules: Rule[] = RULES) =>
  rules.find((x) => x.id === id)?.on ?? false

export function ruleMatches(r: Rule, o: Arrival, stage: string): boolean {
  const c: RuleCondition = r.cond ?? {}
  if (c.stage && c.stage !== stage) return false
  if (c.product && c.product !== o.pr) return false
  if (c.state && c.state !== o.st) return false
  return true
}

/* ── a run ──────────────────────────────────────────────────────────────── */

export interface TraceStep {
  r: string
  left: number
  note: string
}

export type ExclusionReason = 'no-dept' | 'coverage' | 'unavailable' | 'capacity' | 'self'

export interface Exception {
  o: Arrival
  stage: string
  dk: string
  today: boolean
  why: ExclusionReason
  t: string
  near?: string[]
  trace: TraceStep[]
}

export interface Assignment {
  o: Arrival
  stage: string
  who: string
  hr: number
  dk: string
  today: boolean
  trace: TraceStep[]
}

export interface RunResult {
  assigns: Assignment[]
  exc: Exception[]
  load: Record<string, number>
  fired: Record<string, number>
  narrowed: Record<string, number>
  hourly: { hr: number; n: number; used: Record<string, number>; load: Record<string, number> }[]
  avoided: number
  deptOut: string[]
  orders: Arrival[]
  today: Arrival[]
  days: { date: Date; dk: string; n: number }[]
  total: number
  /** What this run was given, so the roll-ups below read the same world. */
  ctx: RunContext
}

export function runDay(days: DayBucket[], overrides: Partial<RunContext> = {}): RunResult {
  const cx: RunContext = { ...defaultContext(), ...overrides }
  const { staff: STAFF, rules: RULES, assignStages: ASSIGN_STAGES, pairs: PAIRS } = cx
  const whoName = (id: string | undefined) => STAFF.find((s) => s.id === id)?.n ?? '—'

  const load: Record<string, number> = {}
  const fired: Record<string, number> = {}
  const narrowed: Record<string, number> = {}
  RULES.forEach((r) => {
    fired[r.id] = 0
    narrowed[r.id] = 0
  })
  /* A constructed roster may not carry every built-in rule, so the counters
     tolerate an id they were not primed with rather than going NaN. */
  const bump = (m: Record<string, number>, id: string, by = 1) => {
    m[id] = (m[id] ?? 0) + by
  }

  const assigns: Assignment[] = []
  const exc: Exception[] = []
  let hourly: RunResult['hourly'] = []
  let avoided = 0

  /* Departments where everybody is out: any order needing that stage has nowhere to go. */
  const deptOut = [
    ...new Set(
      cx.stages.filter((g) => {
        const m = STAFF.filter((s) => s.dep.includes(g))
        return m.length > 0 && m.every((s) => s.avail !== 'ok')
      }),
    ),
  ]

  for (const day of days) {
    /* A daily target resets each morning, so each day is dealt afresh. */
    STAFF.forEach((s) => {
      load[s.id] = s.open
    })
    const dayHourly: RunResult['hourly'] = []

    for (const slot of day.arrivals) {
      const hStart = Object.fromEntries(STAFF.map((s) => [s.id, load[s.id]]))

      for (const o of slot.orders) {
        const onOrder: Record<string, string> = {}
        const trace: TraceStep[] = []

        for (const stage of ASSIGN_STAGES) {
          /* Where this stage's reasoning starts. `trace` accumulates across the
             whole order so `o.trace` can still be read as one narrative, but a
             snapshot taken for a single stage must begin here — otherwise the
             Search QC card explains itself using the steps that chose Search. */
          const from = trace.length
          let pool: Person[] = STAFF.filter((s) => s.dep.includes(stage))
          trace.push({ r: 'r1', left: pool.length, note: `${pool.length} in ${stage}` })
          bump(fired, 'r1')
          bump(narrowed, 'r1', pool.length) // summed, so it can be reported as an average
          if (!pool.length) {
            exc.push({
              o,
              stage,
              dk: day.dk,
              today: o.today,
              why: 'no-dept',
              t: `Nobody belongs to ${stage}`,
              trace: trace.slice(from),
            })
            continue
          }

          /* Routing rules narrow the pool before any constraint on load. */
          for (const r of RULES.filter((x) => x.k === 'route' && x.on && x.cond)) {
            if (ruleMatches(r, o, stage)) {
              const before = pool.length
              pool = pool.filter((s) => r.pool?.includes(s.id))
              bump(fired, r.id)
              if (before !== pool.length) bump(narrowed, r.id)
              trace.push({ r: r.id, left: pool.length, note: `${r.n} — ${before} → ${pool.length}` })
            }
          }
          if (!pool.length) {
            exc.push({
              o,
              stage,
              dk: day.dk,
              today: o.today,
              why: 'no-dept',
              t: `A routing rule left nobody eligible`,
              trace: trace.slice(from),
            })
            continue
          }

          /* Coverage runs before availability and load on purpose: someone who does
             not cover Alaska is not "unavailable", they were never a candidate — and
             the exception should say that rather than blaming the roster. */
          if (ruleOn('r6', RULES) && cx.covStages.includes(stage)) {
            const b = pool.length
            pool = pool.filter((x) => cx.coversPlace(x.id, o.st, o.co))
            bump(fired, 'r6')
            if (b !== pool.length) {
              bump(narrowed, 'r6')
              trace.push({
                r: 'r6',
                left: pool.length,
                note: `${stage} — covers ${o.co}, ${o.st} — ${b} → ${pool.length}`,
              })
            }
            if (!pool.length) {
              const stateOnly = STAFF.filter(
                (x) => x.dep.includes(stage) && x.active !== false && cx.coversPlace(x.id, o.st, null),
              )
              exc.push({
                o,
                stage,
                dk: day.dk,
                today: o.today,
                why: 'coverage',
                t: `Nobody in ${stage} covers ${o.co}, ${o.st}`,
                near: stateOnly.map((x) => x.id),
                trace: trace.slice(from),
              })
              continue
            }
          }

          if (ruleOn('r7', RULES) && cx.covStages.includes(stage)) {
            const b = pool.length
            pool = pool.filter((x) => cx.coversProduct(x.id, o.pr))
            bump(fired, 'r7')
            if (b !== pool.length) {
              bump(narrowed, 'r7')
              trace.push({
                r: 'r7',
                left: pool.length,
                note: `${stage} — works ${o.pr} — ${b} → ${pool.length}`,
              })
            }
            if (!pool.length) {
              const placeOK = STAFF.filter(
                (x) => x.dep.includes(stage) && x.active !== false && cx.coversPlace(x.id, o.st, o.co),
              )
              exc.push({
                o,
                stage,
                dk: day.dk,
                today: o.today,
                why: 'coverage',
                t: `Nobody in ${stage} who covers ${o.st} works ${o.pr}`,
                near: placeOK.map((x) => x.id),
                trace: trace.slice(from),
              })
              continue
            }
          }

          if (ruleOn('r2', RULES)) {
            const b = pool.length
            pool = pool.filter((s) => s.avail === 'ok' && s.active !== false)
            bump(fired, 'r2')
            if (b !== pool.length) {
              bump(narrowed, 'r2')
              trace.push({ r: 'r2', left: pool.length, note: `availability — ${b} → ${pool.length}` })
            }
          }
          if (!pool.length) {
            exc.push({
              o,
              stage,
              dk: day.dk,
              today: o.today,
              why: 'unavailable',
              t: `Everyone eligible for ${stage} is on leave or off shift`,
              trace: trace.slice(from),
            })
            continue
          }

          if (ruleOn('r3', RULES)) {
            const b = pool.length
            pool = pool.filter((s) => load[s.id] < s.cap)
            bump(fired, 'r3')
            if (b !== pool.length) {
              bump(narrowed, 'r3')
              trace.push({ r: 'r3', left: pool.length, note: `at target — ${b} → ${pool.length}` })
            }
          }
          if (!pool.length) {
            exc.push({
              o,
              stage,
              dk: day.dk,
              today: o.today,
              why: 'capacity',
              t: `Everyone eligible for ${stage} is at their daily target`,
              trace: trace.slice(from),
            })
            continue
          }

          /* QC independence: a QC stage can never go to the person who did the work. */
          const paired = PAIRS[stage]
          if (ruleOn('r4', RULES) && paired) {
            const b = pool.length
            pool = pool.filter((s) => onOrder[paired] !== s.id)
            bump(fired, 'r4')
            if (b !== pool.length) {
              avoided++
              bump(narrowed, 'r4')
              trace.push({
                r: 'r4',
                left: pool.length,
                note: `self-review — skipped ${whoName(onOrder[paired])}`,
              })
            }
          }
          if (!pool.length) {
            exc.push({
              o,
              stage,
              dk: day.dk,
              today: o.today,
              why: 'self',
              t: `The only person with room did the ${paired}`,
              trace: trace.slice(from),
            })
            continue
          }

          pool.sort((a, b) => load[a.id] / a.cap - load[b.id] / b.cap)
          bump(fired, 'r8')
          const p = pool[0]
          trace.push({ r: 'r8', left: 1, note: `emptiest — ${p.n} at ${load[p.id]}/${p.cap}` })
          load[p.id]++
          onOrder[stage] = p.id
          assigns.push({ o, stage, who: p.id, hr: slot.hr, dk: day.dk, today: o.today, trace: trace.slice(from) })
        }

        o.plan = onOrder
        o.trace = trace
      }

      dayHourly.push({
        hr: slot.hr,
        n: slot.orders.length,
        used: Object.fromEntries(STAFF.map((s) => [s.id, load[s.id] - hStart[s.id]])),
        load: { ...load },
      })
    }
    hourly = dayHourly // the live view always shows today
  }

  const orders = days.flatMap((d) => d.arrivals.flatMap((a) => a.orders))
  return {
    assigns,
    exc,
    load,
    fired,
    narrowed,
    hourly,
    avoided,
    deptOut,
    orders,
    today: orders.filter((o) => o.today),
    days: days.map((d) => ({
      date: d.date,
      dk: d.dk,
      n: d.arrivals.reduce((a, x) => a + x.orders.length, 0),
    })),
    total: orders.length * ASSIGN_STAGES.length,
    ctx: cx,
  }
}

/* ── previewing one order ───────────────────────────────────────────────── */

/** Enough of an order for the rules to judge it, before it exists. */
export type Candidate = Pick<Arrival, 'pr' | 'st' | 'cl'> & { co?: string | null }

export type PreviewSlot = { who: string; err?: undefined } | { who?: undefined; err: string }

/**
 * Who would take each stage of an order that has not been placed yet.
 *
 * The same rules in the same order as `runDay`, against a copy of today's load,
 * so nothing is committed — the intake form can show who would pick it up while
 * the address is still being typed. It commits only when the order is created.
 *
 * Coverage is applied here even though the design's own preview skipped it: the
 * form asks for a county two panels above this, and a preview that ignored the
 * answer would name somebody the real run would then rule out.
 */
export function previewAssign(
  o: Candidate,
  load: Record<string, number>,
  overrides: Partial<RunContext> = {},
): Record<string, PreviewSlot> {
  const cx: RunContext = { ...defaultContext(), ...overrides }
  const at = { ...load }
  const onOrder: Record<string, string> = {}
  const out: Record<string, PreviewSlot> = {}

  for (const stage of cx.assignStages) {
    let pool = cx.staff.filter((s) => s.dep.includes(stage))
    if (!pool.length) {
      out[stage] = { err: 'nobody in the department' }
      continue
    }

    for (const r of cx.rules.filter((x) => x.k === 'route' && x.on && x.cond)) {
      if (ruleMatches(r, o as Arrival, stage)) pool = pool.filter((s) => r.pool?.includes(s.id))
    }
    if (!pool.length) {
      out[stage] = { err: 'a routing rule left nobody' }
      continue
    }

    if (ruleOn('r6', cx.rules) && cx.covStages.includes(stage)) {
      pool = pool.filter((x) => cx.coversPlace(x.id, o.st, o.co ?? null))
      if (!pool.length) {
        out[stage] = { err: `nobody covers ${o.co ?? o.st}` }
        continue
      }
    }

    if (ruleOn('r7', cx.rules) && cx.covStages.includes(stage)) {
      pool = pool.filter((x) => cx.coversProduct(x.id, o.pr))
      if (!pool.length) {
        out[stage] = { err: `nobody here works ${o.pr}` }
        continue
      }
    }

    if (ruleOn('r2', cx.rules)) pool = pool.filter((s) => s.avail === 'ok' && s.active !== false)
    if (!pool.length) {
      out[stage] = { err: 'nobody available' }
      continue
    }

    if (ruleOn('r3', cx.rules)) pool = pool.filter((s) => (at[s.id] ?? 0) < s.cap)
    if (!pool.length) {
      out[stage] = { err: 'everyone at their target' }
      continue
    }

    const paired = cx.pairs[stage]
    if (ruleOn('r4', cx.rules) && paired) pool = pool.filter((s) => onOrder[paired] !== s.id)
    if (!pool.length) {
      out[stage] = { err: 'would be self-review' }
      continue
    }

    pool.sort((a, b) => (at[a.id] ?? 0) / a.cap - (at[b.id] ?? 0) / b.cap)
    const p = pool[0]
    at[p.id] = (at[p.id] ?? 0) + 1
    onOrder[stage] = p.id
    out[stage] = { who: p.id }
  }

  return out
}

/* ── progress ───────────────────────────────────────────────────────────── */

/**
 * Stages complete in order, roughly one every 1.5h after the order arrives. An
 * order that landed at 9:00 has had most of the day; one at 17:00 has barely started.
 */
export const STAGE_HOURS = 1.5

const stageIdx = (s: string) => ASSIGN_STAGES.indexOf(s)
const midnight = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()

export const ageHrs = (o: Arrival) =>
  Math.round((midnight(now()) - midnight(o.date)) / 36e5) + (now().getHours() + now().getMinutes() / 60 - o.hr)

export const doneCount = (o: Arrival) =>
  Math.max(0, Math.min(ASSIGN_STAGES.length, Math.floor(ageHrs(o) / STAGE_HOURS)))

export const isDone = (o: Arrival, stage: string) => stageIdx(stage) < doneCount(o)

/** complete · waiting · progress — the three states a board can show. */
export const orderState = (o: Arrival) => {
  const d = doneCount(o)
  return d >= ASSIGN_STAGES.length ? 'complete' : d === 0 ? 'waiting' : 'progress'
}

export const curStage = (o: Arrival): string | null => ASSIGN_STAGES[doneCount(o)] ?? null

/* ── rosters ────────────────────────────────────────────────────────────── */

export interface WorkRow {
  s: Person
  done: number
  pend: number
  tot: number
  pct: number
  items: { o: Arrival; stage: string; fin: boolean; hr: number }[]
  stages: Record<string, { done: number; pend: number }>
}

export function staffWork(run: RunResult): Record<string, WorkRow> {
  const m: Record<string, WorkRow> = {}
  run.ctx.staff.filter((s) => s.dep.length).forEach((s) => {
    m[s.id] = { s, done: 0, pend: 0, tot: 0, pct: 0, items: [], stages: {} }
  })
  run.assigns
    .filter((a) => a.today)
    .forEach((a) => {
      const r = m[a.who]
      if (!r) return
      const fin = isDone(a.o, a.stage)
      r.stages[a.stage] = r.stages[a.stage] ?? { done: 0, pend: 0 }
      if (fin) {
        r.done++
        r.stages[a.stage].done++
      } else {
        r.pend++
        r.stages[a.stage].pend++
      }
      r.items.push({ o: a.o, stage: a.stage, fin, hr: a.hr })
    })
  Object.values(m).forEach((r) => {
    r.tot = r.done + r.pend
    r.pct = r.tot ? Math.round((r.done / r.tot) * 100) : 0
  })
  return m
}

export interface DeptRow {
  d: string
  done: number
  pend: number
  tot: number
  pct: number
  unplaced: number
  auto: boolean
  staff: Person[]
  cap: number
  load: number
  avail: number
  items: { o: Arrival; who: string; fin: boolean; hr: number }[]
  people: Record<string, { done: number; pend: number }>
}

export function deptWork(run: RunResult): Record<string, DeptRow> {
  const m: Record<string, DeptRow> = {}
  run.ctx.stages.forEach((d) => {
    const staff = run.ctx.staff.filter((s) => s.dep.includes(d))
    const free = staff.filter((s) => s.avail === 'ok')
    m[d] = {
      d,
      done: 0,
      pend: 0,
      tot: 0,
      pct: 0,
      unplaced: 0,
      auto: run.ctx.assignStages.includes(d),
      staff,
      cap: free.reduce((a, s) => a + s.cap, 0),
      load: free.reduce((a, s) => a + (run.load[s.id] ?? 0), 0),
      avail: free.length,
      items: [],
      people: {},
    }
  })
  run.assigns
    .filter((a) => a.today)
    .forEach((a) => {
      const r = m[a.stage]
      if (!r) return
      const fin = isDone(a.o, a.stage)
      r.people[a.who] = r.people[a.who] ?? { done: 0, pend: 0 }
      if (fin) {
        r.done++
        r.people[a.who].done++
      } else {
        r.pend++
        r.people[a.who].pend++
      }
      r.items.push({ o: a.o, who: a.who, fin, hr: a.hr })
    })
  run.exc
    .filter((e) => e.today)
    .forEach((e) => {
      if (m[e.stage]) m[e.stage].unplaced++
    })
  Object.values(m).forEach((r) => {
    r.tot = r.done + r.pend
    r.pct = r.tot ? Math.round((r.done / r.tot) * 100) : 0
  })
  return m
}

/* ── the one run everything reads ───────────────────────────────────────── */

/**
 * The run used to be computed at module scope, which meant importing this file —
 * something any screen touching orders does — dealt 2,160 stage decisions before
 * React had rendered anything. It is now computed on first use and memoised, so
 * the cost lands on the screen that actually needs it and nowhere else.
 *
 * Everything derived from the run is memoised alongside it, because they are all
 * views of the same deal and recomputing one against a different run would let
 * two panels on the same screen disagree.
 */
export interface AssignmentBoard {
  day: DayBucket[]
  run: RunResult
  batch: Arrival[]
  work: Record<string, WorkRow>
  worked: WorkRow[]
  totDone: number
  totPend: number
  dwork: Record<string, DeptRow>
  depts: DeptRow[]
}

let memo: AssignmentBoard | null = null

export function computeBoard(overrides: Partial<RunContext> = {}): AssignmentBoard {
  const day = makeDay()
  const run = runDay(day, overrides)
  const work = staffWork(run)
  const worked = Object.values(work)
    .filter((r) => r.tot > 0)
    .sort((a, b) => b.tot - a.tot)
  const dwork = deptWork(run)
  return {
    day,
    run,
    batch: run.today,
    work,
    worked,
    totDone: worked.reduce((a, r) => a + r.done, 0),
    totPend: worked.reduce((a, r) => a + r.pend, 0),
    dwork,
    depts: run.ctx.stages.map((d) => dwork[d]),
  }
}

/** The shared board. Computed once, on first read. */
export function board(): AssignmentBoard {
  if (!memo) memo = computeBoard()
  return memo
}

/** Drops the memo, so a test can run against a different roster. */
export function resetBoard(): void {
  memo = null
}

/** The five exclusion labels, exactly as the design words them. */
export const EXCLUSION: Record<ExclusionReason, [string, 'warn' | 'bad', string]> = {
  capacity: [
    'Everyone at their daily target',
    'warn',
    'Raise the target, add someone to that department, or accept the queue.',
  ],
  unavailable: [
    'Nobody available',
    'bad',
    'Cover, or a rule that routes elsewhere when a department is empty.',
  ],
  'no-dept': ['No one in the department', 'bad', 'Add a member, or the stage cannot run at all.'],
  self: [
    'Would be self-review',
    'warn',
    'Self-review is blocked, so the work waited rather than being checked by its author.',
  ],
  coverage: [
    'Nobody covers that place or product',
    'bad',
    'Widen somebody’s level, or add a person who already covers it.',
  ],
}

/** Stage counts across the order register, for the dashboard pipeline strip. */
export function stageCounts(orders: Order[]): Record<string, number> {
  const c: Record<string, number> = {}
  orders.forEach((o) => {
    c[o.stt] = (c[o.stt] ?? 0) + 1
  })
  return c
}
