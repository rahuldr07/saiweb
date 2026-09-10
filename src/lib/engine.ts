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
import { PRODUCTS } from '@/data/catalog'
import { STAFF } from '@/data/people'
import { COUNTIES } from '@/data/catalog'
import { PRODMIX, CLIENTMIX } from '@/data/production'
import { fmtDate } from './format'
import { now } from '@/lib/clock'
import { COVSTAGES, coversPlace, coversProduct } from './coverage'
import type { Order, OrderStatus, Person, Rule, RuleCondition } from '@/data/types'
import { midnight } from '@/lib/format'

/** The register's status key for each pipeline stage. */
const STAGE_STATUS: Record<string, OrderStatus> = {
  Search: 'search',
  'Search QC': 'sq',
  Typing: 'typing',
  'Typing QC': 'tqc',
  RTS: 'rts',
  'Doc Req': 'docreq',
}

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

/**
 * Enough of an order for the rules to judge it.
 *
 * Deliberately not `Arrival`: the same rules are asked about an order being
 * typed at intake and about a register row on the order screen, neither of which
 * has arrived in a run.
 */
export type Candidate = Pick<Arrival, 'pr' | 'st' | 'cl'> & { co?: string | null }

export const ruleOn = (id: string, rules: Rule[] = RULES) =>
  rules.find((x) => x.id === id)?.on ?? false

export function ruleMatches(r: Rule, o: Candidate, stage: string): boolean {
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

/* ── narrowing the pool ─────────────────────────────────────────────────── */

/** One rule's consultation: what it was given and what it left. */
export interface NarrowStep {
  r: string
  before: number
  after: number
  note: string
}

/** Which rule emptied the pool, and what kind of answer that is. */
export interface NarrowStop {
  why: ExclusionReason
  /** Coverage stops twice for different reasons, so the rule id is kept. */
  rule: string
}

export interface NarrowResult {
  /** Everyone still eligible, emptiest desk first. Empty when `stop` is set. */
  pool: Person[]
  stop?: NarrowStop
  /** Every rule consulted, in order — what the rule counters are built from. */
  steps: NarrowStep[]
  /** The subset a person should read: a rule that removed nobody says nothing. */
  trace: TraceStep[]
  /** The stage this one reviews, when it is a QC stage. */
  paired?: string
}

export interface NarrowOptions {
  /** Defaults to the seed roster and the live rules. */
  ctx?: RunContext
  /** How much each person already holds. A missing id reads as nought. */
  load?: Record<string, number>
  /** Who holds which stage of this order already — what self-review reads. */
  taken?: Record<string, string | null | undefined>
  /**
   * Whether the daily target applies.
   *
   * The automatic pass deals a day and must respect it. Assigning by hand on an
   * order screen must not: the load it counts against is that automatic deal,
   * which routinely fills a department to its target, and refusing every manual
   * placement afterwards would take the override away from the one person the
   * screen exists for.
   */
  target?: boolean
}

/**
 * Who may take one stage of one order, and what removed everybody else.
 *
 * Three places need this answer — the automatic pass, the intake preview, and
 * "Assign all" on an order — and they were three copies. The copy on the order
 * screen had already dropped coverage and routing, so it could hand a searcher
 * an order the run itself excludes while the confirmation told the reader it
 * followed the same rules.
 */
export function narrowPool(o: Candidate, stage: string, opts: NarrowOptions = {}): NarrowResult {
  const cx = opts.ctx ?? defaultContext()
  const { load = {}, taken = {}, target = true } = opts
  const at = (id: string) => load[id] ?? 0
  const whoName = (id: string | null | undefined) => cx.staff.find((s) => s.id === id)?.n ?? '—'
  const paired: string | undefined = cx.pairs[stage]

  const steps: NarrowStep[] = []
  const trace: TraceStep[] = []
  const step = (r: string, before: number, after: number, note: string, always = false) => {
    steps.push({ r, before, after, note })
    if (always || before !== after) trace.push({ r, left: after, note })
  }
  const stop = (why: ExclusionReason, rule: string): NarrowResult => ({
    pool: [],
    stop: { why, rule },
    steps,
    trace,
    paired,
  })

  let pool = cx.staff.filter((s) => s.dep.includes(stage))
  step('r1', pool.length, pool.length, `${pool.length} in ${stage}`, true)
  if (!pool.length) return stop('no-dept', 'r1')

  /* Routing narrows before any constraint on load. Every matching rule is
     consulted even once the pool is empty, because a rule that never gets as far
     as being asked cannot be reported as doing nothing. */
  let emptiedBy: string | undefined
  for (const r of cx.rules.filter((x) => x.k === 'route' && x.on && x.cond)) {
    if (!ruleMatches(r, o, stage)) continue
    const before = pool.length
    pool = pool.filter((s) => r.pool?.includes(s.id))
    step(r.id, before, pool.length, `${r.n} — ${before} → ${pool.length}`, true)
    if (!pool.length && !emptiedBy) emptiedBy = r.id
  }
  if (!pool.length) return stop('no-dept', emptiedBy ?? 'r1')

  /* Coverage runs before availability and load on purpose: someone who does not
     cover Alaska is not "unavailable", they were never a candidate. */
  if (ruleOn('r6', cx.rules) && cx.covStages.includes(stage)) {
    const before = pool.length
    pool = pool.filter((x) => cx.coversPlace(x.id, o.st, o.co ?? null))
    step('r6', before, pool.length, `${stage} — covers ${o.co}, ${o.st} — ${before} → ${pool.length}`)
    if (!pool.length) return stop('coverage', 'r6')
  }

  if (ruleOn('r7', cx.rules) && cx.covStages.includes(stage)) {
    const before = pool.length
    pool = pool.filter((x) => cx.coversProduct(x.id, o.pr))
    step('r7', before, pool.length, `${stage} — works ${o.pr} — ${before} → ${pool.length}`)
    if (!pool.length) return stop('coverage', 'r7')
  }

  if (ruleOn('r2', cx.rules)) {
    const before = pool.length
    pool = pool.filter((s) => s.avail === 'ok' && s.active !== false)
    step('r2', before, pool.length, `availability — ${before} → ${pool.length}`)
  }
  if (!pool.length) return stop('unavailable', 'r2')

  if (target && ruleOn('r3', cx.rules)) {
    const before = pool.length
    pool = pool.filter((s) => at(s.id) < s.cap)
    step('r3', before, pool.length, `at target — ${before} → ${pool.length}`)
  }
  if (!pool.length) return stop('capacity', 'r3')

  /* QC independence: a QC stage can never go to the person who did the work. */
  if (ruleOn('r4', cx.rules) && paired) {
    const before = pool.length
    pool = pool.filter((s) => taken[paired] !== s.id)
    step('r4', before, pool.length, `self-review — skipped ${whoName(taken[paired])}`)
  }
  if (!pool.length) return stop('self', 'r4')

  pool.sort((a, b) => at(a.id) / a.cap - at(b.id) / b.cap)
  const p = pool[0]
  const note = `emptiest — ${p.n} at ${at(p.id)}/${p.cap}`
  steps.push({ r: 'r8', before: pool.length, after: pool.length, note })
  trace.push({ r: 'r8', left: 1, note })

  return { pool, steps, trace, paired }
}

/** What an exception says, and who came closest to qualifying. */
function refusal(
  o: Arrival,
  stage: string,
  cx: RunContext,
  { why, rule }: NarrowStop,
  paired?: string,
): { t: string; near?: string[] } {
  const inDept = (covers: (id: string) => boolean) =>
    cx.staff.filter((x) => x.dep.includes(stage) && x.active !== false && covers(x.id)).map((x) => x.id)

  switch (why) {
    case 'no-dept':
      return { t: rule === 'r1' ? `Nobody belongs to ${stage}` : `A routing rule left nobody eligible` }
    case 'coverage':
      return rule === 'r6'
        ? {
            t: `Nobody in ${stage} covers ${o.co}, ${o.st}`,
            near: inDept((id) => cx.coversPlace(id, o.st, null)),
          }
        : {
            t: `Nobody in ${stage} who covers ${o.st} works ${o.pr}`,
            near: inDept((id) => cx.coversPlace(id, o.st, o.co)),
          }
    case 'unavailable':
      return { t: `Everyone eligible for ${stage} is on leave or off shift` }
    case 'capacity':
      return { t: `Everyone eligible for ${stage} is at their daily target` }
    case 'self':
      return { t: `The only person with room did the ${paired}` }
  }
}

export function runDay(days: DayBucket[], overrides: Partial<RunContext> = {}): RunResult {
  const cx: RunContext = { ...defaultContext(), ...overrides }
  const { staff: STAFF, rules: RULES, assignStages: ASSIGN_STAGES } = cx

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
          const nar = narrowPool(o, stage, { ctx: cx, load, taken: onOrder })

          nar.steps.forEach((s) => {
            bump(fired, s.r)
            /* r1 sums rather than counts, so it can be reported as an average
               pool size; every other rule counts the times it changed an answer. */
            if (s.r === 'r1') bump(narrowed, 'r1', s.after)
            else if (s.before !== s.after) bump(narrowed, s.r)
            if (s.r === 'r4' && s.before !== s.after) avoided++
          })
          trace.push(...nar.trace)

          if (nar.stop) {
            const { t, near } = refusal(o, stage, cx, nar.stop, nar.paired)
            exc.push({
              o,
              stage,
              dk: day.dk,
              today: o.today,
              why: nar.stop.why,
              t,
              ...(near ? { near } : {}),
              trace: trace.slice(from),
            })
            continue
          }

          const p = nar.pool[0]
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
    const nar = narrowPool(o, stage, { ctx: cx, load: at, taken: onOrder })
    if (nar.stop) {
      out[stage] = { err: previewErr(o, nar.stop) }
      continue
    }
    const p = nar.pool[0]
    at[p.id] = (at[p.id] ?? 0) + 1
    onOrder[stage] = p.id
    out[stage] = { who: p.id }
  }

  return out
}

/** The refusal in the words the intake form uses — a phrase, not a sentence. */
function previewErr(o: Candidate, { why, rule }: NarrowStop): string {
  switch (why) {
    case 'no-dept':
      return rule === 'r1' ? 'nobody in the department' : 'a routing rule left nobody'
    case 'coverage':
      return rule === 'r6' ? `nobody covers ${o.co ?? o.st}` : `nobody here works ${o.pr}`
    case 'unavailable':
      return 'nobody available'
    case 'capacity':
      return 'everyone at their target'
    case 'self':
      return 'would be self-review'
  }
}

/* ── progress ───────────────────────────────────────────────────────────── */

/**
 * Stages complete in order, roughly one every 1.5h after the order arrives. An
 * order that landed at 9:00 has had most of the day; one at 17:00 has barely started.
 */
export const STAGE_HOURS = 1.5

const stageIdx = (s: string) => ASSIGN_STAGES.indexOf(s)

export const ageHrs = (o: Arrival) =>
  Math.round((midnight(now()).getTime() - midnight(o.date).getTime()) / 36e5) + (now().getHours() + now().getMinutes() / 60 - o.hr)

export const doneCount = (o: Arrival) =>
  Math.max(0, Math.min(ASSIGN_STAGES.length, Math.floor(ageHrs(o) / STAGE_HOURS)))

export const isDone = (o: Arrival, stage: string) => stageIdx(stage) < doneCount(o)

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

/**
 * One of today's arrivals, as an order.
 *
 * The assignment run deals arrivals rather than register rows, so a queue built
 * from the run holds ids the register has never heard of. Every screen that
 * showed one still linked it at order detail, which meant a row somebody was
 * told to work opened on "that order is not here".
 *
 * Nothing is invented here: the plan is the run's own placement, the due date
 * comes from the same promise the SLA planner uses, the fee is the product's,
 * and the stage is wherever the run has got to. What an arrival genuinely does
 * not have is a property address — that is taken at intake — so it stays empty
 * rather than being filled with something plausible.
 */
export function arrivalAsOrder(o: Arrival, slaHours: number): Order {
  const stage = curStage(o)
  const age = Math.max(0, Math.round(ageHrs(o)))
  return {
    id: o.id,
    cl: o.cl,
    pr: o.pr,
    stt: (stage ? STAGE_STATUS[stage] : 'sent') ?? 'search',
    st: o.st,
    co: o.co,
    prop: '',
    a: { ...(o.plan ?? {}) },
    due: new Date(o.recv.getTime() + slaHours * 36e5),
    recv: o.recv,
    fee: PRODUCTS.find((p) => p.id === o.pr)?.fee ?? 0,
    age: stage ? `${age}h in ${stage}` : `${age}h, delivered`,
    done: !stage,
  }
}

/** Find one of today's arrivals by id. */
export const arrivalById = (id: string): Arrival | undefined =>
  board().run.orders.find((o) => o.id === id)

/** Stage counts across the order register, for the dashboard pipeline strip. */
export function stageCounts(orders: Order[]): Record<string, number> {
  const c: Record<string, number> = {}
  orders.forEach((o) => {
    c[o.stt] = (c[o.stt] ?? 0) + 1
  })
  return c
}
