import { PAYCFG } from '@/data/hrms'
import { DEPTLIST, PERMS, ROLELIST, STATUS, TENANTS } from '@/data/org'
import { STAFF } from '@/data/people'
import { CLIENTS } from '@/data/catalog'
import { BUDGET, SLA, type SlaRule } from '@/data/budget'
import { createStore, useStore, useStoreSlice } from '@/lib/store'
import type { Client, Dept, PayConfig, Perm, Person, Role, Tenant } from '@/data/types'

/**
 * What the Company screen sets.
 *
 * These are the numbers everything else is computed from — the salary structure
 * every payslip is derived through, and the workspace's own name and home state.
 * The design's promise on the payroll tab is explicit: *change a number here and
 * the whole register moves; nothing is stored per person except the CTC*. That
 * only holds if the figures are read live rather than captured at import, which
 * is what this exists for.
 *
 * The seed objects are the starting value and are never written to. Every change
 * produces a new one, so the store's subscribers can see it and no other importer
 * of `PAYCFG` is silently altered underneath.
 */

/** One row of the naming table — one concept, one name, used everywhere. */
export interface NamingRow {
  concept: string
  name: string
  short: string
  used: string
}

const NAMING: NamingRow[] = [
  { concept: 'Second search check', name: 'Search QC', short: 'S.Q', used: 'board, reports, exports' },
  { concept: 'Typing check', name: 'Typing QC', short: 'T.Q', used: 'board, reports, exports' },
  { concept: 'Ready to send', name: 'RTS', short: 'RTS', used: 'board' },
  { concept: 'Document request', name: 'Doc Req', short: 'DR', used: 'board, exception branch' },
  { concept: 'Delivered', name: 'Sent', short: '—', used: 'reports, invoicing' },
]

export type Budget = typeof BUDGET

/** How the promise clock behaves, and which stages stop it. */
export interface ClockCfg {
  start: string
  run: string
  tz: string
  pause: Record<string, boolean>
}

const CLOCK: ClockCfg = {
  start: 'email',
  run: '247',
  tz: 'ET',
  pause: {
    'Doc Req': true,
    'Fee Approval': true,
    Clarification: true,
    'Eff Date': true,
    Hold: true,
    Search: false,
    Typing: false,
  },
}

interface CompanyState {
  pay: PayConfig
  profile: Pick<Tenant, 'name' | 'state'> & { tz: string }
  depts: Dept[]
  /** Ordered, because the order is the pipeline. */
  statuses: [string, [string, string]][]
  naming: NamingRow[]
  sla: SlaRule[]
  budget: Budget
  clock: ClockCfg
  staff: Person[]
  clients: Client[]
  roles: Role[]
  perms: Perm[]
}

const FIRST = TENANTS[0]

const SEED: CompanyState = {
  pay: PAYCFG,
  profile: { name: FIRST.name, state: FIRST.state, tz: 'India Standard Time' },
  depts: DEPTLIST,
  statuses: Object.entries(STATUS) as [string, [string, string]][],
  naming: NAMING,
  sla: SLA,
  budget: BUDGET,
  clock: CLOCK,
  staff: STAFF,
  clients: CLIENTS,
  roles: ROLELIST,
  perms: PERMS,
}

const store = createStore<CompanyState>(SEED)

export const useCompany = (): CompanyState => useStore(store)

/**
 * The live salary structure, for the plain functions in `lib/payroll.ts` that
 * cannot use a hook. Reading through here is what makes the register move.
 */
export const currentPayCfg = (): PayConfig => store.get().pay

/**
 * Sets one payroll setting.
 *
 * A blank or negative number is a mis-key, not an instruction, so it is refused
 * rather than written — the design does the same, returning without touching the
 * config. Booleans and text take whatever they are given, minus surrounding
 * space.
 */
export function setPayCfg<K extends keyof PayConfig>(key: K, value: string | boolean): void {
  const current = store.get().pay[key]
  let next: PayConfig[K]

  if (typeof current === 'boolean') {
    next = Boolean(value) as PayConfig[K]
  } else if (typeof current === 'number') {
    const n = parseFloat(String(value))
    if (!Number.isFinite(n) || n < 0) return
    next = n as PayConfig[K]
  } else {
    const v = String(value).trim()
    if (!v) return
    next = v as PayConfig[K]
  }

  store.update((prev) => ({ ...prev, pay: { ...prev.pay, [key]: next } }))
}

/** Sets one field of the workspace's own profile. Blank is refused. */
export function setProfile(key: keyof CompanyState['profile'], value: string): void {
  const v = value.trim()
  if (!v) return
  store.update((prev) => ({ ...prev, profile: { ...prev.profile, [key]: v } }))
}

/* ── the pipeline ───────────────────────────────────────────────────────── */

export const useDepartments = (): Dept[] => useStoreSlice(store, (c) => c.depts)
export const useStatuses = () => useStoreSlice(store, (c) => c.statuses)
export const useNaming = (): NamingRow[] => useStoreSlice(store, (c) => c.naming)

/** Swaps a department with its neighbour. The order of this list is the pipeline. */
export function moveDept(id: string, dir: -1 | 1): void {
  const i = store.get().depts.findIndex((d) => d.id === id)
  const j = i + dir
  if (i < 0 || j < 0 || j >= store.get().depts.length) return
  const depts = [...store.get().depts]
  ;[depts[i], depts[j]] = [depts[j], depts[i]]
  store.update((prev) => ({ ...prev, depts }))
}

/** Same, for the status list — position in it is what "main line" means. */
export function moveStatus(key: string, dir: -1 | 1): void {
  const i = store.get().statuses.findIndex(([k]) => k === key)
  const j = i + dir
  if (i < 0 || j < 0 || j >= store.get().statuses.length) return
  const statuses = [...store.get().statuses]
  ;[statuses[i], statuses[j]] = [statuses[j], statuses[i]]
  store.update((prev) => ({ ...prev, statuses }))
}

/** Renames one concept. Blank is refused — a nameless concept helps nobody. */
export function setNaming(concept: string, name: string): void {
  const v = name.trim()
  if (!v) return
  store.update((prev) => ({
    ...prev,
    naming: prev.naming.map((r) => (r.concept === concept ? { ...r, name: v } : r)),
  }))
}

/* ── where due dates come from ──────────────────────────────────────────── */

export const useSla = (): SlaRule[] => useStoreSlice(store, (c) => c.sla)
export const useBudget = (): Budget => useStoreSlice(store, (c) => c.budget)
export const useClock = (): ClockCfg => useStoreSlice(store, (c) => c.clock)

/** The live rules and split, for the plain functions in `lib/sla.ts`. */
export const currentSla = (): SlaRule[] => store.get().sla
export const currentBudget = (): Budget => store.get().budget

/** A promise is at least an hour and at most a fortnight. */
export function setSlaHours(i: number, v: string): void {
  const h = parseInt(v, 10)
  if (!(h > 0)) return
  store.update((prev) => ({ ...prev, sla: prev.sla.map((r, j) => (j === i ? { ...r, h: Math.min(336, h) } : r)) }))
}

/** New rules go in before the fallback, which always stays last. */
export function addSla(rule: SlaRule): void {
  const at = store.get().sla.findIndex((r) => r.cl.startsWith('—'))
  const sla = [...store.get().sla]
  sla.splice(at < 0 ? sla.length : at, 0, rule)
  store.update((prev) => ({ ...prev, sla }))
}

export function removeSla(i: number): void {
  const r = store.get().sla[i]
  if (!r || r.cl.startsWith('—')) return
  store.update((prev) => ({ ...prev, sla: prev.sla.filter((_, j) => j !== i) }))
}

/**
 * One stage's share, on the base split or on one product's override.
 *
 * The share is clamped to what the slider offers; the total is deliberately not.
 * A split that divides the clock exactly leaves one acceptable value per stage —
 * the one it already holds — so a store that refused an unbalanced result would
 * refuse every edit, and both controls read their value straight off here.
 * `budgetOK` is the check, and the SLA tab is where it is answered.
 */
export function setShare(pr: string, stage: string, v: string): void {
  const n = Math.max(0, Math.min(100, parseFloat(v)))
  if (!Number.isFinite(n)) return
  const b = store.get().budget
  store.update((prev) => ({
    ...prev,
    budget:
      pr === 'base'
        ? { ...b, base: { ...b.base, [stage]: n } }
        : {
            ...b,
            over: b.over.map((o) => (o.pr === pr ? { ...o, shares: { ...o.shares, [stage]: n } } : o)),
          },
  }))
}

export function setBuffer(v: string): void {
  const n = parseFloat(v)
  if (!Number.isFinite(n) || n < 0 || n > 50) return
  store.update((prev) => ({ ...prev, budget: { ...prev.budget, buffer: n } }))
}

/** A new override starts from the base split rather than from nothing. */
export function addOverride(pr: string): void {
  if (store.get().budget.over.some((o) => o.pr === pr)) return
  store.update((prev) => ({
    ...prev,
    budget: { ...prev.budget, over: [...prev.budget.over, { pr, shares: { ...prev.budget.base } }] },
  }))
}

export function removeOverride(pr: string): void {
  store.update((prev) => ({ ...prev, budget: { ...prev.budget, over: prev.budget.over.filter((o) => o.pr !== pr) } }))
}

export function setClock<K extends keyof Omit<ClockCfg, 'pause'>>(key: K, value: string): void {
  store.update((prev) => ({ ...prev, clock: { ...prev.clock, [key]: value } }))
}

export function setPause(stage: string, on: boolean): void {
  store.update((prev) => ({ ...prev, clock: { ...prev.clock, pause: { ...prev.clock.pause, [stage]: on } } }))
}

/* ── the records the forms write ────────────────────────────────────────── */

export const useStaff = (): Person[] => useStoreSlice(store, (c) => c.staff)
export const useClients = (): Client[] => useStoreSlice(store, (c) => c.clients)
export const useRoles = (): Role[] => useStoreSlice(store, (c) => c.roles)
export const usePerms = (): Perm[] => useStoreSlice(store, (c) => c.perms)

const nextId = (prefix: string, taken: string[]) => {
  let n = 1
  while (taken.includes(`${prefix}${n}`)) n++
  return `${prefix}${n}`
}

/** A key from wording: lowercase, letters and digits only. */
const keyOf = (n: string) => n.toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 20) || 'perm'

/* staff */

export function saveStaff(person: Person, id?: string): void {
  store.update((prev) => ({
    ...prev,
    staff: id
      ? prev.staff.map((s) => (s.id === id ? { ...s, ...person, id } : s))
      : [...prev.staff, { ...person, id: nextId('p', prev.staff.map((s) => s.id)) }],
  }))
}

export function removeStaff(id: string): void {
  store.update((prev) => ({ ...prev, staff: prev.staff.filter((s) => s.id !== id) }))
}

/* clients */

export function saveClient(next: Client, was?: string): void {
  store.update((prev) => ({
    ...prev,
    clients: was
      ? prev.clients.map((c) => (c.n === was ? { ...c, ...next } : c))
      : [...prev.clients, next],
  }))
}

export function removeClient(name: string): void {
  store.update((prev) => ({ ...prev, clients: prev.clients.filter((c) => c.n !== name) }))
}

/* departments */

export function saveDept(next: Omit<Dept, 'id'>, id?: string): void {
  const old = id ? store.get().depts.find((d) => d.id === id)?.n : null
  const depts = id
    ? store.get().depts.map((d) => (d.id === id ? { ...d, ...next } : d))
    : [...store.get().depts, { ...next, id: nextId('d', store.get().depts.map((d) => d.id)) }]

  /* A rename has to carry through everything that named the old one, or a
     department quietly loses its people and its QC pairing. */
  const renamed = old && old !== next.n
  store.update((prev) => ({
    ...prev,
    depts: renamed ? depts.map((d) => (d.pair === old ? { ...d, pair: next.n } : d)) : depts,
    staff: renamed
      ? prev.staff.map((s) => ({ ...s, dep: s.dep.map((x) => (x === old ? next.n : x)) }))
      : prev.staff,
  }))
}

export function removeDept(id: string): void {
  const d = store.get().depts.find((x) => x.id === id)
  if (!d) return
  store.update((prev) => ({
    ...prev,
    depts: prev.depts.filter((x) => x.id !== id).map((x) => (x.pair === d.n ? { ...x, pair: null } : x)),
    staff: prev.staff.map((s) => ({ ...s, dep: s.dep.filter((x) => x !== d.n) })),
  }))
}

/* roles */

/** The permissions the admin role always keeps — a workspace cannot lock itself out. */
export const ADMIN_FLOOR = ['all', 'people', 'config']

export function saveRole(next: Omit<Role, 'id'>, id?: string): string {
  /* A copy: `next` belongs to the form that is still holding it, and pushing the
     floor onto its array edited the caller's state from underneath it. */
  const permissions =
    id === 'admin' ? [...new Set([...next.p, ...ADMIN_FLOOR])] : [...next.p]
  const role = { ...next, p: permissions }
  const made = id ?? nextId('r', store.get().roles.map((r) => r.id))
  store.update((prev) => ({
    ...prev,
    roles: id
      ? prev.roles.map((r) => (r.id === id ? { ...r, ...role } : r))
      : [...prev.roles, { ...role, id: made }],
  }))
  return made
}

/** Everyone holding a removed role drops back to Staff, never to nothing. */
export function removeRole(id: string): void {
  const r = store.get().roles.find((x) => x.id === id)
  if (!r || r.lock) return
  store.update((prev) => ({
    ...prev,
    roles: prev.roles.filter((x) => x.id !== id),
    staff: prev.staff.map((s) => (s.r === id ? { ...s, r: 'staff' } : s)),
  }))
}

/* permissions */

export function savePerm(wording: string, k?: string): void {
  if (k) {
    store.update((prev) => ({ ...prev, perms: prev.perms.map((p) => (p.k === k ? { ...p, n: wording } : p)) }))
  } else {
    let key = keyOf(wording)
    let n = 2
    while (store.get().perms.some((p) => p.k === key)) key = `${keyOf(wording)}${n++}`
    store.update((prev) => ({ ...prev, perms: [...prev.perms, { k: key, n: wording, sys: false }] }))
  }
}

/** Removing a permission takes it off every role that had it ticked. */
export function removePerm(k: string): void {
  const p = store.get().perms.find((x) => x.k === k)
  if (!p || p.sys) return
  store.update((prev) => ({
    ...prev,
    perms: prev.perms.filter((x) => x.k !== k),
    roles: prev.roles.map((r) => ({ ...r, p: r.p.filter((x) => x !== k) })),
  }))
}

/* statuses */

export function saveStatus(name: string, colour: string, k?: string): void {
  if (k) {
    store.update((prev) => ({ ...prev, statuses: prev.statuses.map((s) => (s[0] === k ? [k, [name, colour]] : s)) }))
  } else {
    let key = keyOf(name)
    let n = 2
    while (store.get().statuses.some(([x]) => x === key)) key = `${keyOf(name)}${n++}`
    store.update((prev) => ({ ...prev, statuses: [...prev.statuses, [key, [name, colour]]] }))
  }
}

export function removeStatus(k: string): void {
  store.update((prev) => ({ ...prev, statuses: prev.statuses.filter(([x]) => x !== k) }))
}

/** Puts the seed back. For tests, which must not inherit each other's settings. */
export const resetCompany = store.reset
