import { ASSIGN_STAGES, PAIRS, RULES, STAGES } from '@/data/org'
import { PRODUCTS } from '@/data/catalog'
import { STAFF } from '@/data/people'
import { COUNTIES } from '@/data/catalog'
import { PRODMIX, CLIENTMIX } from '@/data/production'
import { fmtDate } from './format'
import { now } from '@/lib/clock'
import { COVSTAGES, coversPlace, coversProduct } from './qualification'
import type { Order, OrderStatus, Person, Rule, RuleCondition } from '@/data/types'
import { midnight } from '@/lib/format'

const STAGE_STATUS: Record<string, OrderStatus> = {
  Search: 'search',
  'Search QC': 'sq',
  Typing: 'typing',
  'Typing QC': 'tqc',
  RTS: 'rts',
  'Doc Req': 'docreq',
}

export interface RunContext {
  staff: Person[]
  rules: Rule[]
  assignStages: string[]
  stages: string[]
  pairs: Record<string, string>
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
  const states = ['PA', 'GA', 'CT', 'KY', 'TN', 'AK'] as const
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
    const row = perDay[di] ?? []
    hours.forEach((h, hi) => {
      const list: Arrival[] = []
      for (let i = 0; i < (row[hi] ?? 0); i++, n++) {
        const st = states[n % states.length] ?? states[0]
        const inState = cosIn[st] ?? []
        const pool = inState.length ? inState : ['—']
        list.push({
          id: `4193${String(101 + n).padStart(3, '0')}-1`,
          hr: h,
          date,
          dk: fmtDate(date),
          today: di === DAYCOUNT - 1,
          recv: new Date(date.getFullYear(), date.getMonth(), date.getDate(), h, 0),
          pr: PRODMIX[n % PRODMIX.length] ?? '',
          st,
          cl: CLIENTMIX[n % CLIENTMIX.length] ?? '',
          co: pool[n % pool.length] ?? '—',
        })
      }
      arrivals.push({ hr: h, orders: list })
    })
    days.push({ date, dk: fmtDate(date), arrivals })
  }
  return days
}

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
  ctx: RunContext
}

export interface NarrowStep {
  r: string
  before: number
  after: number
  note: string
}

export interface NarrowStop {
  why: ExclusionReason
  rule: string
}

interface NarrowBase {
  pool: Person[]
  steps: NarrowStep[]
  trace: TraceStep[]
  paired?: string
}

export type NarrowResult =
  | (NarrowBase & { stop: NarrowStop; pick?: undefined })
  | (NarrowBase & { stop?: undefined; pick: Person })

export interface NarrowOptions {
  ctx?: RunContext
  load?: Record<string, number>
  taken?: Record<string, string | null | undefined>
  target?: boolean
}

export function narrowPool(o: Candidate, stage: string, opts: NarrowOptions = {}): NarrowResult {
  const cx = opts.ctx ?? defaultContext()
  const { load = {}, taken = {}, target = true } = opts
  const at = (id: string) => load[id] ?? 0
  const whoName = (id: string | null | undefined) => cx.staff.find((s) => s.id === id)?.n ?? '—'
  const paired = cx.pairs[stage]

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
    ...(paired ? { paired } : {}),
  })

  let pool = cx.staff.filter((s) => s.dep.includes(stage))
  step('r1', pool.length, pool.length, `${pool.length} in ${stage}`, true)
  if (!pool.length) return stop('no-dept', 'r1')

  let emptiedBy: string | undefined
  for (const r of cx.rules.filter((x) => x.k === 'route' && x.on && x.cond)) {
    if (!ruleMatches(r, o, stage)) continue
    const before = pool.length
    pool = pool.filter((s) => r.pool?.includes(s.id))
    step(r.id, before, pool.length, `${r.n} — ${before} → ${pool.length}`, true)
    if (!pool.length && !emptiedBy) emptiedBy = r.id
  }
  if (!pool.length) return stop('no-dept', emptiedBy ?? 'r1')

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

  if (ruleOn('r4', cx.rules) && paired) {
    const before = pool.length
    pool = pool.filter((s) => taken[paired] !== s.id)
    step('r4', before, pool.length, `self-review — skipped ${whoName(taken[paired])}`)
  }

  pool.sort((a, b) => at(a.id) / a.cap - at(b.id) / b.cap)
  const p = pool[0]
  if (!p) return stop('self', 'r4')

  const note = `emptiest — ${p.n} at ${at(p.id)}/${p.cap}`
  steps.push({ r: 'r8', before: pool.length, after: pool.length, note })
  trace.push({ r: 'r8', left: 1, note })

  return { pool, pick: p, steps, trace, ...(paired ? { paired } : {}) }
}

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
  const bump = (m: Record<string, number>, id: string, by = 1) => {
    m[id] = (m[id] ?? 0) + by
  }

  const assigns: Assignment[] = []
  const exc: Exception[] = []
  let hourly: RunResult['hourly'] = []
  let avoided = 0

  const deptOut = [
    ...new Set(
      cx.stages.filter((g) => {
        const m = STAFF.filter((s) => s.dep.includes(g))
        return m.length > 0 && m.every((s) => s.avail !== 'ok')
      }),
    ),
  ]

  for (const day of days) {
    STAFF.forEach((s) => {
      load[s.id] = s.open
    })
    const dayHourly: RunResult['hourly'] = []

    for (const slot of day.arrivals) {
      const hStart = Object.fromEntries(STAFF.map((s) => [s.id, load[s.id] ?? 0]))

      for (const o of slot.orders) {
        const onOrder: Record<string, string> = {}
        const trace: TraceStep[] = []

        for (const stage of ASSIGN_STAGES) {
          const from = trace.length
          const nar = narrowPool(o, stage, { ctx: cx, load, taken: onOrder })

          nar.steps.forEach((s) => {
            bump(fired, s.r)
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

          const p = nar.pick
          load[p.id] = (load[p.id] ?? 0) + 1
          onOrder[stage] = p.id
          assigns.push({ o, stage, who: p.id, hr: slot.hr, dk: day.dk, today: o.today, trace: trace.slice(from) })
        }

        o.plan = onOrder
        o.trace = trace
      }

      dayHourly.push({
        hr: slot.hr,
        n: slot.orders.length,
        used: Object.fromEntries(STAFF.map((s) => [s.id, (load[s.id] ?? 0) - (hStart[s.id] ?? 0)])),
        load: { ...load },
      })
    }
    hourly = dayHourly
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

export type PreviewSlot = { who: string; err?: undefined } | { who?: undefined; err: string }

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
    const p = nar.pick
    at[p.id] = (at[p.id] ?? 0) + 1
    onOrder[stage] = p.id
    out[stage] = { who: p.id }
  }

  return out
}

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

export const STAGE_HOURS = 1.5

const stageIdx = (s: string) => ASSIGN_STAGES.indexOf(s)

export const ageHrs = (o: Arrival) =>
  Math.round((midnight(now()).getTime() - midnight(o.date).getTime()) / 36e5) + (now().getHours() + now().getMinutes() / 60 - o.hr)

export const doneCount = (o: Arrival) =>
  Math.max(0, Math.min(ASSIGN_STAGES.length, Math.floor(ageHrs(o) / STAGE_HOURS)))

export const isDone = (o: Arrival, stage: string) => stageIdx(stage) < doneCount(o)

export const curStage = (o: Arrival): string | null => ASSIGN_STAGES[doneCount(o)] ?? null

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
      const cell = (r.stages[a.stage] ??= { done: 0, pend: 0 })
      if (fin) {
        r.done++
        cell.done++
      } else {
        r.pend++
        cell.pend++
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
      const cell = (r.people[a.who] ??= { done: 0, pend: 0 })
      if (fin) {
        r.done++
        cell.done++
      } else {
        r.pend++
        cell.pend++
      }
      r.items.push({ o: a.o, who: a.who, fin, hr: a.hr })
    })
  run.exc
    .filter((e) => e.today)
    .forEach((e) => {
      const r = m[e.stage]
      if (r) r.unplaced++
    })
  Object.values(m).forEach((r) => {
    r.tot = r.done + r.pend
    r.pct = r.tot ? Math.round((r.done / r.tot) * 100) : 0
  })
  return m
}

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
    depts: run.ctx.stages.flatMap((d) => dwork[d] ?? []),
  }
}

export function board(): AssignmentBoard {
  if (!memo) memo = computeBoard()
  return memo
}

export function resetBoard(): void {
  memo = null
}

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

export const arrivalById = (id: string): Arrival | undefined =>
  board().run.orders.find((o) => o.id === id)

export function stageCounts(orders: Order[]): Record<string, number> {
  const c: Record<string, number> = {}
  orders.forEach((o) => {
    c[o.stt] = (c[o.stt] ?? 0) + 1
  })
  return c
}
