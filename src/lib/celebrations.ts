import { parseUsDate } from './format'
import type { Person } from '@/data/types'
import { midnight } from '@/lib/format'

export type CelebrationKind = 'birthday' | 'anniversary'

export interface Celebration {
  person: Person
  kind: CelebrationKind
  years: number
  at: Date
  inDays: number
}


const dayGap = (from: Date, to: Date) =>
  Math.round((midnight(to).getTime() - midnight(from).getTime()) / 86400000)

export function anniversaryIn(original: Date, year: number): Date {
  const month = original.getMonth()
  const day = original.getDate()
  const candidate = new Date(year, month, day)
  return candidate.getMonth() === month ? candidate : new Date(year, month + 1, 0)
}

function next(person: Person, raw: string, kind: CelebrationKind, on: Date): Celebration | null {
  const original = raw ? parseUsDate(raw) : null
  if (!original || Number.isNaN(original.getTime())) return null
  if (midnight(original) > midnight(on)) return null

  let at = anniversaryIn(original, on.getFullYear())
  if (dayGap(on, at) < 0) at = anniversaryIn(original, on.getFullYear() + 1)

  const years = at.getFullYear() - original.getFullYear()
  if (years < 1) return null

  return { person, kind, years, at, inDays: dayGap(on, at) }
}

const eligible = (staff: Person[]) => staff.filter((p) => p.active !== false)

export function celebrationsOn(staff: Person[], on: Date): Celebration[] {
  return celebrationsWithin(staff, on, 0)
}

export function celebrationsWithin(staff: Person[], on: Date, days: number): Celebration[] {
  const found: Celebration[] = []
  for (const person of eligible(staff)) {
    for (const [raw, kind] of [
      [person.dob, 'birthday'],
      [person.doj, 'anniversary'],
    ] as [string, CelebrationKind][]) {
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

export function wishIcon(c: Celebration): string {
  return c.kind === 'birthday' ? '🎂' : '🎉'
}

export function wishFor(c: Celebration): string {
  if (c.kind === 'birthday') return 'Happy birthday'
  return c.years === 1 ? 'One year today' : `${c.years} years today`
}

export function wishNote(c: Celebration, firstName: string): string {
  if (c.kind === 'birthday') {
    return `Many happy returns, ${firstName}. From everyone at the company.`
  }
  return c.years === 1
    ? `${firstName}, you completed your first year today. Thank you for the year — here is to the next one.`
    : `${firstName} completed ${c.years} years today. Thank you for every one of them.`
}

export function aboutOther(c: Celebration): string {
  const first = c.person.n.split(' ')[0]
  if (c.kind === 'birthday') return `It is ${first}’s birthday`
  return c.years === 1 ? `${first} completes a year today` : `${first} completes ${c.years} years`
}

export const whenWord = (inDays: number) =>
  inDays === 0 ? 'today' : inDays === 1 ? 'tomorrow' : `in ${inDays} days`
