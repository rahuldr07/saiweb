import { describe, expect, it } from 'vitest'
import { LEADS, STALE_BAD, STALE_WARN } from '@/data/business'
import { LSTATUS } from '@/data/budget'
import { isStale, lastTouch, leadAge, needsFollowUp, staleness } from '@/lib/derived'
import type { Lead } from '@/data/types'

/**
 * A lead surfaces itself.
 *
 * There is nothing to schedule and no due date to keep up to date, so the whole
 * screen rests on one derivation: how long since the last note. If that can be
 * made to disagree with the colour on the row, the register stops meaning
 * anything — which is why these pin the derivation rather than the numbers.
 */

const daysAgo = (n: number) => {
  const d = new Date(2026, 7, 3, 12, 0)
  d.setDate(d.getDate() - n)
  return d
}

const lead = (over: Partial<Lead> = {}): Lead => ({
  id: 'lx',
  co: 'Test Title Co',
  loc: 'Austin, TX',
  st: 'contacted',
  own: 'hw',
  contacts: [{ n: 'A Person', role: 'Orders', e: 'a@example.com', p: '' }],
  notes: [{ w: 'hw', at: daysAgo(1), t: 'Spoke to them.' }],
  ...over,
})

describe('how long since the last note', () => {
  it('takes the most recent note, not the last one in the array', () => {
    const l = lead({
      notes: [
        { w: 'hw', at: daysAgo(40), t: 'first' },
        { w: 'hw', at: daysAgo(2), t: 'most recent' },
        { w: 'hw', at: daysAgo(20), t: 'middle' },
      ],
    })
    expect(lastTouch(l).getTime()).toBe(daysAgo(2).getTime())
  })

  it('measures every seeded lead against a note it actually has', () => {
    LEADS.forEach((l) => {
      expect(l.notes.length, `${l.co} has no notes to measure from`).toBeGreaterThan(0)
      expect(leadAge(l), `${l.co} has a negative age`).toBeGreaterThanOrEqual(0)
    })
  })
})

describe('the colour on the row', () => {
  it('turns amber at the warning threshold and red at the bad one', () => {
    expect(staleness(lead({ notes: [{ w: 'hw', at: daysAgo(0), t: 'today' }] }))).toBe('ok')
    expect(staleness(lead({ notes: [{ w: 'hw', at: daysAgo(STALE_WARN - 1), t: 'x' }] }))).toBe('ok')
    expect(staleness(lead({ notes: [{ w: 'hw', at: daysAgo(STALE_WARN), t: 'x' }] }))).toBe('warn')
    expect(staleness(lead({ notes: [{ w: 'hw', at: daysAgo(STALE_BAD - 1), t: 'x' }] }))).toBe('warn')
    expect(staleness(lead({ notes: [{ w: 'hw', at: daysAgo(STALE_BAD), t: 'x' }] }))).toBe('bad')
  })

  it('escalates rather than skipping — amber always precedes red', () => {
    expect(STALE_WARN).toBeLessThan(STALE_BAD)
  })

  /* Won, lost and "not now" are not waiting on anybody. Colouring them by age
     would be scolding somebody about work that is already finished. */
  it('leaves settled leads alone however old they are', () => {
    const ancient = { notes: [{ w: 'hw', at: daysAgo(400), t: 'long ago' }] }
    ;(['won', 'lost', 'notnow'] as const).forEach((st) => {
      expect(staleness(lead({ st, ...ancient })), st).toBe('ok')
      expect(isStale(lead({ st, ...ancient })), st).toBe(false)
    })
    expect(staleness(lead({ st: 'contacted', ...ancient }))).toBe('bad')
  })
})

describe('what needs following up', () => {
  it('counts a lead flagged by hand even when it is fresh', () => {
    expect(needsFollowUp(lead({ flag: true }))).toBe(true)
    expect(needsFollowUp(lead({ flag: false }))).toBe(false)
  })

  it('counts one that has simply gone quiet, with nobody flagging it', () => {
    const quiet = lead({ notes: [{ w: 'hw', at: daysAgo(STALE_WARN + 1), t: 'x' }] })
    expect(quiet.flag).toBeUndefined()
    expect(needsFollowUp(quiet)).toBe(true)
  })

  /* Won and lost drop out even when flagged — closing one is what clears it,
     and the register would otherwise keep asking about a deal already made. */
  it('drops won and lost, flag or no flag', () => {
    expect(needsFollowUp(lead({ st: 'won', flag: true }))).toBe(false)
    expect(needsFollowUp(lead({ st: 'lost', flag: true }))).toBe(false)
    /* "Not now" is different: it is not settled, so a flag still counts. */
    expect(needsFollowUp(lead({ st: 'notnow', flag: true }))).toBe(true)
  })
})

describe('the register’s vocabulary', () => {
  it('has a label and a chip for every status a lead can hold', () => {
    LEADS.forEach((l) => {
      expect(LSTATUS[l.st], `${l.co} has status "${l.st}" with no label`).toBeDefined()
    })
  })

  it('gives every seeded lead a main contact to show', () => {
    LEADS.forEach((l) => {
      const main = l.contacts.find((c) => c.main) ?? l.contacts[0]
      expect(main, `${l.co} has no contact at all`).toBeDefined()
    })
  })
})
