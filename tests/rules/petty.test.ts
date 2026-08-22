import { afterEach, describe, expect, it } from 'vitest'
import { COUNTS, PETTY, PETTYCFG } from '@/data/hrms'
import {
  countDrift,
  countDue,
  expectedAt,
  lastCount,
  overCeiling,
  pettyBalance,
  pettyLedger,
  spentWithin,
  total,
  unvouched,
} from '@/lib/petty'
import { resetClock, setClock } from '@/lib/clock'
import type { PettyEntry } from '@/data/types'

afterEach(resetClock)

const entry = (over: Partial<PettyEntry>): PettyEntry => ({
  id: 'X',
  d: new Date(2026, 6, 1),
  kind: 'debit',
  what: 'Something',
  amt: 100,
  by: 'Somebody',
  ref: 'R-1',
  receipt: true,
  ...over,
})

describe('the ledger identity', () => {
  /* The whole screen rests on this one line. If it can drift, every balance on
     it is a number somebody typed rather than a number that was worked out. */
  it('carries previous + credit − debit = new balance on every row', () => {
    for (const row of pettyLedger(PETTY)) {
      const expected = row.kind === 'credit' ? row.before + row.amt : row.before - row.amt
      expect(row.after).toBe(expected)
    }
  })

  it('starts from nothing and ends at the balance', () => {
    const led = pettyLedger(PETTY)
    expect(led[0].before).toBe(0)
    expect(pettyBalance(PETTY)).toBe(led[led.length - 1].after)
  })

  it('is ordered oldest first regardless of how the entries arrive', () => {
    const shuffled = [...PETTY].reverse()
    expect(pettyLedger(shuffled).map((e) => e.id)).toEqual(pettyLedger(PETTY).map((e) => e.id))
  })

  it('holds an empty box at zero rather than throwing', () => {
    expect(pettyBalance([])).toBe(0)
    expect(pettyLedger([])).toEqual([])
    expect(expectedAt([], new Date(2026, 6, 1))).toBe(0)
  })
})

describe('what a count is measured against', () => {
  /* The design shipped counts whose figures did not match the ledger on the day
     they were taken, so the screen rendered "Short by ₹1,200 — Matched." Both
     seeded counts are supposed to reconcile; this is what says so. */
  it('reconciles every seeded count with the ledger on its own date', () => {
    for (const c of COUNTS) {
      expect(countDrift(c, PETTY), `${c.id} on ${c.d.toDateString()} says "${c.note}"`).toBe(0)
    }
  })

  it('reports the ledger as it stood, not as it ended', () => {
    const led = pettyLedger(PETTY)
    const third = led[2]
    expect(expectedAt(PETTY, third.d)).toBe(third.after)
    expect(expectedAt(PETTY, third.d)).not.toBe(pettyBalance(PETTY))
  })

  it('signs the drift so over and short cannot be confused', () => {
    const at = new Date(2026, 6, 5)
    const one = [entry({ kind: 'credit', amt: 1000, d: new Date(2026, 6, 1) })]
    expect(countDrift({ id: 'c', d: at, by: 'x', counted: 1200, note: '' }, one)).toBe(200)
    expect(countDrift({ id: 'c', d: at, by: 'x', counted: 800, note: '' }, one)).toBe(-200)
  })
})

describe('when a count is due', () => {
  it('is always due when the box has never been counted', () => {
    expect(countDue([], PETTYCFG)).toBe(true)
  })

  it('follows the interval the box is run on', () => {
    const counted = new Date(2026, 6, 20)
    const counts = [{ id: 'c', d: counted, by: 'x', counted: 0, note: '' }]

    setClock(() => new Date(2026, 6, 26)) // six days later
    expect(countDue(counts, { ...PETTYCFG, countEvery: 'week' })).toBe(false)

    setClock(() => new Date(2026, 6, 27)) // seven
    expect(countDue(counts, { ...PETTYCFG, countEvery: 'week' })).toBe(true)
    expect(countDue(counts, { ...PETTYCFG, countEvery: 'month' })).toBe(false)

    setClock(() => new Date(2026, 7, 19)) // thirty
    expect(countDue(counts, { ...PETTYCFG, countEvery: 'month' })).toBe(true)
  })

  it('takes the most recent count, not the first in the list', () => {
    const old = { id: 'a', d: new Date(2026, 5, 1), by: 'x', counted: 0, note: '' }
    const recent = { id: 'b', d: new Date(2026, 6, 20), by: 'x', counted: 0, note: '' }
    expect(lastCount([old, recent])?.id).toBe('b')
    expect(lastCount([recent, old])?.id).toBe('b')
  })
})

describe('what the banners are counting', () => {
  it('flags a debit with no receipt and never a credit', () => {
    const es = [
      entry({ id: 'a', kind: 'debit', receipt: false }),
      entry({ id: 'b', kind: 'debit', receipt: true }),
      entry({ id: 'c', kind: 'credit', receipt: false }),
    ]
    expect(unvouched(es).map((e) => e.id)).toEqual(['a'])
  })

  it('flags a debit strictly above the ceiling', () => {
    const cfg = { ...PETTYCFG, limit: 1000 }
    const es = [
      entry({ id: 'under', amt: 999 }),
      entry({ id: 'at', amt: 1000 }),
      entry({ id: 'over', amt: 1001 }),
      entry({ id: 'credit', kind: 'credit', amt: 5000 }),
    ]
    expect(overCeiling(es, cfg).map((e) => e.id)).toEqual(['over'])
  })

  it('counts only debits inside the window', () => {
    setClock(() => new Date(2026, 7, 3))
    const es = [
      entry({ id: 'in', d: new Date(2026, 6, 20) }),
      entry({ id: 'edge', d: new Date(2026, 6, 4) }),
      entry({ id: 'out', d: new Date(2026, 5, 1) }),
      entry({ id: 'credit', kind: 'credit', d: new Date(2026, 6, 20) }),
    ]
    expect(spentWithin(es).map((e) => e.id)).toEqual(['in', 'edge'])
  })

  it('sums what it is given', () => {
    expect(total([entry({ amt: 100 }), entry({ amt: 250 })])).toBe(350)
    expect(total([])).toBe(0)
  })
})
