import { describe, expect, it } from 'vitest'
import {
  addOverride,
  currentBudget,
  currentPayCfg,
  currentSla,
  removeOverride,
  resetCompany,
  setBuffer,
  setPayCfg,
  setShare,
  setSlaHours,
} from '@/state/company'
import { budgetOK, checkpoints, shareTotal, sharesFor } from '@/lib/sla'
import { structureOf } from '@/lib/payroll'
import { ASSIGN_STAGES } from '@/data/org'
import { BUDGET, SLA } from '@/data/budget'
import { PAYCFG } from '@/data/hrms'
import { readSettings } from '../../server/routes/validate'

/**
 * The settings the Company screen writes, and what reads them back.
 *
 * Two properties carry the module. The seed objects are shared with every other
 * importer, so a write that reached one would alter the design's own figures
 * underneath screens that never asked. And the salary structure and the SLA
 * split are read live rather than captured, which is the only reason changing a
 * number here moves the register and the checkpoints.
 *
 * The stage split is the interesting one, and is tested as it behaves rather
 * than as it reads: `setShare` can leave the split not adding up, on purpose.
 * The three tests below say what that costs and why the alternative is worse.
 */

describe('the stage split', () => {
  /* Every intermediate state of a five-slider split is unbalanced, so the store
     records what was set and the tab warns — the ✓/⚠ panel at
     `SlaTab.tsx:416-447`, which reads this same `budgetOK`. */
  it('records what the slider was set to, even when the split stops adding up', () => {
    expect(shareTotal(sharesFor('COS')), 'the seed split is already broken').toBe(100)

    setShare('base', 'Search', '90')

    expect(shareTotal(sharesFor('COS'))).toBe(140)
    expect(budgetOK(sharesFor('COS'))).toBe(false)
  })

  /**
   * What that costs, and why the warning is not decoration. Nothing outside the
   * SLA tab checks `budgetOK`, so an unbalanced split is quoted as fact by every
   * screen that plans an order: at 140% the last checkpoint falls six hours past
   * a deadline it is supposed to protect.
   */
  it('carries an unbalanced split straight into the checkpoints', () => {
    /* 24h less the 10% buffer is a 21.6h working window, and the split hands out
       140% of it. */
    const before = checkpoints(24, 'COS')
    expect(before[before.length - 1].by).toBeCloseTo(21.6, 5)

    setShare('base', 'Search', '90')

    const after = checkpoints(24, 'COS')
    expect(after[after.length - 1].by).toBeCloseTo(30.24, 5)
    expect(after[after.length - 1].by, 'the last checkpoint is inside the promise').toBeGreaterThan(24)
  })

  /**
   * The counter-example, and the reason `setShare` does not enforce the total.
   *
   * The seed divides the clock exactly, so the only value that holds the total at
   * 100 is the one already there. A store that refused an unbalanced result would
   * therefore refuse every edit — and both controls read their value straight off
   * the store (`SlaTab.tsx:386-405`, no local state), so the slider would snap
   * back under the cursor and the split would be frozen at whatever it seeded as.
   */
  it('could not hold the total at 100 without refusing every edit', () => {
    expect(shareTotal(currentBudget().base), 'the seed divides the clock exactly').toBe(100)

    ASSIGN_STAGES.forEach((st) => {
      /* Each stage is nudged from the seed rather than from the last nudge, so
         the one-stage-at-a-time claim is what is being made. */
      resetCompany()

      setShare('base', st, String(BUDGET.base[st] + 1))

      expect(currentBudget().base[st], `moving ${st} by one was refused`).toBe(BUDGET.base[st] + 1)
      expect(budgetOK(sharesFor('COS')), `${st} could be moved and still leave the split whole`).toBe(
        false,
      )
    })
  })

  it('clamps a share to the 0–100 the slider offers, and refuses a mis-key', () => {
    setShare('base', 'Search', '-5')
    expect(currentBudget().base.Search).toBe(0)

    setShare('base', 'Search', '250')
    expect(currentBudget().base.Search).toBe(100)

    setShare('base', 'Search', 'abc')
    expect(currentBudget().base.Search, 'a mis-key was written as a share').toBe(100)
  })

  /* "Its own split" has to mean its own: a product with an override is the one
     thing on the screen that must not move when the default does. */
  it('keeps a product override and the default clear of each other', () => {
    addOverride('COS')
    expect(sharesFor('COS').Search).toBe(50)

    setShare('base', 'Search', '40')
    expect(currentBudget().base.Search).toBe(40)
    expect(sharesFor('COS').Search, 'the override followed the default').toBe(50)

    setShare('40Y', 'Search', '70')
    expect(sharesFor('40Y').Search).toBe(70)
    expect(currentBudget().base.Search, 'the default followed an override').toBe(40)
  })

  it('drops a product back to the default when its override goes', () => {
    setShare('40Y', 'Search', '70')
    expect(sharesFor('40Y').Search).toBe(70)

    removeOverride('40Y')
    expect(sharesFor('40Y').Search).toBe(50)
  })
})

describe('the buffer held back at the end', () => {
  it('takes 0 to 50 and refuses the rest', () => {
    setBuffer('50')
    expect(currentBudget().buffer).toBe(50)

    for (const v of ['50.1', '-1', 'ten', '']) {
      setBuffer(v)
      expect(currentBudget().buffer, `${v} was accepted as a buffer`).toBe(50)
    }

    setBuffer('0')
    expect(currentBudget().buffer).toBe(0)
  })

  /**
   * The same setting, two bounds. This one stops at 50; the server's
   * `slaBufferPct` stops just under 100 (`server/routes/validate.ts:85-93`), so
   * a buffer of 60 is a legal row and an impossible edit. The containment that
   * does hold is asserted alongside it: nothing this side accepts is refused
   * there, so a value that came from this screen can always be stored.
   */
  it('is capped tighter here than the server caps the same number', () => {
    setBuffer('60')
    expect(currentBudget().buffer, 'the client cap has moved off 50').toBe(BUDGET.buffer)
    expect(readSettings({ slaBufferPct: 60 }).ok, 'the server cap has moved down to 50').toBe(true)

    for (const v of [0, 25, 50]) {
      expect(readSettings({ slaBufferPct: v }).ok, `${v} is editable here and unstorable there`).toBe(
        true,
      )
    }
  })
})

describe('the promise', () => {
  it('refuses a promise of no time at all, and caps it at a fortnight', () => {
    for (const v of ['0', '-5', 'soon', '']) {
      setSlaHours(0, v)
      expect(currentSla()[0].h, `${v} was written as a promise`).toBe(24)
    }

    setSlaHours(0, '999')
    expect(currentSla()[0].h, '336 hours is the fortnight the doc claims').toBe(336)

    setSlaHours(0, '48')
    expect(currentSla()[0].h).toBe(48)
  })
})

describe('the salary structure', () => {
  /* Nothing is stored per person but the CTC, so a figure changed here has to
     move every structure derived through it — on a ₹12L CTC, half of ₹1L a month
     is ₹50,000 basic and 40% of that is ₹20,000 HRA. */
  it('moves every structure derived from it', () => {
    expect(structureOf({ ctc: 1_200_000 }).basic).toBe(50_000)
    expect(structureOf({ ctc: 1_200_000 }).hra).toBe(20_000)

    setPayCfg('basicPct', '60')

    expect(structureOf({ ctc: 1_200_000 }).basic).toBe(60_000)
    expect(structureOf({ ctc: 1_200_000 }).hra).toBe(24_000)
  })

  it('refuses a blank or negative figure rather than writing it', () => {
    for (const v of ['', '-10', 'half']) {
      setPayCfg('basicPct', v)
      expect(currentPayCfg().basicPct, `${v} was written as a percentage`).toBe(50)
    }

    setPayCfg('currency', '   ')
    expect(currentPayCfg().currency).toBe('INR')
  })
})

describe('the seed', () => {
  /**
   * Nine screens import these objects directly. A setter that wrote through to
   * one would change the design's own figures for all of them, and no reset
   * would bring them back.
   */
  it('is never written to', () => {
    setShare('base', 'Search', '90')
    setPayCfg('basicPct', '60')
    setSlaHours(0, '48')
    setBuffer('25')

    /* The load-bearing half: the writes have to have landed, or the seed is
       intact only because nothing happened at all. */
    expect(currentBudget().base.Search).toBe(90)
    expect(currentBudget().buffer).toBe(25)
    expect(currentPayCfg().basicPct).toBe(60)
    expect(currentSla()[0].h).toBe(48)

    expect(BUDGET.base.Search).toBe(50)
    expect(BUDGET.buffer).toBe(10)
    expect(PAYCFG.basicPct).toBe(50)
    expect(SLA[0].h).toBe(24)
  })

  it('goes back on reset, so one test cannot leak into the next', () => {
    setShare('base', 'Search', '90')
    setBuffer('25')

    resetCompany()

    expect(currentBudget().base.Search).toBe(50)
    expect(currentBudget().buffer).toBe(10)
    expect(budgetOK(sharesFor('COS'))).toBe(true)
  })
})
