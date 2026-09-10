import { HOLIDAYS, STAFF } from '@/data/people'
import { ATT, LEAVE, PAYMONTHS, TIMECFG } from '@/data/hrms'
import { now } from './clock'
import { fmtDate, pad } from './format'
import { mins, shiftByKey } from './workingDay'
import type { LateMark, Regularisation } from '@/data/types'

const seeded = (seed: number) => {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
}

const dAgo = (n: number) => {
  const d = now()
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - n)
}

const rostered = () => STAFF.filter((p) => p.dep.length && p.active !== false)

const WAS = [
  'No check-out recorded',
  'Checked in at 10:40',
  'No punch at all',
  'Checked out at 13:10',
] as const
const ASK = [
  'Worked 09:30 to 18:30',
  'Was at the sub-registrar office',
  'App would not open',
  'Power cut, worked on mobile',
] as const

export function makeRegularisations(): Regularisation[] {
  const r = seeded(20260307)
  const out: Regularisation[] = []
  let id = 7100
  rostered()
    .slice(0, 9)
    .forEach((p) => {
      if (r() < 0.55) return
      out.push({
        id: `R${id++}`,
        who: p.id,
        d: dAgo(1 + Math.floor(r() * 12)),
        was: WAS[Math.floor(r() * WAS.length)] ?? WAS[0],
        ask: ASK[Math.floor(r() * ASK.length)] ?? ASK[0],
        st: 'pending',
      })
    })
  return out
}

const LATEREASONS: (string | null)[] = [
  'Power cut at home',
  'Traffic — Outer Ring Road',
  'Network down, could not punch',
  'Cab did not arrive',
  'Unwell in the morning',
  'Handover ran past midnight',
  null,
  null,
  null,
  null,
]

export function makeLateLog(): LateMark[] {
  const r = seeded(20260311)
  const out: LateMark[] = []
  const list = rostered()
  const today = now()

  for (let back = 29; back >= 0; back--) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - back)
    if (d.getDay() === 0) continue
    if (HOLIDAYS.some((h) => h.d === fmtDate(d) && !h.opt)) continue

    list.forEach((p) => {
      if (r() > 0.11) return
      const sh = shiftByKey(p.shift)
      const late = 3 + Math.floor(r() * 74)
      if (late <= TIMECFG.lateGraceMins) return
      const at = mins(sh.from) + late
      out.push({
        id: `LT${out.length}`,
        who: p.id,
        d,
        dk: fmtDate(d),
        shift: sh.n,
        due: sh.from,
        at: `${pad(Math.floor(at / 60) % 24)}:${pad(at % 60)}`,
        mins: late,
        why: LATEREASONS[Math.floor(r() * LATEREASONS.length)] ?? null,
        waived: false,
      })
    })
  }
  return out.sort((a, b) => b.d.getTime() - a.d.getTime())
}

export interface AbsencePattern {
  lop: number
  mondays: number
  fridays: number
  single: number
  flags: [string, string][]
  total: number
}

export function absencePattern(id: string): AbsencePattern {
  const taken = LEAVE.filter((l) => l.who === id && l.st === 'approved')
  const lop = PAYMONTHS.reduce((a, m) => a + (ATT[m]?.[id]?.lop ?? 0), 0)
  const mondays = taken.filter((l) => l.from.getDay() === 1).length
  const fridays = taken.filter((l) => l.from.getDay() === 5).length
  const single = taken.filter((l) => l.days <= 1).length

  const flags: [string, string][] = []
  if (lop >= 3) {
    flags.push([
      `${lop} unpaid days across ${PAYMONTHS.length} months`,
      'Unpaid days mean the balance ran out. Worth knowing why before it becomes a deduction they resent.',
    ])
  }
  if (mondays >= 3) {
    flags.push([
      `${mondays} absences began on a Monday`,
      'A pattern rather than a coincidence at three. Usually says something about the weekend shift, not the person.',
    ])
  }
  if (fridays >= 3) {
    flags.push([
      `${fridays} absences began on a Friday`,
      'Same reading as Mondays — look at what Friday is like before treating it as attendance.',
    ])
  }
  if (single >= 5) {
    flags.push([
      `${single} single-day absences`,
      'Frequent short absences read differently from one long one, and are harder for a department to plan around.',
    ])
  }

  return { lop, mondays, fridays, single, flags, total: taken.reduce((a, l) => a + l.days, 0) }
}
