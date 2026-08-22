import { useSyncExternalStore } from 'react'
import { PAYCFG } from '@/data/hrms'
import { DEPTLIST, PERMS, ROLELIST, STATUS, TENANTS } from '@/data/org'
import { STAFF } from '@/data/people'
import { CLIENTS } from '@/data/catalog'
import { BUDGET, SLA, type SlaRule } from '@/data/budget'
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
 * produces a new one, so `useSyncExternalStore` can see it and no other importer
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

let state: CompanyState = SEED

const listeners = new Set<() => void>()
const emit = () => {
  for (const l of listeners) l()
}
const subscribe = (fn: () => void) => {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
const snapshot = () => state

export const useCompany = (): CompanyState => useSyncExternalStore(subscribe, snapshot, snapshot)

/**
 * The live salary structure, for the plain functions in `lib/payroll.ts` that
 * cannot use a hook. Reading through here is what makes the register move.
 */
export const currentPayCfg = (): PayConfig => state.pay

/**
 * Sets one payroll setting.
 *
 * A blank or negative number is a mis-key, not an instruction, so it is refused
 * rather than written — the design does the same, returning without touching the
 * config. Booleans and text take whatever they are given, minus surrounding
 * space.
 */
export function setPayCfg<K extends keyof PayConfig>(key: K, value: string | boolean): void {
  const current = state.pay[key]
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

  state = { ...state, pay: { ...state.pay, [key]: next } }
  emit()
}

/** Sets one field of the workspace's own profile. Blank is refused. */
export function setProfile(key: keyof CompanyState['profile'], value: string): void {
  const v = value.trim()
  if (!v) return
  state = { ...state, profile: { ...state.profile, [key]: v } }
  emit()
}

/* ── the pipeline ───────────────────────────────────────────────────────── */

export const useDepartments = (): Dept[] => useSyncExternalStore(subscribe, () => state.depts, () => state.depts)
export const useStatuses = () => useSyncExternalStore(subscribe, () => state.statuses, () => state.statuses)
export const useNaming = (): NamingRow[] => useSyncExternalStore(subscribe, () => state.naming, () => state.naming)

/** Swaps a department with its neighbour. The order of this list is the pipeline. */
export function moveDept(id: string, dir: -1 | 1): void {
  const i = state.depts.findIndex((d) => d.id === id)
  const j = i + dir
  if (i < 0 || j < 0 || j >= state.depts.length) return
  const depts = [...state.depts]
  ;[depts[i], depts[j]] = [depts[j], depts[i]]
  state = { ...state, depts }
  emit()
}

/** Same, for the status list — position in it is what "main line" means. */
export function moveStatus(key: string, dir: -1 | 1): void {
  const i = state.statuses.findIndex(([k]) => k === key)
  const j = i + dir
  if (i < 0 || j < 0 || j >= state.statuses.length) return
  const statuses = [...state.statuses]
  ;[statuses[i], statuses[j]] = [statuses[j], statuses[i]]
  state = { ...state, statuses }
  emit()
}

/** Renames one concept. Blank is refused — a nameless concept helps nobody. */
export function setNaming(concept: string, name: string): void {
  const v = name.trim()
  if (!v) return
  state = {
    ...state,
    naming: state.naming.map((r) => (r.concept === concept ? { ...r, name: v } : r)),
  }
  emit()
}

/* ── where due dates come from ──────────────────────────────────────────── */

export const useSla = (): SlaRule[] => useSyncExternalStore(subscribe, () => state.sla, () => state.sla)
export const useBudget = (): Budget => useSyncExternalStore(subscribe, () => state.budget, () => state.budget)
export const useClock = (): ClockCfg => useSyncExternalStore(subscribe, () => state.clock, () => state.clock)

/** The live rules and split, for the plain functions in `lib/sla.ts`. */
export const currentSla = (): SlaRule[] => state.sla
export const currentBudget = (): Budget => state.budget

/** A promise is at least an hour and at most a fortnight. */
export function setSlaHours(i: number, v: string): void {
  const h = parseInt(v, 10)
  if (!(h > 0)) return
  state = { ...state, sla: state.sla.map((r, j) => (j === i ? { ...r, h: Math.min(336, h) } : r)) }
  emit()
}

/** New rules go in before the fallback, which always stays last. */
export function addSla(rule: SlaRule): void {
  const at = state.sla.findIndex((r) => r.cl.startsWith('—'))
  const sla = [...state.sla]
  sla.splice(at < 0 ? sla.length : at, 0, rule)
  state = { ...state, sla }
  emit()
}

export function removeSla(i: number): void {
  const r = state.sla[i]
  if (!r || r.cl.startsWith('—')) return
  state = { ...state, sla: state.sla.filter((_, j) => j !== i) }
  emit()
}

/** One stage's share, on the base split or on one product's override. */
export function setShare(pr: string, stage: string, v: string): void {
  const n = Math.max(0, Math.min(100, parseFloat(v)))
  if (!Number.isFinite(n)) return
  const b = state.budget
  state = {
    ...state,
    budget:
      pr === 'base'
        ? { ...b, base: { ...b.base, [stage]: n } }
        : {
            ...b,
            over: b.over.map((o) => (o.pr === pr ? { ...o, shares: { ...o.shares, [stage]: n } } : o)),
          },
  }
  emit()
}

export function setBuffer(v: string): void {
  const n = parseFloat(v)
  if (!Number.isFinite(n) || n < 0 || n > 50) return
  state = { ...state, budget: { ...state.budget, buffer: n } }
  emit()
}

/** A new override starts from the base split rather than from nothing. */
export function addOverride(pr: string): void {
  if (state.budget.over.some((o) => o.pr === pr)) return
  state = {
    ...state,
    budget: { ...state.budget, over: [...state.budget.over, { pr, shares: { ...state.budget.base } }] },
  }
  emit()
}

export function removeOverride(pr: string): void {
  state = { ...state, budget: { ...state.budget, over: state.budget.over.filter((o) => o.pr !== pr) } }
  emit()
}

export function setClock<K extends keyof Omit<ClockCfg, 'pause'>>(key: K, value: string): void {
  state = { ...state, clock: { ...state.clock, [key]: value } }
  emit()
}

export function setPause(stage: string, on: boolean): void {
  state = { ...state, clock: { ...state.clock, pause: { ...state.clock.pause, [stage]: on } } }
  emit()
}

/* ── the records the forms write ────────────────────────────────────────── */

export const useStaff = (): Person[] => useSyncExternalStore(subscribe, () => state.staff, () => state.staff)
export const useClients = (): Client[] => useSyncExternalStore(subscribe, () => state.clients, () => state.clients)
export const useRoles = (): Role[] => useSyncExternalStore(subscribe, () => state.roles, () => state.roles)
export const usePerms = (): Perm[] => useSyncExternalStore(subscribe, () => state.perms, () => state.perms)

const nextId = (prefix: string, taken: string[]) => {
  let n = 1
  while (taken.includes(`${prefix}${n}`)) n++
  return `${prefix}${n}`
}

/** A key from wording: lowercase, letters and digits only. */
const keyOf = (n: string) => n.toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 20) || 'perm'

/* staff */

export function saveStaff(person: Person, id?: string): void {
  state = {
    ...state,
    staff: id
      ? state.staff.map((s) => (s.id === id ? { ...s, ...person, id } : s))
      : [...state.staff, { ...person, id: nextId('p', state.staff.map((s) => s.id)) }],
  }
  emit()
}

export function removeStaff(id: string): void {
  state = { ...state, staff: state.staff.filter((s) => s.id !== id) }
  emit()
}

/* clients */

export function saveClient(next: Client, was?: string): void {
  state = {
    ...state,
    clients: was
      ? state.clients.map((c) => (c.n === was ? { ...c, ...next } : c))
      : [...state.clients, next],
  }
  emit()
}

export function removeClient(name: string): void {
  state = { ...state, clients: state.clients.filter((c) => c.n !== name) }
  emit()
}

/* departments */

export function saveDept(next: Omit<Dept, 'id'>, id?: string): void {
  const old = id ? state.depts.find((d) => d.id === id)?.n : null
  const depts = id
    ? state.depts.map((d) => (d.id === id ? { ...d, ...next } : d))
    : [...state.depts, { ...next, id: nextId('d', state.depts.map((d) => d.id)) }]

  /* A rename has to carry through everything that named the old one, or a
     department quietly loses its people and its QC pairing. */
  const renamed = old && old !== next.n
  state = {
    ...state,
    depts: renamed ? depts.map((d) => (d.pair === old ? { ...d, pair: next.n } : d)) : depts,
    staff: renamed
      ? state.staff.map((s) => ({ ...s, dep: s.dep.map((x) => (x === old ? next.n : x)) }))
      : state.staff,
  }
  emit()
}

export function removeDept(id: string): void {
  const d = state.depts.find((x) => x.id === id)
  if (!d) return
  state = {
    ...state,
    depts: state.depts.filter((x) => x.id !== id).map((x) => (x.pair === d.n ? { ...x, pair: null } : x)),
    staff: state.staff.map((s) => ({ ...s, dep: s.dep.filter((x) => x !== d.n) })),
  }
  emit()
}

/* roles */

/** The permissions the admin role always keeps — a workspace cannot lock itself out. */
export const ADMIN_FLOOR = ['all', 'people', 'config']

export function saveRole(next: Omit<Role, 'id'>, id?: string): string {
  if (id === 'admin') for (const k of ADMIN_FLOOR) if (!next.p.includes(k)) next.p.push(k)
  const made = id ?? nextId('r', state.roles.map((r) => r.id))
  state = {
    ...state,
    roles: id
      ? state.roles.map((r) => (r.id === id ? { ...r, ...next } : r))
      : [...state.roles, { ...next, id: made }],
  }
  emit()
  return made
}

/** Everyone holding a removed role drops back to Staff, never to nothing. */
export function removeRole(id: string): void {
  const r = state.roles.find((x) => x.id === id)
  if (!r || r.lock) return
  state = {
    ...state,
    roles: state.roles.filter((x) => x.id !== id),
    staff: state.staff.map((s) => (s.r === id ? { ...s, r: 'staff' } : s)),
  }
  emit()
}

/* permissions */

export function savePerm(wording: string, k?: string): void {
  if (k) {
    state = { ...state, perms: state.perms.map((p) => (p.k === k ? { ...p, n: wording } : p)) }
  } else {
    let key = keyOf(wording)
    let n = 2
    while (state.perms.some((p) => p.k === key)) key = `${keyOf(wording)}${n++}`
    state = { ...state, perms: [...state.perms, { k: key, n: wording, sys: false }] }
  }
  emit()
}

/** Removing a permission takes it off every role that had it ticked. */
export function removePerm(k: string): void {
  const p = state.perms.find((x) => x.k === k)
  if (!p || p.sys) return
  state = {
    ...state,
    perms: state.perms.filter((x) => x.k !== k),
    roles: state.roles.map((r) => ({ ...r, p: r.p.filter((x) => x !== k) })),
  }
  emit()
}

/* statuses */

export function saveStatus(name: string, colour: string, k?: string): void {
  if (k) {
    state = { ...state, statuses: state.statuses.map((s) => (s[0] === k ? [k, [name, colour]] : s)) }
  } else {
    let key = keyOf(name)
    let n = 2
    while (state.statuses.some(([x]) => x === key)) key = `${keyOf(name)}${n++}`
    state = { ...state, statuses: [...state.statuses, [key, [name, colour]]] }
  }
  emit()
}

export function removeStatus(k: string): void {
  state = { ...state, statuses: state.statuses.filter(([x]) => x !== k) }
  emit()
}

/** Puts the seed back. For tests, which must not inherit each other's settings. */
export function resetCompany(): void {
  state = SEED
  emit()
}
