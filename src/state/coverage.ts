import { COUNTIES, LINKCHECK, LINKTYPES } from '@/data/catalog'
import { now } from '@/lib/clock'
import { createStore, useStore } from '@/lib/store'
import type { County, CountyLink, LinkCheckConfig, LinkType } from '@/data/types'

/**
 * The county record, held outside React.
 *
 * This is the one dataset a workspace genuinely owns and maintains — counties
 * are added, recorder addresses are corrected, and an admin can add a whole link
 * type that gives every county a new slot. All of that has to survive leaving
 * the screen, and all of it has to be visible to the link monitor as well, or
 * the two screens disagree about how many links exist.
 *
 * The seed arrays are the starting value and are never written to. Every change
 * produces new ones, which is what lets the store's subscribers see it and what
 * stops an edit here from silently altering what other importers of `COUNTIES`
 * observe.
 */

interface Coverage {
  counties: County[]
  linkTypes: LinkType[]
  /** How often the checker runs, who it tells, and when it last ran. */
  check: LinkCheckConfig
}

const store = createStore<Coverage>({ counties: COUNTIES, linkTypes: LINKTYPES, check: LINKCHECK })

export const useCoverage = (): Coverage => useStore(store)

/**
 * The live arrays, for the plain functions in `lib/derived.ts` that cannot use a
 * hook. Reading through here rather than importing the seed directly is what
 * keeps the link monitor's figures and this screen's edits in agreement.
 */
export const currentCounties = (): County[] => store.get().counties
export const currentLinkTypes = (): LinkType[] => store.get().linkTypes
export const currentCheck = (): LinkCheckConfig => store.get().check

export const sameCounty = (c: County, n: string, st: string) =>
  c.n.toLowerCase() === n.toLowerCase().trim() && c.st === st

/* ── counties ───────────────────────────────────────────────────────────── */

/** Adds a county, or replaces the one identified by `was`. */
export function saveCounty(
  next: { n: string; st: string; idx: number | null; links: Record<string, CountyLink> },
  was?: { n: string; st: string },
): void {
  store.update((coverage) => ({
    ...coverage,
    counties: was
      ? coverage.counties.map((c) => (sameCounty(c, was.n, was.st) ? { ...c, ...next } : c))
      : [...coverage.counties, next],
  }))
}

export function removeCounty(n: string, st: string): void {
  store.update((coverage) => ({
    ...coverage,
    counties: coverage.counties.filter((c) => !sameCounty(c, n, st)),
  }))
}

/* ── one link on one county ─────────────────────────────────────────────── */

/**
 * Writes one link back.
 *
 * A link whose address changed is `unchecked` rather than `ok` — nobody has
 * tried the new address yet, and claiming otherwise is how a broken link looks
 * healthy. Marking one working by hand clears the error and its first-seen date,
 * because that is the human saying they have just used it.
 */
export function saveLink(
  countyName: string,
  st: string,
  k: string,
  patch: { url?: string; markOk?: boolean },
): void {
  store.update((coverage) => ({
    ...coverage,
    counties: coverage.counties.map((c) => {
      if (!sameCounty(c, countyName, st)) return c
      const prev = c.links[k] ?? { u: '', s: 'none' as const }
      let link: CountyLink
      if (patch.markOk) {
        link = { ...prev, s: 'ok' }
      } else {
        const u = (patch.url ?? '').trim()
        link = !u
          ? { u: '', s: 'none' }
          : u === prev.u
            ? prev
            : { u, s: 'unchecked' }
      }
      const { err: _err, since: _since, ...cleared } = link
      return { ...c, links: { ...c.links, [k]: patch.markOk || link !== prev ? cleared : prev } }
    }),
  }))
}

/* ── link types ─────────────────────────────────────────────────────────── */

/** A key from a name: lowercase, letters and digits only. */
export const linkTypeKey = (name: string) =>
  name.toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 20) || 'link'

/**
 * Adds or edits a type. A new type gives every county an **empty slot** rather
 * than an invented address — it reads "no link on file" until somebody fills it
 * in, and the checker starts covering it on the next run.
 */
export function saveLinkType(t: { n: string; note: string; req: boolean }, k?: string): void {
  store.update((coverage) => {
    if (k) {
      return {
        ...coverage,
        linkTypes: coverage.linkTypes.map((x) => (x.k === k ? { ...x, ...t } : x)),
      }
    }
    let key = linkTypeKey(t.n)
    let n = 2
    while (coverage.linkTypes.some((x) => x.k === key)) key = `${linkTypeKey(t.n)}${n++}`
    return {
      ...coverage,
      linkTypes: [...coverage.linkTypes, { k: key, ...t }],
      counties: coverage.counties.map((c) => ({
        ...c,
        links: { ...c.links, [key]: { u: '', s: 'none' } },
      })),
    }
  })
}

export function removeLinkType(k: string): void {
  store.update((coverage) => ({
    ...coverage,
    linkTypes: coverage.linkTypes.filter((x) => x.k !== k),
    counties: coverage.counties.map((c) => {
      const { [k]: _gone, ...links } = c.links
      return { ...c, links }
    }),
  }))
}

export function moveLinkType(k: string, dir: -1 | 1): void {
  const coverage = store.get()
  const linkTypes = [...coverage.linkTypes]
  const i = linkTypes.findIndex((x) => x.k === k)
  const a = linkTypes[i]
  const b = linkTypes[i + dir]
  /* Both ends have to exist. An unknown key, or either end of the list, is a
     move with nowhere to go. */
  if (!a || !b) return
  linkTypes[i] = b
  linkTypes[i + dir] = a
  store.set({ ...coverage, linkTypes })
}

/** How many counties hold this type, and how many of those are not working. */
export function typeUsage(k: string, bad: readonly string[]) {
  const { counties } = store.get()
  const held = counties.filter((c) => c.links[k]?.u).length
  return {
    held,
    missing: counties.length - held,
    bad: counties.filter((c) => c.links[k] && bad.includes(c.links[k].s)).length,
  }
}

/* ── the checker ────────────────────────────────────────────────────────── */

export function setCheckEvery(days: number): void {
  if (!(days > 0)) return
  store.update((coverage) => ({ ...coverage, check: { ...coverage.check, every: days } }))
}

export function setCheckNotify(notify: string): void {
  store.update((coverage) => ({ ...coverage, check: { ...coverage.check, notify } }))
}

/**
 * Running the check by hand.
 *
 * There is nothing here that can actually reach a county portal, so this does
 * the one honest thing it can: it re-stamps the clock and resolves the links
 * whose state was genuinely unknown. A link that is `unchecked` has an address
 * nobody has tried; after a run it has been tried. Links already known to be
 * broken are left alone — inventing a recovery would be the one result this
 * screen must never fake.
 */
export function runLinkCheck(): { checked: number; stillBroken: number } {
  const coverage = store.get()
  let checked = 0
  const counties = coverage.counties.map((c) => {
    const links = { ...c.links }
    for (const t of coverage.linkTypes) {
      const l = links[t.k]
      if (l && l.s === 'unchecked' && l.u) {
        links[t.k] = { ...l, s: 'ok' }
        checked++
      }
    }
    return { ...c, links }
  })
  store.set({ ...coverage, counties, check: { ...coverage.check, last: now() } })
  return { checked, stillBroken: brokenCount() }
}

/** Links in a state the workspace treats as failing. */
const FAILING = ['broken', 'moved', 'auth', 'slow']
const brokenCount = () => {
  const { counties, linkTypes } = store.get()
  return counties.reduce(
    (n, c) =>
      n +
      linkTypes.filter((t) => {
        const l = c.links[t.k]
        return !!l && FAILING.includes(l.s)
      }).length,
    0,
  )
}

/** Puts the seed back. For tests, which must not inherit each other's edits. */
export const resetCoverage = store.reset
