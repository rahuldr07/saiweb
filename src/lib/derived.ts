import { BADSTATES } from '@/data/catalog'
import {
  currentCheck as CHECK_OF,
  currentCounties as COUNTIES_OF,
  currentLinkTypes as LINKTYPES_OF,
} from '@/state/counties'
import { ORDERS } from '@/data/production'
import { LEADS, STALE_BAD, STALE_WARN } from '@/data/business'
import { STAFF } from '@/data/people'
import { DEPTLIST } from '@/data/org'
import { now } from '@/lib/clock'
import { fmtDate, orderState } from '@/lib/format'
import type { ChipKind, County, CountyLink, Lead, LinkStatus } from '@/data/types'

export const days = (d: Date) => Math.floor((now().getTime() - d.getTime()) / 86400000)

export const openOrders = () => ORDERS.filter((o) => !o.done)
export const pastDue = () => ORDERS.filter((o) => orderState(o) === 'late')
export const atRisk = () => ORDERS.filter((o) => orderState(o) === 'soon')

export const pastDueCount = () => pastDue().length
export const atRiskCount = () => atRisk().length
export const openCount = () => openOrders().length

export const lastTouch = (l: Lead) =>
  l.notes.reduce((a, n) => (n.at > a ? n.at : a), l.notes[0]?.at ?? new Date(0))

export const leadAge = (l: Lead) => days(lastTouch(l))

export const isStale = (l: Lead) =>
  !['won', 'lost', 'notnow'].includes(l.st) && leadAge(l) >= STALE_WARN

export type Staleness = 'ok' | 'warn' | 'bad'

export const staleness = (l: Lead): Staleness => {
  if (['won', 'lost', 'notnow'].includes(l.st)) return 'ok'
  const age = leadAge(l)
  return age >= STALE_BAD ? 'bad' : age >= STALE_WARN ? 'warn' : 'ok'
}

export const needsFollowUp = (l: Lead) => !['won', 'lost'].includes(l.st) && (l.flag || isStale(l))

export const followUpCount = () => LEADS.filter(needsFollowUp).length

export const LSTATE: Record<LinkStatus, [string, ChipKind]> = {
  ok: ['Working', 'v'],
  slow: ['Slow', 'r'],
  moved: ['Moved', 'r'],
  auth: ['Login required', 'r'],
  broken: ['Not working', 'd'],
  none: ['No link on file', 'n'],
  unchecked: ['Never checked', 'n'],
}

export interface FlatLink {
  c: County
  k: string
  lbl: string
  l: CountyLink
}

export const allLinks = (): FlatLink[] =>
  COUNTIES_OF().flatMap((c) =>
    LINKTYPES_OF().flatMap((t) => {
      const l = c.links[t.k]
      return l ? [{ c, k: t.k, lbl: t.n, l }] : []
    }),
  )

export const brokenLinks = () => allLinks().filter((x) => BADSTATES.includes(x.l.s))

export const nextLinkCheck = () => {
  const c = CHECK_OF()
  return new Date(c.last.getTime() + c.every * 86400000)
}

export function linkStats() {
  const a = allLinks()
  const by = {} as Record<LinkStatus, number>
  ;(Object.keys(LSTATE) as LinkStatus[]).forEach((k) => {
    by[k] = a.filter((x) => x.l.s === k).length
  })
  return {
    total: a.length,
    by,
    bad: brokenLinks().length,
    types: LINKTYPES_OF().length,
    covered: a.filter((x) => x.l.s !== 'none').length,
  }
}

export const findCounty = (n: string, st?: string) =>
  COUNTIES_OF().find(
    (c) => c.n.toLowerCase() === String(n).toLowerCase().trim() && (!st || c.st === st),
  )

export const thinDepts = () =>
  DEPTLIST.filter(
    (d) => STAFF.filter((x) => x.dep.includes(d.n) && x.active !== false && x.avail === 'ok').length === 0,
  )

export interface Alert {
  sev: 'bad' | 'warn'
  t: string
  d: string
  go: string
}

export function alerts(): Alert[] {
  const out: Alert[] = []
  const bl = brokenLinks()
  if (bl.length) {
    const names = [...new Set(bl.map((x) => x.c.n))]
    const since = days(CHECK_OF().last)
    out.push({
      sev: 'bad',
      t: `${bl.length} county link${bl.length === 1 ? '' : 's'} not working`,
      d: `${names.slice(0, 3).join(', ')}${names.length > 3 ? ' and others' : ''} — found by the check ${
        since === 0 ? 'today' : since + ' days ago'
      }`,
      go: 'linkcheck',
    })
  }
  if (now() >= nextLinkCheck()) {
    out.push({
      sev: 'warn',
      t: 'Link check is due',
      d: `Every ${CHECK_OF().every} days · last ran ${fmtDate(CHECK_OF().last)}`,
      go: 'linkcheck',
    })
  }
  const overdue = pastDueCount()
  if (overdue) {
    out.push({
      sev: 'bad',
      t: `${overdue} order${overdue === 1 ? '' : 's'} past due`,
      d: 'The client is already owed an explanation',
      go: 'orders',
    })
  }
  const fu = followUpCount()
  if (fu) {
    out.push({
      sev: 'warn',
      t: `${fu} lead${fu === 1 ? '' : 's'} need following up`,
      d: 'Flagged, or gone quiet on their own',
      go: 'leads',
    })
  }
  const thin = thinDepts()
  if (thin.length) {
    out.push({
      sev: 'bad',
      t: `${thin.map((d) => d.n).join(', ')} has nobody available`,
      d: 'Any order needing that stage has nowhere to go',
      go: 'company',
    })
  }
  return out
}
