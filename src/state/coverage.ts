import { useSyncExternalStore } from 'react'
import { COUNTIES, LINKCHECK, LINKTYPES } from '@/data/catalog'
import { now } from '@/lib/clock'
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
 * produces new ones, which is what lets `useSyncExternalStore` see it and what
 * stops an edit here from silently altering what other importers of `COUNTIES`
 * observe.
 */

interface Coverage {
  counties: County[]
  linkTypes: LinkType[]
  /** How often the checker runs, who it tells, and when it last ran. */
  check: LinkCheckConfig
}

let coverage: Coverage = { counties: COUNTIES, linkTypes: LINKTYPES, check: LINKCHECK }

const listeners = new Set<() => void>()
const emit = () => {
  for (const l of listeners) l()
}
const subscribe = (fn: () => void) => {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
const snapshot = () => coverage

export const useCoverage = (): Coverage => useSyncExternalStore(subscribe, snapshot, snapshot)

/**
 * The live arrays, for the plain functions in `lib/derived.ts` that cannot use a
 * hook. Reading through here rather than importing the seed directly is what
 * keeps the link monitor's figures and this screen's edits in agreement.
 */
export const currentCounties = (): County[] => coverage.counties
export const currentLinkTypes = (): LinkType[] => coverage.linkTypes
export const currentCheck = (): LinkCheckConfig => coverage.check

export const sameCounty = (c: County, n: string, st: string) =>
  c.n.toLowerCase() === n.toLowerCase().trim() && c.st === st

export const findCountyIn = (counties: County[], n: string, st?: string) =>
  counties.find((c) => c.n.toLowerCase() === n.toLowerCase().trim() && (!st || c.st === st))

/* ── counties ───────────────────────────────────────────────────────────── */

/** Adds a county, or replaces the one identified by `was`. */
export function saveCounty(
  next: { n: string; st: string; idx: number | null; links: Record<string, CountyLink> },
  was?: { n: string; st: string },
): void {
  const counties = was
    ? coverage.counties.map((c) => (sameCounty(c, was.n, was.st) ? { ...c, ...next } : c))
    : [...coverage.counties, next as County]
  coverage = { ...coverage, counties }
  emit()
}

export function removeCounty(n: string, st: string): void {
  coverage = { ...coverage, counties: coverage.counties.filter((c) => !sameCounty(c, n, st)) }
  emit()
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
  coverage = {
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
  }
  emit()
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
  if (k) {
    coverage = {
      ...coverage,
      linkTypes: coverage.linkTypes.map((x) => (x.k === k ? { ...x, ...t } : x)),
    }
  } else {
    let key = linkTypeKey(t.n)
    let n = 2
    while (coverage.linkTypes.some((x) => x.k === key)) key = `${linkTypeKey(t.n)}${n++}`
    coverage = {
      ...coverage,
      linkTypes: [...coverage.linkTypes, { k: key, ...t }],
      counties: coverage.counties.map((c) => ({
        ...c,
        links: { ...c.links, [key]: { u: '', s: 'none' } },
      })),
    }
  }
  emit()
}

export function removeLinkType(k: string): void {
  coverage = {
    ...coverage,
    linkTypes: coverage.linkTypes.filter((x) => x.k !== k),
    counties: coverage.counties.map((c) => {
      const { [k]: _gone, ...links } = c.links
      return { ...c, links }
    }),
  }
  emit()
}

export function moveLinkType(k: string, dir: -1 | 1): void {
  const i = coverage.linkTypes.findIndex((x) => x.k === k)
  const j = i + dir
  if (i < 0 || j < 0 || j >= coverage.linkTypes.length) return
  const linkTypes = [...coverage.linkTypes]
  ;[linkTypes[i], linkTypes[j]] = [linkTypes[j], linkTypes[i]]
  coverage = { ...coverage, linkTypes }
  emit()
}

/** How many counties hold this type, and how many of those are not working. */
export function typeUsage(k: string, bad: readonly string[]) {
  const held = coverage.counties.filter((c) => c.links[k]?.u).length
  return {
    held,
    missing: coverage.counties.length - held,
    bad: coverage.counties.filter((c) => c.links[k] && bad.includes(c.links[k].s)).length,
  }
}

/* ── the checker ────────────────────────────────────────────────────────── */

export function setCheckEvery(days: number): void {
  if (!(days > 0)) return
  coverage = { ...coverage, check: { ...coverage.check, every: days } }
  emit()
}

export function setCheckNotify(notify: string): void {
  coverage = { ...coverage, check: { ...coverage.check, notify } }
  emit()
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
  coverage = { ...coverage, counties, check: { ...coverage.check, last: now() } }
  emit()
  return { checked, stillBroken: brokenCount() }
}

/** Links in a state the workspace treats as failing. */
const FAILING = ['broken', 'moved', 'auth', 'slow']
const brokenCount = () =>
  coverage.counties.reduce(
    (n, c) =>
      n + coverage.linkTypes.filter((t) => c.links[t.k] && FAILING.includes(c.links[t.k].s)).length,
    0,
  )

/** Puts the seed back. For tests, which must not inherit each other's edits. */
export function resetCoverage(): void {
  coverage = { counties: COUNTIES, linkTypes: LINKTYPES, check: LINKCHECK }
  emit()
}
