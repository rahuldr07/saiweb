import { PAYCFG } from '@/data/hrms'
import { DEPTLIST, PERMS, ROLELIST, STATUS, TENANTS } from '@/data/org'
import { STAFF } from '@/data/people'
import { CLIENTS } from '@/data/catalog'
import { BUDGET, SLA, type SlaRule } from '@/data/budget'
import { createStore, useStore, useStoreSlice } from '@/lib/store'
import type { Client, Dept, PayConfig, Perm, Person, Role, Tenant } from '@/data/types'

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
  profile: { name: FIRST?.name ?? '', state: FIRST?.state ?? '', tz: 'India Standard Time' },
  depts: DEPTLIST,
  statuses: Object.entries(STATUS),
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

export const currentPayCfg = (): PayConfig => store.get().pay

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

export function setProfile(key: keyof CompanyState['profile'], value: string): void {
  const v = value.trim()
  if (!v) return
  store.update((prev) => ({ ...prev, profile: { ...prev.profile, [key]: v } }))
}

export const useDepartments = (): Dept[] => useStoreSlice(store, (c) => c.depts)
export const useStatuses = () => useStoreSlice(store, (c) => c.statuses)
export const useNaming = (): NamingRow[] => useStoreSlice(store, (c) => c.naming)

export function moveDept(id: string, dir: -1 | 1): void {
  const depts = [...store.get().depts]
  const i = depts.findIndex((d) => d.id === id)
  const a = depts[i]
  const b = depts[i + dir]
  if (!a || !b) return
  depts[i] = b
  depts[i + dir] = a
  store.update((prev) => ({ ...prev, depts }))
}

export function moveStatus(key: string, dir: -1 | 1): void {
  const statuses = [...store.get().statuses]
  const i = statuses.findIndex(([k]) => k === key)
  const a = statuses[i]
  const b = statuses[i + dir]
  if (!a || !b) return
  statuses[i] = b
  statuses[i + dir] = a
  store.update((prev) => ({ ...prev, statuses }))
}

export function setNaming(concept: string, name: string): void {
  const v = name.trim()
  if (!v) return
  store.update((prev) => ({
    ...prev,
    naming: prev.naming.map((r) => (r.concept === concept ? { ...r, name: v } : r)),
  }))
}

export const useSla = (): SlaRule[] => useStoreSlice(store, (c) => c.sla)
export const useBudget = (): Budget => useStoreSlice(store, (c) => c.budget)
export const useClock = (): ClockCfg => useStoreSlice(store, (c) => c.clock)

export const currentSla = (): SlaRule[] => store.get().sla
export const currentBudget = (): Budget => store.get().budget

export function setSlaHours(i: number, v: string): void {
  const h = parseInt(v, 10)
  if (!(h > 0)) return
  store.update((prev) => ({ ...prev, sla: prev.sla.map((r, j) => (j === i ? { ...r, h: Math.min(336, h) } : r)) }))
}

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

export const useStaff = (): Person[] => useStoreSlice(store, (c) => c.staff)
export const useClients = (): Client[] => useStoreSlice(store, (c) => c.clients)
export const useRoles = (): Role[] => useStoreSlice(store, (c) => c.roles)
export const usePerms = (): Perm[] => useStoreSlice(store, (c) => c.perms)

const nextId = (prefix: string, taken: string[]) => {
  let n = 1
  while (taken.includes(`${prefix}${n}`)) n++
  return `${prefix}${n}`
}

const keyOf = (n: string) => n.toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 20) || 'perm'

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

export function saveDept(next: Omit<Dept, 'id'>, id?: string): void {
  const old = id ? store.get().depts.find((d) => d.id === id)?.n : null
  const depts = id
    ? store.get().depts.map((d) => (d.id === id ? { ...d, ...next } : d))
    : [...store.get().depts, { ...next, id: nextId('d', store.get().depts.map((d) => d.id)) }]

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

export const ADMIN_FLOOR = ['all', 'people', 'config']

export function saveRole(next: Omit<Role, 'id'>, id?: string): string {
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

export function removeRole(id: string): void {
  const r = store.get().roles.find((x) => x.id === id)
  if (!r || r.lock) return
  store.update((prev) => ({
    ...prev,
    roles: prev.roles.filter((x) => x.id !== id),
    staff: prev.staff.map((s) => (s.r === id ? { ...s, r: 'staff' } : s)),
  }))
}

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

export function removePerm(k: string): void {
  const p = store.get().perms.find((x) => x.k === k)
  if (!p || p.sys) return
  store.update((prev) => ({
    ...prev,
    perms: prev.perms.filter((x) => x.k !== k),
    roles: prev.roles.map((r) => ({ ...r, p: r.p.filter((x) => x !== k) })),
  }))
}

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

export const resetCompany = store.reset
