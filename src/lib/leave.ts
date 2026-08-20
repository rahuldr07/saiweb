/**
 * What a leave request means.
 *
 * One place decides it, and the form, the send and the record the approver reads
 * all ask the same question — otherwise a request can pass a form that warned
 * about nothing and arrive with a warning attached, or the reverse.
 *
 * Nothing here refuses a person outright except by explicit policy. Blocking is
 * the strictest setting and the most likely to be worked around: somebody simply
 * does not record the day, and then the register is wrong as well as the roster.
 */
import { LEAVE, LEAVEPOLICY, LEAVETYPES } from '@/data/hrms'
import { STAFF } from '@/data/people'
import { leaveBalance } from './payroll'
import { now } from './clock'
import type { Leave, Person } from '@/data/types'

/** What to do when a request would leave a department below cover. */
export const CLASHRULES: Record<string, [label: string, detail: string]> = {
  warn: ['Warn only', 'Tell them, let them send it anyway. The approver decides.'],
  reason: [
    'Ask for a reason',
    'They may still send it, but must say why the department can manage. That reason reaches the approver.',
  ],
  block: [
    'Do not allow it',
    'The request cannot be sent while cover would fall below the minimum.',
  ],
}

/**
 * Who decides this person's leave.
 *
 * A named owner rather than a queue anybody might pick up: their own lead if the
 * department has one, otherwise any lead, otherwise the company admin.
 */
export function managerOf(p: Person | undefined): Person | null {
  if (!p) return null
  const lead = STAFF.find(
    (x) => x.r === 'lead' && x.active !== false && x.id !== p.id && x.dep.some((d) => p.dep.includes(d)),
  )
  if (lead) return lead
  const anyLead = STAFF.find((x) => x.r === 'lead' && x.active !== false && x.id !== p.id)
  return anyLead ?? STAFF.find((x) => x.r === 'admin' && x.active !== false) ?? null
}

/** The people whose requests land with this person. */
export const approvesFor = (id: string) =>
  STAFF.filter((p) => p.dep.length && managerOf(p)?.id === id)

const overlaps = (aFrom: Date, aTo: Date, bFrom: Date, bTo: Date) => aFrom <= bTo && bFrom <= aTo

const midnight = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()

/** Others in the same department already off across these dates. */
export function clashesWith(pid: string, from: Date, to: Date): Leave[] {
  const p = STAFF.find((x) => x.id === pid)
  if (!p) return []
  return LEAVE.filter(
    (l) =>
      l.who !== pid &&
      ['approved', 'pending'].includes(l.st) &&
      overlaps(from, to, l.from, l.to) &&
      (STAFF.find((x) => x.id === l.who)?.dep ?? []).some((d) => p.dep.includes(d)),
  )
}

export interface Cover {
  dep: string
  team: number
  off: number
  left: number
}

/** How many of a department would still be working across these dates. */
export function deptCover(pid: string, from: Date, to: Date): Cover | null {
  const p = STAFF.find((x) => x.id === pid)
  if (!p || !p.dep.length) return null
  const dep = p.dep[0]
  const team = STAFF.filter((x) => x.dep.includes(dep) && x.active !== false)
  const off = team.filter(
    (x) =>
      x.id === pid ||
      LEAVE.some(
        (l) => l.who === x.id && ['approved', 'pending'].includes(l.st) && overlaps(from, to, l.from, l.to),
      ),
  )
  return { dep, team: team.length, off: off.length, left: team.length - off.length }
}

/** One thing the form has to say about a request, and how loudly. */
export interface Note {
  kind: 'v' | 'r' | 'd' | 'plain'
  title?: string
  body: string
}

export interface LeaveCheck {
  notes: Note[]
  /** Policy forbids sending it as it stands. */
  blocked: boolean
  /** Sendable, but they must say how the department will manage. */
  needReason: boolean
  cover: Cover | null
  clash: Leave[]
  /** How far below the required cover this would take the department. */
  short: number
  /** Whole days between today and the start date. */
  notice: number
  /** Days taken beyond the balance — these become unpaid. */
  overBalance: number
}

const r2 = (n: number) => Math.round(n * 100) / 100

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

/**
 * Everything a request is judged on, in one pass.
 *
 * The notice figure is whole days between midnights — comparing a date against a
 * timestamp made a request starting today read as minus one day's notice.
 */
export function leaveCheck(pid: string, typeKey: string, days: number, from: Date, to: Date): LeaveCheck {
  const balance = leaveBalance(pid)[typeKey] ?? { left: 0, earned: 0, taken: 0, pending: 0, annual: 0 }
  const cover = deptCover(pid, from, to)
  const clash = clashesWith(pid, from, to)
  const type = LEAVETYPES.find((x) => x.k === typeKey)
  const short = cover ? Math.max(0, LEAVEPOLICY.minCover - cover.left) : 0
  const notice = Math.round((midnight(from) - midnight(now())) / 86400000)

  const notes: Note[] = []
  let blocked = false
  let needReason = false

  if (type && (type.annual || typeKey === 'co')) {
    notes.push(
      days > balance.left
        ? {
            kind: 'd',
            title: `${plural(r2(days - balance.left), 'day')} beyond your balance`,
            body: `${balance.left} left of ${balance.earned} earned. The excess is taken as unpaid leave and shows on your payslip as a deduction.`,
          }
        : {
            kind: 'v',
            body: `${plural(r2(balance.left - days), 'day')} would remain.`,
          },
    )
  }

  if (days > LEAVEPOLICY.maxConsecutive) {
    notes.push({
      kind: 'r',
      title: `${days} days at once, against a normal maximum of ${LEAVEPOLICY.maxConsecutive}.`,
      body: 'Send it if you need to, but talk to your manager as well — a form is not the right way to ask for this.',
    })
  }

  if (notice < LEAVEPOLICY.noticeDays && notice >= 0) {
    notes.push({
      kind: 'r',
      title: `${notice === 0 ? 'Starting today' : plural(notice, 'day') + ' notice'}, against ${LEAVEPOLICY.noticeDays} normally expected.`,
      body: 'Allowed, and the approver will see that it was short notice.',
    })
  }

  if (cover && (short > 0 || clash.length)) {
    const names = clash.map((x) => {
      const who = STAFF.find((s) => s.id === x.who)?.n ?? x.who
      return `${who} (${x.from.toLocaleDateString('en-US')}–${x.to.toLocaleDateString('en-US')})`
    })
    if (short > 0) {
      blocked = LEAVEPOLICY.clashRule === 'block'
      needReason = LEAVEPOLICY.clashRule === 'reason'
      notes.push({
        kind: cover.left <= 0 ? 'd' : 'r',
        title:
          cover.left <= 0
            ? `${cover.dep} would have nobody working`
            : `${cover.dep} would be down to ${cover.left} of ${cover.team}`,
        body:
          `${names.length ? `Already off across these dates: ${names.join(', ')}. ` : ''}` +
          `The policy asks for at least ${LEAVEPOLICY.minCover} working. ` +
          (blocked
            ? 'This request cannot be sent while that is true. Agree cover with someone first, or pick different dates.'
            : needReason
              ? 'You can still send it — say below how the department will manage, and the approver will see it.'
              : 'Worth agreeing cover before you send it.'),
      })
    } else {
      notes.push({
        kind: 'plain',
        body: `${names.join(', ')} ${clash.length === 1 ? 'is' : 'are'} also off then. ${cover.dep} keeps ${cover.left} of ${cover.team} — within policy.`,
      })
    }
  }

  return {
    notes,
    blocked,
    needReason,
    cover,
    clash,
    short,
    notice,
    overBalance: Math.max(0, days - (balance.left || 0)),
  }
}
