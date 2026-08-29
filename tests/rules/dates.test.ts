import { readFileSync, readdirSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { INVOICES } from '@/data/business'
import { LEAVE } from '@/data/hrms'
import { ORDERS } from '@/data/production'
import { loadDeliveries } from '@/data/deliveries'
import { monthBounds, inRange } from '@/lib/invoices'
import { fmtDate } from '@/lib/format'

/**
 * The seed is the design's world, and it has to be the same world for everybody
 * who opens it.
 *
 * It was not. The extraction wrote every date as a UTC instant — a calendar day
 * became IST midnight, `2026-02-28T18:30:00.000Z` — so a reader west of IST got
 * the day before. Every one of the 30 invoices then fell outside the month it
 * was labelled with, which emptied the invoice register's month filter for every
 * viewer outside India; the overdue count on Orders read 3, 5 or 7 depending on
 * where the browser was; and the on-time KPI moved with it.
 *
 * The fix was to write the seed as local-time constructions, the way `SEED_NOW`
 * and `parseUsDate` already are. These are the properties that keep it that way.
 */

const DATA = 'src/data'

describe('the seed is written in wall-clock time', () => {
  it('has no date built from a UTC instant string', () => {
    /* `new Date('…Z')` is an instant. Read in a different zone it is a different
       wall clock, and for a date-only value a different day. */
    const offenders: string[] = []
    for (const f of readdirSync(DATA).filter((n) => n.endsWith('.ts'))) {
      const text = readFileSync(`${DATA}/${f}`, 'utf8')
      text.split('\n').forEach((line, i) => {
        if (/new Date\('[\d-]+T[\d:.]+Z'\)/.test(line)) offenders.push(`${DATA}/${f}:${i + 1}`)
      })
    }
    expect(offenders, 'these dates move by a day depending on the reader’s zone').toEqual([])
  })
})

describe('every date means the same day to every reader', () => {
  it('keeps each invoice inside the month it is labelled with', () => {
    for (const i of INVOICES) {
      const [from, to] = monthBounds(i.m)
      expect(inRange(i, { from, to }), `${i.id} is labelled ${i.m} but issued ${fmtDate(i.issued)}`).toBe(true)
    }
  })

  it('starts every leave request at midnight, so a day is a whole day', () => {
    for (const l of LEAVE) {
      expect([l.from.getHours(), l.from.getMinutes()], `${l.id} starts mid-day`).toEqual([0, 0])
      expect([l.to.getHours(), l.to.getMinutes()], `${l.id} ends mid-day`).toEqual([0, 0])
      expect(l.to.getTime(), `${l.id} ends before it starts`).toBeGreaterThanOrEqual(l.from.getTime())
    }
  })

  it('never has an order due before it was received', () => {
    for (const o of ORDERS) {
      expect(o.due.getTime(), `${o.id} is due before it arrived`).toBeGreaterThan(o.recv.getTime())
    }
  })

  it('gives every delivery the day its own display key states', async () => {
    /* `dk` is the design's own rendering of `d`. They agree only while `d` is
       read as the wall clock it was written in. */
    for (const x of await loadDeliveries()) {
      expect(fmtDate(x.d), `${x.id} renders on a different day than its display key`).toBe(x.dk)
    }
  })

  it('revives every delivery at the wall clock the wire value was written in', async () => {
    /* The day alone is not enough to notice this: in UTC an instant of 08:30Z
       still lands on the right date, and only a reader far enough west sees it
       slip. Comparing the hour as well makes the check say the same thing in
       every zone — including the UTC that CI runs in. */
    const raw = JSON.parse(readFileSync(`${DATA}/deliveries.json`, 'utf8')) as { id: string; d: string }[]
    const wire = new Map(raw.map((r) => [r.id, r.d]))
    for (const x of await loadDeliveries()) {
      const ist = new Date(new Date(wire.get(x.id)!).getTime() + 5.5 * 3600_000)
      expect(
        [x.d.getFullYear(), x.d.getMonth(), x.d.getDate(), x.d.getHours(), x.d.getMinutes()],
        `${x.id} was revived as an instant rather than as the design's wall clock`,
      ).toEqual([
        ist.getUTCFullYear(),
        ist.getUTCMonth(),
        ist.getUTCDate(),
        ist.getUTCHours(),
        ist.getUTCMinutes(),
      ])
    }
  })
})
