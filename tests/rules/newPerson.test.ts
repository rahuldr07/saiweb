import { describe, expect, it } from 'vitest'
import { newPerson, type Person } from '@/data/types'
import { SHIFTS, STAFF } from '@/data/people'
import { celebrationsWithin } from '@/lib/celebrations'

/**
 * `newPerson` is the only thing between the Person type and a record that does
 * not match it.
 *
 * The staff form collects sixteen of the twenty fields a person must have. The
 * other four had come from `{} as Person` — a cast that asserts the fields are
 * there rather than putting them there, which is how the type came to promise a
 * date of birth that the celebrations pass had already stopped believing in.
 *
 * So completeness is the first property here, with the pre-factory shape kept
 * beside it as a counter-example: a completeness check nothing can fail is
 * decoration. After that, the three defaults are checked at the consumers that
 * read them, because "present" is not the same as "usable".
 */

/** Every key of `T` that is not optional. */
type RequiredKey<T> = {
  [K in keyof T]-?: Pick<T, K> extends Required<Pick<T, K>> ? K : never
}[keyof T]

/**
 * The required fields, enumerated so they can be checked at runtime.
 *
 * Typed as a total map, so adding a required field to Person and forgetting this
 * list fails the typecheck here, naming the field, rather than leaving the check
 * below quietly narrower than the type it is guarding.
 */
const REQUIRED: Record<RequiredKey<Person>, true> = {
  id: true,
  n: true,
  dep: true,
  r: true,
  cap: true,
  open: true,
  avail: true,
  active: true,
  shift: true,
  mob: true,
  addr: true,
  emg: true,
  aadhaar: true,
  doj: true,
  dob: true,
  pan: true,
  uan: true,
  esicNo: true,
  bank: true,
  e: true,
}

const REQUIRED_KEYS = Object.keys(REQUIRED) as RequiredKey<Person>[]

/** Which required fields this record does not actually carry, in type order. */
const missingFrom = (rec: Partial<Person>) => REQUIRED_KEYS.filter((k) => rec[k] === undefined)

describe('a record the factory makes', () => {
  it('carries every field the type says it must', () => {
    expect(missingFrom(newPerson())).toEqual([])
  })

  it('unlike the shape the create path used to cast into place', () => {
    /* The counter-example: what StaffForm's submit built before the factory —
       everything the form collects, and nothing else. Transcribed rather than
       imported, because the point is the shape that no longer exists. */
    const asTheFormCollectsIt: Partial<Person> = {
      n: 'Meera Nair',
      e: 'meera.nair@keystoneabstract.com',
      r: 'staff',
      cap: 16,
      avail: 'ok',
      active: true,
      dep: ['Typing'],
      mob: '+91 98765 43210',
      addr: 'Indiranagar, Bengaluru',
      emg: { n: 'Arun Nair', rel: 'Spouse', mob: '+91 98765 43211' },
      doj: '08/03/2026',
      bank: { acct: '50100012345678', ifsc: 'HDFC0000123', name: 'Meera Nair' },
      pan: 'ABCPS1234D',
      uan: '100123456789',
      esicNo: '3100123456789',
      aadhaar: '1234 5678 9012',
    }

    expect(missingFrom(asTheFormCollectsIt)).toEqual(['id', 'open', 'shift', 'dob'])
  })

  it('agrees with the seeded roster about what complete means', () => {
    /* Thirty records written by hand. If their idea of a complete person and the
       factory's disagree, one of the two is wrong. */
    expect(STAFF.flatMap((p) => missingFrom(p).map((k) => `${p.n}: ${k}`))).toEqual([])
  })

  it('hands out its own arrays and objects', () => {
    const a = newPerson()
    const b = newPerson()

    a.dep.push('Search')
    a.emg.n = 'Arun Nair'
    a.bank.acct = '50100012345678'

    expect(b.dep).toEqual([])
    expect(b.emg.n).toBe('')
    expect(b.bank.acct).toBe('')
  })
})

describe('the three fields nobody types', () => {
  it('starts them holding nothing, as a number the day plan can add to', () => {
    /* `open` is what they already carry. Zero is the fact on a first day; an
       absent one would make the load map a mix of numbers and undefined. */
    expect(newPerson().open).toBe(0)
  })

  it('puts them on a shift the roster actually names', () => {
    /* Every lookup in the app falls back to the first shift when the key is
       unknown, so a blank default would still resolve to a nine-thirty start and
       read as deliberate. Having to find the key is what separates the two. */
    const chosen = SHIFTS.find((s) => s.k === newPerson().shift)

    expect(chosen?.n).toBe('India day')
    expect(chosen?.from).toBe('09:30')
  })

  it('gives them no birthday rather than a placeholder one', () => {
    const joined: Person = { ...newPerson(), id: 'nw', n: 'New Joiner', doj: '08/03/2025' }

    /* A full year's window: any date at all in `dob` would put a birthday in it,
       which is what makes the anniversary standing alone the assertion. */
    const year = celebrationsWithin([joined], new Date(2026, 7, 3), 366)

    expect(year.map((c) => c.kind)).toEqual(['anniversary'])
    expect(year[0].years).toBe(1)
  })
})
