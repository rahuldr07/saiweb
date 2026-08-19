/**
 * The coverage ladder, as edited on Assignment → Levels.
 *
 * Editing a level moves everybody on it, so this is deliberately one shared store
 * rather than local state in the tab. What it does *not* do is re-run the day: the
 * design's own wording is that a change here moves people "tonight", so today's
 * completed placements stay as they were placed.
 */
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { LEVELS } from '@/data/org'
import { STAFF } from '@/data/people'
import { COUNTIES, LINKTYPES, PRODUCTS } from '@/data/catalog'
import { makeCoverage } from '@/lib/coverage'
import type { County, Level } from '@/data/types'

type LevelsValue = ReturnType<typeof makeCoverage> & {
  levels: Level[]
  counties: County[]
  /** null means "no level" — unrestricted, not "covers nothing". */
  personLevel: (id: string) => string | null
  selected: string | null
  select: (id: string) => void
  setCov: (lid: string, k: CovKey, v?: string) => void
  setCounty: (lid: string, st: string, co: string) => void
  addCounty: (st: string, name: string) => { ok: true } | { ok: false; error: string }
  setPersonLevel: (id: string, lid: string) => string
  addLevel: () => string
  rename: (lid: string, v: string) => void
  setNote: (lid: string, v: string) => void
  /** Refuses while anybody is still on it — see the comment at the call site. */
  remove: (lid: string) => { ok: true } | { ok: false; held: typeof STAFF }
}

type CovKey = 'state' | 'allstates' | 'addstate' | 'nostates' | 'allproducts' | 'noproducts' | 'product'

const Ctx = createContext<LevelsValue | null>(null)

const clone = (l: Level): Level => ({
  ...l,
  states: l.states === 'all' ? 'all' : [...l.states],
  products: l.products === 'all' ? 'all' : [...l.products],
  counties: Object.fromEntries(Object.entries(l.counties ?? {}).map(([k, v]) => [k, [...(v ?? [])]])),
})

export function LevelsProvider({ children }: { children: ReactNode }) {
  const [levels, setLevels] = useState<Level[]>(() => LEVELS.map(clone))
  const [counties, setCounties] = useState<County[]>(() => [...COUNTIES])
  const [moved, setMoved] = useState<Record<string, string | null>>({})
  const [selected, setSelected] = useState<string | null>(() => LEVELS[0]?.id ?? null)

  const personLevel = useCallback(
    (id: string) => (id in moved ? moved[id] : (STAFF.find((x) => x.id === id)?.lvl ?? null)),
    [moved],
  )

  const cov = useMemo(() => makeCoverage(levels, personLevel, counties), [levels, personLevel, counties])

  /* clone() always materialises counties, so the callback can treat it as present. */
  const edit = useCallback((lid: string, fn: (l: Level & { counties: Record<string, string[]> }) => void) => {
    setLevels((prev) =>
      prev.map((l) => {
        if (l.id !== lid) return l
        const next = clone(l) as Level & { counties: Record<string, string[]> }
        fn(next)
        return next
      }),
    )
  }, [])

  const allStateCodes = useMemo(() => [...new Set(counties.map((c) => c.st))].sort(), [counties])
  const countiesOf = useCallback(
    (st: string) =>
      counties
        .filter((c) => c.st === st)
        .map((c) => c.n)
        .sort(),
    [counties],
  )

  const setCov = useCallback<LevelsValue['setCov']>(
    (lid, k, v) =>
      edit(lid, (l) => {
        if (k === 'state' && v) {
          if (l.states === 'all') l.states = allStateCodes
          const has = l.states.includes(v)
          l.states = has ? l.states.filter((x) => x !== v) : [...l.states, v]
          if (has) delete l.counties[v]
        }
        if (k === 'allstates') {
          l.states = 'all'
          l.counties = {}
        }
        if (k === 'addstate' && v) {
          if (l.states === 'all') return
          if (!l.states.includes(v)) l.states = [...l.states, v]
        }
        if (k === 'nostates') {
          l.states = []
          l.counties = {}
        }
        if (k === 'allproducts') l.products = 'all'
        if (k === 'noproducts') l.products = []
        if (k === 'product' && v) {
          if (l.products === 'all') l.products = PRODUCTS.map((x) => x.id)
          l.products = l.products.includes(v) ? l.products.filter((x) => x !== v) : [...l.products, v]
          if (l.products.length === PRODUCTS.length) l.products = 'all'
        }
      }),
    [edit, allStateCodes],
  )

  const setCounty = useCallback<LevelsValue['setCounty']>(
    (lid, st, co) =>
      edit(lid, (l) => {
        if (l.states === 'all') l.states = allStateCodes
        if (!l.states.includes(st)) l.states = [...l.states, st]
        /* Every pill is drawn on when no counties are named, so clicking a lit one
           has to turn that one off and leave the rest — expand to the full list first. */
        const all = countiesOf(st)
        const cur = l.counties[st]?.length ? l.counties[st]! : all
        const next = cur.includes(co) ? cur.filter((x) => x !== co) : [...cur, co]
        if (!next.length || next.length === all.length) delete l.counties[st]
        else l.counties[st] = next
      }),
    [edit, allStateCodes, countiesOf],
  )

  /* A county added from the level that needs it goes onto the same list the rest of
     the app reads, with no links — so it surfaces under Counties as a gap to fill
     rather than quietly existing only inside a level. */
  const addCounty = useCallback<LevelsValue['addCounty']>(
    (st, name) => {
      const n = name.trim()
      if (!n) return { ok: false, error: 'A county name is required.' }
      if (counties.some((c) => c.n.toLowerCase() === n.toLowerCase() && c.st === st))
        return { ok: false, error: `${n}, ${st} is already on file.` }
      const links = Object.fromEntries(LINKTYPES.map((t) => [t.k, { u: '', s: 'none' }]))
      setCounties((prev) => [...prev, { n, st, idx: null, links } as County])
      return { ok: true }
    },
    [counties],
  )

  const setPerson = useCallback<LevelsValue['setPersonLevel']>(
    (id, lid) => {
      setMoved((prev) => ({ ...prev, [id]: lid || null }))
      const p = STAFF.find((x) => x.id === id)
      const l = levels.find((x) => x.id === lid)
      return lid ? `${p?.n} → ${l?.n}` : `${p?.n} has no level — takes anything`
    },
    [levels],
  )

  const addLevel = useCallback(() => {
    const id = 'lv' + Math.random().toString(36).slice(2, 8)
    setLevels((prev) => [
      ...prev,
      { id, n: `Level ${prev.length + 1}`, note: '', states: [], counties: {}, products: [] },
    ])
    setSelected(id)
    return id
  }, [])

  const remove = useCallback<LevelsValue['remove']>(
    (lid) => {
      const held = STAFF.filter((s) => personLevel(s.id) === lid && s.active !== false)
      /* Removing a level out from under somebody would silently widen what they can
         be given, which is the one change nobody would notice. */
      if (held.length) return { ok: false, held }
      setLevels((prev) => {
        const next = prev.filter((l) => l.id !== lid)
        setSelected((s) => (s === lid ? (next[0]?.id ?? null) : s))
        return next
      })
      return { ok: true }
    },
    [personLevel],
  )

  const value = useMemo<LevelsValue>(
    () => ({
      ...cov,
      levels,
      counties,
      personLevel,
      selected,
      select: setSelected,
      setCov,
      setCounty,
      addCounty,
      setPersonLevel: setPerson,
      addLevel,
      rename: (lid, v) => {
        const n = v.trim()
        if (n) edit(lid, (l) => void (l.n = n))
      },
      setNote: (lid, v) => edit(lid, (l) => void (l.note = v.trim())),
      remove,
    }),
    [cov, levels, counties, personLevel, selected, setCov, setCounty, addCounty, setPerson, addLevel, remove, edit],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useLevels() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useLevels must be used inside <LevelsProvider>')
  return v
}
