/**
 * The things people raise about their own attendance.
 *
 * Corrections and late marks are generated rather than typed out, because what
 * matters is the shape — a handful of corrections waiting, a scatter of late
 * punches with a couple of repeat offenders — not any particular row. The
 * generator is seeded, so the figures are the same on every load and a screenshot
 * still matches the screen.
 */
import { HOLIDAYS, SHIFTS, STAFF } from '@/data/people'
import { ATT, LEAVE, PAYMONTHS, TIMECFG } from '@/data/hrms'
import { now } from './clock'
import { fmtDate, pad } from './format'
import type { LateMark, Regularisation } from '@/data/types'

/** A linear congruential generator — small, and identical run to run. */
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

const shiftFor = (k: string) => SHIFTS.find((s) => s.k === k) ?? SHIFTS[0]

/* ── corrections ────────────────────────────────────────────────────────── */

const WAS = [
  'No check-out recorded',
  'Checked in at 10:40',
  'No punch at all',
  'Checked out at 13:10',
]
const ASK = [
  'Worked 09:30 to 18:30',
  'Was at the sub-registrar office',
  'App would not open',
  'Power cut, worked on mobile',
]

/**
 * A correction is a claim about a day the clock got wrong. Approving one moves
 * the payslip for that month, which is exactly why it needs a person.
 */
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
        was: WAS[Math.floor(r() * WAS.length)],
        ask: ASK[Math.floor(r() * ASK.length)],
        st: 'pending',
      })
    })
  return out
}

/* ── late logins ────────────────────────────────────────────────────────── */

/** Four of the ten are null: most late marks come with no reason at all. */
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

/**
 * Thirty days of late marks.
 *
 * Sundays and non-optional holidays are skipped — nobody is late for a day they
 * were not due — and anything inside the grace period never becomes a mark at
 * all, which is the difference between a grace period and a warning.
 */
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
      const sh = shiftFor(p.shift)
      const late = 3 + Math.floor(r() * 74)
      if (late <= TIMECFG.lateGraceMins) return
      const [h, m] = sh.from.split(':').map(Number)
      const at = h * 60 + m + late
      out.push({
        id: `LT${out.length}`,
        who: p.id,
        d,
        dk: fmtDate(d),
        shift: sh.n,
        due: sh.from,
        at: `${pad(Math.floor(at / 60) % 24)}:${pad(at % 60)}`,
        mins: late,
        why: LATEREASONS[Math.floor(r() * LATEREASONS.length)],
        waived: false,
      })
    })
  }
  return out.sort((a, b) => b.d.getTime() - a.d.getTime())
}

/* ── absence patterns ───────────────────────────────────────────────────── */

export interface AbsencePattern {
  lop: number
  mondays: number
  fridays: number
  single: number
  /** [what was noticed, how to read it] */
  flags: [string, string][]
  total: number
}

/**
 * Absence is only worth acting on as a pattern.
 *
 * One day off is a day off; the same Monday three times is a conversation. Every
 * flag here is phrased as something to ask about rather than something to
 * enforce, because the usual cause is a shift that does not fit somebody's
 * commute or household — which a warning does not fix.
 */
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
