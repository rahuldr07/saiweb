import { COUNTIES, LINKCHECK, LINKTYPES } from '@/data/catalog'
import { now } from '@/lib/clock'
import { createStore, useStore } from '@/lib/store'
import type { County, CountyLink, LinkCheckConfig, LinkType } from '@/data/types'

interface Coverage {
  counties: County[]
  linkTypes: LinkType[]
  check: LinkCheckConfig
}

const store = createStore<Coverage>({ counties: COUNTIES, linkTypes: LINKTYPES, check: LINKCHECK })

export const useCoverage = (): Coverage => useStore(store)

export const currentCounties = (): County[] => store.get().counties
export const currentLinkTypes = (): LinkType[] => store.get().linkTypes
export const currentCheck = (): LinkCheckConfig => store.get().check

export const sameCounty = (c: County, n: string, st: string) =>
  c.n.toLowerCase() === n.toLowerCase().trim() && c.st === st

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

export const linkTypeKey = (name: string) =>
  name.toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 20) || 'link'

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
  if (!a || !b) return
  linkTypes[i] = b
  linkTypes[i + dir] = a
  store.set({ ...coverage, linkTypes })
}

export function typeUsage(k: string, bad: readonly string[]) {
  const { counties } = store.get()
  const held = counties.filter((c) => c.links[k]?.u).length
  return {
    held,
    missing: counties.length - held,
    bad: counties.filter((c) => c.links[k] && bad.includes(c.links[k].s)).length,
  }
}

export function setCheckEvery(days: number): void {
  if (!(days > 0)) return
  store.update((coverage) => ({ ...coverage, check: { ...coverage.check, every: days } }))
}

export function setCheckNotify(notify: string): void {
  store.update((coverage) => ({ ...coverage, check: { ...coverage.check, notify } }))
}

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

export const resetCoverage = store.reset
