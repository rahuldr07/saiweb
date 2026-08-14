/**
 * Who is qualified for which place and which product.
 *
 * Somebody with no level is not restricted — defaulting the other way would mean
 * a new joiner can be given nothing until an admin remembers to grade them.
 * Naming no counties for a state means the whole state, not none of it.
 */
import { LEVELS, COVSTAGES } from '@/data/org'
import { STAFF } from '@/data/people'
import { COUNTIES, US_STATES } from '@/data/catalog'
import type { Level } from '@/data/types'

const NOLIMIT: Level = { id: '', n: '', note: '', states: 'all', counties: {}, products: 'all' }

export const levelOf = (id: string): Level | null => {
  const p = STAFF.find((x) => x.id === id)
  return p?.lvl ? (LEVELS.find((l) => l.id === p.lvl) ?? null) : null
}

export const covOf = (id: string): Level => levelOf(id) ?? NOLIMIT

export const stateName = (st: string) => US_STATES[st] ?? st

/** Every state — a level must be able to say "Ohio" before a single Ohio county is on file. */
export const EVERYSTATE = () => Object.keys(US_STATES)

/** Only the states we actually hold counties for; gap analysis uses this one. */
export const ALLSTATES = () => [...new Set(COUNTIES.map((c) => c.st))].sort()

export const countiesIn = (st: string) =>
  COUNTIES.filter((c) => c.st === st)
    .map((c) => c.n)
    .sort()

export function coversPlace(id: string, st: string, co: string | null): boolean {
  const c = covOf(id)
  if (c.states !== 'all' && !c.states.includes(st)) return false
  const named = c.counties?.[st]
  if (!named || !named.length) return true
  return !co || named.includes(co)
}

export const coversProduct = (id: string, pr: string): boolean => {
  const c = covOf(id)
  return c.products === 'all' || c.products.includes(pr)
}

export const levelOpen = (l: Level) =>
  l.states === 'all' && l.products === 'all' && !Object.values(l.counties ?? {}).some((v) => v?.length)

export const coversAll = (id: string) => levelOpen(covOf(id))

export const onLevel = (lid: string) => STAFF.filter((s) => s.lvl === lid && s.active !== false)

export function covWord(c: Level): string {
  const st = c.states === 'all' ? 'every state' : `${c.states.length} state${c.states.length === 1 ? '' : 's'}`
  const pr =
    c.products === 'all' ? 'every product' : `${c.products.length} product${c.products.length === 1 ? '' : 's'}`
  return `${st}, ${pr}`
}

export const covSummary = (id: string) => {
  const l = levelOf(id)
  return l ? `${l.n} — ${covWord(l)}` : 'No level — takes anything'
}

export { COVSTAGES }
