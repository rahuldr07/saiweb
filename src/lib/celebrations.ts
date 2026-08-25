/**
 * Birthdays and service anniversaries.
 *
 * Both are the same shape of question — "does this MM/DD fall today?" — and both
 * are derived from the person's record rather than stored as an event, so a
 * corrected joining date moves the anniversary with it and nothing has to be
 * re-entered. That is the same rule the rest of this codebase follows: no
 * duplicate of a fact that is already on the record.
 *
 * Two edges are decided here rather than at each call site:
 *
 *  - **The day you joined is not an anniversary.** Zero completed years is a
 *    start date, and congratulating someone on it reads as a mistake.
 *  - **29 February is observed on the 28th** in a common year. A person born on
 *    the 29th has a birthday every year; skipping three years in four because the
 *    calendar is awkward is the version nobody wants.
 */
import { parseUsDate } from './format'
import type { Person } from '@/data/types'

export type CelebrationKind = 'birthday' | 'anniversary'

export interface Celebration {
  person: Person
  kind: CelebrationKind
  /** Completed years of service, or the age being reached. */
  years: number
  /** When it falls, in the year being asked about. */
  at: Date
  /** Whole days from the reference date. 0 is today. */
  inDays: number
}

const midnight = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())

const dayGap = (from: Date, to: Date) =>
  Math.round((midnight(to).getTime() - midnight(from).getTime()) / 86400000)

/**
 * The date an anniversary of `original` falls on in `year`.
 *
 * Returns 28 February for a 29 February original in a common year — see the note
 * at the top of this file.
 */
export function anniversaryIn(original: Date, year: number): Date {
  const month = original.getMonth()
  const day = original.getDate()
  const candidate = new Date(year, month, day)
  /* An overflowed day rolls into the next month, which is how a 29 February
     original in a common year shows up. Pull it back to the last day of the
     intended month. */
  return candidate.getMonth() === month ? candidate : new Date(year, month + 1, 0)
}

/** One person's next occurrence of a dated milestone, or null when unusable. */
function next(
  person: Person,
  raw: string | undefined,
  kind: CelebrationKind,
  on: Date,
): Celebration | null {
  const original = raw ? parseUsDate(raw) : null
  if (!original || Number.isNaN(original.getTime())) return null
  /* A date in the future is a typo, not a milestone. */
  if (midnight(original) > midnight(on)) return null

  let at = anniversaryIn(original, on.getFullYear())
  if (dayGap(on, at) < 0) at = anniversaryIn(original, on.getFullYear() + 1)

  const years = at.getFullYear() - original.getFullYear()
  /* Joining today, or being born today, is not an anniversary of anything. */
  if (years < 1) return null

  return { person, kind, years, at, inDays: dayGap(on, at) }
}

const eligible = (staff: Person[]) => staff.filter((p) => p.active !== false)

/** Everything falling on `on`, birthdays before anniversaries. */
export function celebrationsOn(staff: Person[], on: Date): Celebration[] {
  return celebrationsWithin(staff, on, 0)
}

/**
 * Everything falling between `on` and `days` after it, soonest first.
 *
 * `days: 0` is today only, which is what `celebrationsOn` asks for.
 */
export function celebrationsWithin(staff: Person[], on: Date, days: number): Celebration[] {
  const found: Celebration[] = []
  for (const person of eligible(staff)) {
    for (const [raw, kind] of [
      [person.dob, 'birthday'],
      [person.doj, 'anniversary'],
    ] as [string | undefined, CelebrationKind][]) {
      const c = next(person, raw, kind, on)
      if (c && c.inDays <= days) found.push(c)
    }
  }
  return found.sort(
    (a, b) =>
      a.inDays - b.inDays ||
      (a.kind === b.kind ? 0 : a.kind === 'birthday' ? -1 : 1) ||
      a.person.n.localeCompare(b.person.n),
  )
}

/* ── wording ────────────────────────────────────────────────────────────── */

/**
 * What the card says to the person themselves.
 *
 * The first year is called out separately because it is the one that means
 * something operationally — probation is behind them — as well as personally.
 */
export function wishFor(c: Celebration): string {
  if (c.kind === 'birthday') return 'Happy birthday'
  return c.years === 1 ? 'One year today' : `${c.years} years today`
}

/** The line under it, addressed to the person whose day it is. */
export function wishNote(c: Celebration, firstName: string): string {
  if (c.kind === 'birthday') {
    return `Many happy returns, ${firstName}. From everyone at the company.`
  }
  return c.years === 1
    ? `${firstName}, you completed your first year today. Thank you for the year — here is to the next one.`
    : `${firstName} completed ${c.years} years today. Thank you for every one of them.`
}

/** The same event described to a colleague, so they can say something. */
export function aboutOther(c: Celebration): string {
  const first = c.person.n.split(' ')[0]
  if (c.kind === 'birthday') return `It is ${first}’s birthday`
  return c.years === 1 ? `${first} completes a year today` : `${first} completes ${c.years} years`
}

/** `today`, `tomorrow`, `in 4 days` — how the upcoming list reads. */
export const whenWord = (inDays: number) =>
  inDays === 0 ? 'today' : inDays === 1 ? 'tomorrow' : `in ${inDays} days`
