import { LEAVE, LEAVEPOLICY, LEAVETYPES } from '@/data/hrms'
import { STAFF } from '@/data/people'
import { leaveBalance } from './payroll'
import { now } from './clock'
import type { Leave, Person } from '@/data/types'
import { fmtDate, midnight, r2 } from '@/lib/format'

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

export function managerOf(p: Person | undefined): Person | null {
  if (!p) return null
  const lead = STAFF.find(
    (x) => x.r === 'lead' && x.active !== false && x.id !== p.id && x.dep.some((d) => p.dep.includes(d)),
  )
  if (lead) return lead
  const anyLead = STAFF.find((x) => x.r === 'lead' && x.active !== false && x.id !== p.id)
  return anyLead ?? STAFF.find((x) => x.r === 'admin' && x.active !== false) ?? null
}

export const approvesFor = (id: string) =>
  STAFF.filter((p) => p.dep.length && managerOf(p)?.id === id)

const overlaps = (aFrom: Date, aTo: Date, bFrom: Date, bTo: Date) => aFrom <= bTo && bFrom <= aTo


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

export function deptCover(pid: string, from: Date, to: Date): Cover | null {
  const p = STAFF.find((x) => x.id === pid)
  const dep = p?.dep[0]
  if (!p || !dep) return null
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

export interface Note {
  kind: 'v' | 'r' | 'd' | 'plain'
  title?: string
  body: string
}

export interface LeaveCheck {
  notes: Note[]
  blocked: boolean
  needReason: boolean
  cover: Cover | null
  clash: Leave[]
  short: number
  notice: number
  overBalance: number
}


const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

export function leaveCheck(pid: string, typeKey: string, days: number, from: Date, to: Date): LeaveCheck {
  const balance = leaveBalance(pid)[typeKey] ?? { left: 0, earned: 0, taken: 0, pending: 0, annual: 0 }
  const cover = deptCover(pid, from, to)
  const clash = clashesWith(pid, from, to)
  const type = LEAVETYPES.find((x) => x.k === typeKey)
  const short = cover ? Math.max(0, LEAVEPOLICY.minCover - cover.left) : 0
  const notice = Math.round((midnight(from).getTime() - midnight(now()).getTime()) / 86400000)

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
      return `${who} (${fmtDate(x.from)}–${fmtDate(x.to)})`
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
