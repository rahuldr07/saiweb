import { describe, expect, it } from 'vitest'
import {
  aboutOther,
  anniversaryIn,
  celebrationsOn,
  celebrationsWithin,
  whenWord,
  wishFor,
} from '@/lib/celebrations'
import { STAFF } from '@/data/people'
import type { Person } from '@/data/types'

/**
 * Wishes are derived from the joining date and the date of birth on a person's
 * record — nothing is stored as an event. These pin the edges that decide
 * whether the derivation is trustworthy: the day someone joined is not an
 * anniversary, a future date is a typo rather than a milestone, and 29 February
 * still comes round in a common year.
 */

const person = (over: Partial<Person>): Person =>
  ({ ...STAFF[0], id: 'x', n: 'Test Person', active: true, ...over })

const on = (y: number, m: number, d: number) => new Date(y, m - 1, d)

describe('when an anniversary falls', () => {
  it('is the same day in a later year', () => {
    expect(anniversaryIn(on(2020, 8, 20), 2026)).toEqual(on(2026, 8, 20))
  })

  /* A person born on the 29th has a birthday every year. Skipping three years in
     four because the calendar is awkward is the version nobody wants. */
  it('observes 29 February on the 28th in a common year', () => {
    expect(anniversaryIn(on(2020, 2, 29), 2026)).toEqual(on(2026, 2, 28))
  })

  it('keeps 29 February in a leap year', () => {
    expect(anniversaryIn(on(2020, 2, 29), 2028)).toEqual(on(2028, 2, 29))
  })
})

describe('what counts as a milestone', () => {
  it('does not congratulate anybody on the day they joined', () => {
    const p = person({ doj: '08/03/2026', dob: '' })
    expect(celebrationsOn([p], on(2026, 8, 3))).toEqual([])
  })

  it('does congratulate them a year later', () => {
    const p = person({ doj: '08/03/2025', dob: '' })
    const [c] = celebrationsOn([p], on(2026, 8, 3))
    expect(c.kind).toBe('anniversary')
    expect(c.years).toBe(1)
  })

  /* A joining date after today is a mis-key, and wishing somebody a happy
     anniversary for a job they have not started is how the feature gets
     switched off. */
  it('ignores a date in the future', () => {
    const p = person({ doj: '01/01/2030', dob: '12/25/2030' })
    expect(celebrationsWithin([p], on(2026, 8, 3), 365)).toEqual([])
  })

  it('ignores somebody who has left', () => {
    const p = person({ doj: '08/03/2020', dob: '', active: false })
    expect(celebrationsOn([p], on(2026, 8, 3))).toEqual([])
  })

  it('ignores a record with no dates on it', () => {
    const p = person({ doj: '', dob: '' })
    expect(celebrationsOn([p], on(2026, 8, 3))).toEqual([])
  })
})

describe('counting the years', () => {
  it('counts completed years, not calendar years crossed', () => {
    const p = person({ doj: '12/31/2023', dob: '' })
    /* One day short of two years is still one year completed. */
    const [almost] = celebrationsWithin([p], on(2025, 12, 30), 2)
    expect(almost.years).toBe(2)
    expect(almost.inDays).toBe(1)
  })

  it('rolls to the next year once this one has passed', () => {
    const p = person({ doj: '08/07/2023', dob: '' })
    const [c] = celebrationsWithin([p], on(2026, 8, 8), 400)
    expect(c.years).toBe(4)
    expect(c.at.getFullYear()).toBe(2027)
  })
})

describe('the window', () => {
  const roster = [
    person({ id: 'a', n: 'Anne A', dob: '08/03/1990', doj: '01/01/2020' }),
    person({ id: 'b', n: 'Bob B', dob: '01/01/1990', doj: '08/07/2023' }),
    person({ id: 'c', n: 'Cara C', dob: '09/20/1990', doj: '09/20/2020' }),
  ]

  it('today only, for a zero-day window', () => {
    const today = celebrationsOn(roster, on(2026, 8, 3))
    expect(today.map((c) => c.person.id)).toEqual(['a'])
  })

  it('reaches forward without reaching back', () => {
    const week = celebrationsWithin(roster, on(2026, 8, 3), 7)
    expect(week.map((c) => `${c.person.id}:${c.kind}`)).toEqual(['a:birthday', 'b:anniversary'])
    expect(week.every((c) => c.inDays >= 0)).toBe(true)
  })

  it('puts the soonest first, and a birthday before an anniversary on one day', () => {
    const both = person({ id: 'd', n: 'Dev D', dob: '08/03/1990', doj: '08/03/2020' })
    const list = celebrationsOn([both], on(2026, 8, 3))
    expect(list.map((c) => c.kind)).toEqual(['birthday', 'anniversary'])
  })
})

describe('what it says', () => {
  const at = (doj: string) => celebrationsOn([person({ doj, dob: '' })], on(2026, 8, 3))[0]

  it('calls the first year out by name', () => {
    expect(wishFor(at('08/03/2025'))).toBe('One year today')
    expect(aboutOther(at('08/03/2025'))).toMatch(/completes a year today/)
  })

  it('counts later ones', () => {
    expect(wishFor(at('08/03/2020'))).toBe('6 years today')
  })

  it('says when, in words', () => {
    expect(whenWord(0)).toBe('today')
    expect(whenWord(1)).toBe('tomorrow')
    expect(whenWord(4)).toBe('in 4 days')
  })
})

describe('against the seeded roster', () => {
  it('gives everybody a usable date of birth', () => {
    const missing = STAFF.filter((p) => p.active !== false && !p.dob)
    expect(missing.map((p) => p.n)).toEqual([])
  })

  /* The placeholder every record shipped with. One shared birthday makes the
     whole feature meaningless, so this fails if the redaction ever comes back. */
  it('does not put the whole company on one birthday', () => {
    const days = new Set(STAFF.map((p) => p.dob.slice(0, 5)))
    expect(days.size).toBeGreaterThan(20)
  })

  it('never reports more years than the person has been here', () => {
    const list = celebrationsWithin(STAFF, new Date(2026, 7, 3), 366)
    for (const c of list.filter((x) => x.kind === 'anniversary')) {
      const joined = Number(c.person.doj.split('/')[2])
      expect(c.years).toBe(c.at.getFullYear() - joined)
      expect(c.years).toBeGreaterThan(0)
    }
  })
})
