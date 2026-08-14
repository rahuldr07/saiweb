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
import { NOW, fmtDate } from './format'
import { COVSTAGES, coversPlace, coversProduct } from './coverage'
import type { Order, Person, Rule, RuleCondition } from '@/data/types'

/* ── the arriving day ───────────────────────────────────────────────────── */

/** Today and the four days before it. */
export const DAYCOUNT = 5

const dayDate = (i: number) =>
  new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate() - (DAYCOUNT - 1 - i))

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

export const ruleOn = (id: string) => RULES.find((x) => x.id === id)?.on ?? false

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
}

const whoName = (id: string | undefined) => STAFF.find((s) => s.id === id)?.n ?? '—'

export function runDay(days: DayBucket[]): RunResult {
  const load: Record<string, number> = {}
  const fired: Record<string, number> = {}
  const narrowed: Record<string, number> = {}
  RULES.forEach((r) => {
    fired[r.id] = 0
    narrowed[r.id] = 0
  })

  const assigns: Assignment[] = []
  const exc: Exception[] = []
  let hourly: RunResult['hourly'] = []
  let avoided = 0

  /* Departments where everybody is out: any order needing that stage has nowhere to go. */
  const deptOut = [
    ...new Set(
      STAGES.filter((g) => {
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
          let pool: Person[] = STAFF.filter((s) => s.dep.includes(stage))
          trace.push({ r: 'r1', left: pool.length, note: `${pool.length} in ${stage}` })
          fired.r1++
          narrowed.r1 += pool.length // summed, so it can be reported as an average
          if (!pool.length) {
            exc.push({
              o,
              stage,
              dk: day.dk,
              today: o.today,
              why: 'no-dept',
              t: `Nobody belongs to ${stage}`,
              trace: trace.slice(),
            })
            continue
          }

          /* Routing rules narrow the pool before any constraint on load. */
          for (const r of RULES.filter((x) => x.k === 'route' && x.on && x.cond)) {
            if (ruleMatches(r, o, stage)) {
              const before = pool.length
              pool = pool.filter((s) => r.pool?.includes(s.id))
              fired[r.id]++
              if (before !== pool.length) narrowed[r.id]++
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
              trace: trace.slice(),
            })
            continue
          }

          /* Coverage runs before availability and load on purpose: someone who does
             not cover Alaska is not "unavailable", they were never a candidate — and
             the exception should say that rather than blaming the roster. */
          if (ruleOn('r6') && COVSTAGES.includes(stage)) {
            const b = pool.length
            pool = pool.filter((x) => coversPlace(x.id, o.st, o.co))
            fired.r6++
            if (b !== pool.length) {
              narrowed.r6++
              trace.push({
                r: 'r6',
                left: pool.length,
                note: `${stage} — covers ${o.co}, ${o.st} — ${b} → ${pool.length}`,
              })
            }
            if (!pool.length) {
              const stateOnly = STAFF.filter(
                (x) => x.dep.includes(stage) && x.active !== false && coversPlace(x.id, o.st, null),
              )
              exc.push({
                o,
                stage,
                dk: day.dk,
                today: o.today,
                why: 'coverage',
                t: `Nobody in ${stage} covers ${o.co}, ${o.st}`,
                near: stateOnly.map((x) => x.id),
                trace: trace.slice(),
              })
              continue
            }
          }

          if (ruleOn('r7') && COVSTAGES.includes(stage)) {
            const b = pool.length
            pool = pool.filter((x) => coversProduct(x.id, o.pr))
            fired.r7++
            if (b !== pool.length) {
              narrowed.r7++
              trace.push({
                r: 'r7',
                left: pool.length,
                note: `${stage} — works ${o.pr} — ${b} → ${pool.length}`,
              })
            }
            if (!pool.length) {
              const placeOK = STAFF.filter(
                (x) => x.dep.includes(stage) && x.active !== false && coversPlace(x.id, o.st, o.co),
              )
              exc.push({
                o,
                stage,
                dk: day.dk,
                today: o.today,
                why: 'coverage',
                t: `Nobody in ${stage} who covers ${o.st} works ${o.pr}`,
                near: placeOK.map((x) => x.id),
                trace: trace.slice(),
              })
              continue
            }
          }

          if (ruleOn('r2')) {
            const b = pool.length
            pool = pool.filter((s) => s.avail === 'ok' && s.active !== false)
            fired.r2++
            if (b !== pool.length) {
              narrowed.r2++
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
              trace: trace.slice(),
            })
            continue
          }

          if (ruleOn('r3')) {
            const b = pool.length
            pool = pool.filter((s) => load[s.id] < s.cap)
            fired.r3++
            if (b !== pool.length) {
              narrowed.r3++
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
              trace: trace.slice(),
            })
            continue
          }

          /* QC independence: a QC stage can never go to the person who did the work. */
          const paired = PAIRS[stage]
          if (ruleOn('r4') && paired) {
            const b = pool.length
            pool = pool.filter((s) => onOrder[paired] !== s.id)
            fired.r4++
            if (b !== pool.length) {
              avoided++
              narrowed.r4++
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
              trace: trace.slice(),
            })
            continue
          }

          pool.sort((a, b) => load[a.id] / a.cap - load[b.id] / b.cap)
          fired.r8++
          const p = pool[0]
          trace.push({ r: 'r8', left: 1, note: `emptiest — ${p.n} at ${load[p.id]}/${p.cap}` })
          load[p.id]++
          onOrder[stage] = p.id
          assigns.push({ o, stage, who: p.id, hr: slot.hr, dk: day.dk, today: o.today, trace: trace.slice() })
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
  }
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
  Math.round((midnight(NOW) - midnight(o.date)) / 36e5) + (NOW.getHours() + NOW.getMinutes() / 60 - o.hr)

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
  STAFF.filter((s) => s.dep.length).forEach((s) => {
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
  STAGES.forEach((d) => {
    const staff = STAFF.filter((s) => s.dep.includes(d))
    const free = staff.filter((s) => s.avail === 'ok')
    m[d] = {
      d,
      done: 0,
      pend: 0,
      tot: 0,
      pct: 0,
      unplaced: 0,
      auto: ASSIGN_STAGES.includes(d),
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

export const DAY = makeDay()
export const RUN = runDay(DAY)
export const BATCH = RUN.today
export const WORK = staffWork(RUN)
export const WORKED = Object.values(WORK)
  .filter((r) => r.tot > 0)
  .sort((a, b) => b.tot - a.tot)
export const TOT_DONE = WORKED.reduce((a, r) => a + r.done, 0)
export const TOT_PEND = WORKED.reduce((a, r) => a + r.pend, 0)
export const DWORK = deptWork(RUN)
export const DEPTS = STAGES.map((d) => DWORK[d])

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
