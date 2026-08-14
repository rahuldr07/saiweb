/**
 * Counters the shell and the dashboard read. All of them derive from the data —
 * nothing here is a stored flag, which is what makes "late = red, everywhere"
 * hold without anyone maintaining it.
 */
import { COUNTIES, LINKTYPES, BADSTATES, LINKCHECK } from '@/data/catalog'
import { ORDERS } from '@/data/production'
import { LEADS, STALE_WARN } from '@/data/business'
import { LEAVE } from '@/data/hrms'
import { STAFF } from '@/data/people'
import { DEPTLIST } from '@/data/org'
import { NOW } from './format'
import type { ChipKind, County, CountyLink, Lead, LinkStatus } from '@/data/types'

export const days = (d: Date) => Math.floor((NOW.getTime() - d.getTime()) / 86400000)

/* ── orders ─────────────────────────────────────────────────────────────── */

export const openOrders = () => ORDERS.filter((o) => !o.done)
export const pastDue = () => openOrders().filter((o) => o.due < NOW)
export const atRisk = () =>
  openOrders().filter((o) => o.due >= NOW && (o.due.getTime() - NOW.getTime()) / 3600000 < 4)

export const PASTDUE = pastDue().length
export const ATRISK = atRisk().length
export const OPEN = openOrders().length

/* ── leads ──────────────────────────────────────────────────────────────── */

export const lastTouch = (l: Lead) =>
  l.notes.reduce((a, n) => (n.at > a ? n.at : a), l.notes[0].at)

export const leadAge = (l: Lead) => days(lastTouch(l))

export const isStale = (l: Lead) =>
  !['won', 'lost', 'notnow'].includes(l.st) && leadAge(l) >= STALE_WARN

/** Flagged by a person, or gone quiet on its own. */
export const needsFollowUp = (l: Lead) => !['won', 'lost'].includes(l.st) && (l.flag || isStale(l))

export const followUpCount = () => LEADS.filter(needsFollowUp).length

/* ── county links ───────────────────────────────────────────────────────── */

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
  COUNTIES.flatMap((c) => LINKTYPES.map((t) => ({ c, k: t.k, lbl: t.n, l: c.links[t.k] })))

export const brokenLinks = () => allLinks().filter((x) => BADSTATES.includes(x.l.s))

export const nextLinkCheck = () => new Date(LINKCHECK.last.getTime() + LINKCHECK.every * 86400000)

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
    types: LINKTYPES.length,
    covered: a.filter((x) => x.l.s !== 'none').length,
  }
}

export const findCounty = (n: string, st?: string) =>
  COUNTIES.find(
    (c) => c.n.toLowerCase() === String(n).toLowerCase().trim() && (!st || c.st === st),
  )

/* ── HR ─────────────────────────────────────────────────────────────────── */

export const pendingLeave = () => LEAVE.filter((l) => l.st === 'pending')

/** Departments with nobody available: any order needing that stage has nowhere to go. */
export const thinDepts = () =>
  DEPTLIST.filter(
    (d) => STAFF.filter((x) => x.dep.includes(d.n) && x.active !== false && x.avail === 'ok').length === 0,
  )

/* ── notifications ──────────────────────────────────────────────────────── */

export interface Alert {
  sev: 'bad' | 'warn'
  t: string
  d: string
  go: string
}

/** What the admin is told about, in the order the design surfaces it. */
export function alerts(): Alert[] {
  const out: Alert[] = []
  const bl = brokenLinks()
  if (bl.length) {
    const names = [...new Set(bl.map((x) => x.c.n))]
    const since = days(LINKCHECK.last)
    out.push({
      sev: 'bad',
      t: `${bl.length} county link${bl.length === 1 ? '' : 's'} not working`,
      d: `${names.slice(0, 3).join(', ')}${names.length > 3 ? ' and others' : ''} — found by the check ${
        since === 0 ? 'today' : since + ' days ago'
      }`,
      go: 'linkcheck',
    })
  }
  if (NOW >= nextLinkCheck()) {
    out.push({
      sev: 'warn',
      t: 'Link check is due',
      d: `Every ${LINKCHECK.every} days · last ran ${LINKCHECK.last.toLocaleDateString('en-US')}`,
      go: 'linkcheck',
    })
  }
  if (PASTDUE) {
    out.push({
      sev: 'bad',
      t: `${PASTDUE} order${PASTDUE === 1 ? '' : 's'} past due`,
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
