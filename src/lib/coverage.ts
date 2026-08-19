/**
 * Who is qualified for which place and which product.
 *
 * Somebody with no level is not restricted — defaulting the other way would mean
 * a new joiner can be given nothing until an admin remembers to grade them.
 * Naming no counties for a state means the whole state, not none of it.
 *
 * The rules are built by `makeCoverage` so they can be asked of the live, edited
 * levels on the Levels tab as well as of the seed the engine ran against.
 */
import { LEVELS, COVSTAGES } from '@/data/org'
import { STAFF } from '@/data/people'
import { COUNTIES, PRODUCTS, US_STATES } from '@/data/catalog'
import type { County, Level } from '@/data/types'

const NOLIMIT: Level = { id: '', n: '', note: '', states: 'all', counties: {}, products: 'all' }

export const stateName = (st: string) => US_STATES[st] ?? st

/** Every state — a level must be able to say "Ohio" before a single Ohio county is on file. */
export const EVERYSTATE = () => Object.keys(US_STATES)

export const levelOpen = (l: Level) =>
  l.states === 'all' && l.products === 'all' && !Object.values(l.counties ?? {}).some((v) => v?.length)

/** A level read back as a phrase — what the pills add up to. */
export function covWord(c: Level): string {
  const st = c.states === 'all' ? 'every state' : `${c.states.length} state${c.states.length === 1 ? '' : 's'}`
  const narrowed = Object.entries(c.counties ?? {}).filter(([, v]) => v?.length)
  const co = narrowed.length
    ? ` (${narrowed.map(([k, v]) => `${k}: ${v!.length} count${v!.length === 1 ? 'y' : 'ies'}`).join(', ')})`
    : ''
  const pr =
    c.products === 'all' ? 'every product' : `${c.products.length} product${c.products.length === 1 ? '' : 's'}`
  return `${st}${co} · ${pr}`
}

export type Gap =
  | { kind: 'place'; stage: string; st: string; co: string; near: string[] }
  | { kind: 'product'; stage: string; pr: string; near: string[] }

/**
 * Coverage answered against a given set of levels.
 *
 * `personLevel` is passed separately from STAFF because the Levels tab moves
 * people between levels without editing the seed.
 */
export function makeCoverage(levels: Level[], personLevel: (id: string) => string | null, counties: County[]) {
  const levelOf = (id: string): Level | null => {
    const lid = personLevel(id)
    return lid ? (levels.find((l) => l.id === lid) ?? null) : null
  }
  const covOf = (id: string): Level => levelOf(id) ?? NOLIMIT

  /** Only the states we actually hold counties for; gap analysis uses this one. */
  const allStates = () => [...new Set(counties.map((c) => c.st))].sort()

  const countiesIn = (st: string) =>
    counties
      .filter((c) => c.st === st)
      .map((c) => c.n)
      .sort()

  function coversPlace(id: string, st: string, co: string | null): boolean {
    const c = covOf(id)
    if (c.states !== 'all' && !c.states.includes(st)) return false
    const named = c.counties?.[st]
    if (!named || !named.length) return true
    return !co || named.includes(co)
  }

  const coversProduct = (id: string, pr: string): boolean => {
    const c = covOf(id)
    return c.products === 'all' || c.products.includes(pr)
  }

  const onLevel = (lid: string) =>
    STAFF.filter((s) => personLevel(s.id) === lid && s.active !== false)

  const covSummary = (id: string) => {
    const l = levelOf(id)
    return l ? `${l.n} — ${covWord(l)}` : 'No level — takes anything'
  }

  /**
   * A level read back as a sentence. The pills say what is ticked; this says what
   * that means, which is the thing somebody actually wants to check before saving.
   */
  function levelSentence(l: Level): string {
    const prods = l.products === 'all' ? 'Every product' : l.products.length ? l.products.join(', ') : 'No products'
    if (l.products !== 'all' && !l.products.length)
      return 'Covers nothing — no products ticked, so nobody on this level can be given anything.'
    if (l.states !== 'all' && !l.states.length)
      return `${prods}, but no states ticked — so nobody on this level can be given anything.`
    const states = l.states === 'all' ? allStates() : l.states
    const where = states.map((st) => {
      const named = l.counties?.[st]
      return named?.length
        ? `${named.length === 1 ? named[0] : named.slice(0, -1).join(', ') + ' and ' + named[named.length - 1]} in ${st}`
        : `all of ${st}`
    })
    const wl = where.length <= 2 ? where.join(' and ') : where.slice(0, -1).join(', ') + ' and ' + where[where.length - 1]
    const anywhere = l.states === 'all' && !Object.values(l.counties ?? {}).some((v) => v?.length)
    return `${prods} — ${anywhere ? 'anywhere we work' : wl}.`
  }

  /** Where the company has nobody at all — the number that becomes exceptions tomorrow. */
  function coverageGaps(): Gap[] {
    const out: Gap[] = []
    for (const stage of COVSTAGES) {
      const dept = STAFF.filter((s) => s.dep.includes(stage) && s.active !== false)
      for (const st of allStates())
        for (const co of countiesIn(st)) {
          if (!dept.some((s) => coversPlace(s.id, st, co)))
            out.push({
              kind: 'place',
              stage,
              st,
              co,
              near: dept.filter((s) => coversPlace(s.id, st, null)).map((s) => s.id),
            })
        }
      for (const pr of PRODUCTS)
        if (!dept.some((s) => coversProduct(s.id, pr.id)))
          out.push({ kind: 'product', stage, pr: pr.id, near: [] })
    }
    return out
  }

  return {
    levelOf,
    covOf,
    allStates,
    countiesIn,
    coversPlace,
    coversProduct,
    coversAll: (id: string) => levelOpen(covOf(id)),
    onLevel,
    covSummary,
    levelSentence,
    coverageGaps,
  }
}

/* The seed view — what the engine ran against, and what read-only screens show. */
const seed = makeCoverage(LEVELS, (id) => STAFF.find((x) => x.id === id)?.lvl ?? null, COUNTIES)

export const levelOf = seed.levelOf
export const covOf = seed.covOf
export const ALLSTATES = seed.allStates
export const countiesIn = seed.countiesIn
export const coversPlace = seed.coversPlace
export const coversProduct = seed.coversProduct
export const coversAll = seed.coversAll
export const onLevel = seed.onLevel
export const covSummary = seed.covSummary
export const levelSentence = seed.levelSentence
export const coverageGaps = seed.coverageGaps

export { COVSTAGES }
