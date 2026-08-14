import { describe, expect, it } from 'vitest'
import {
  EXCLUSION,
  board,
  makeDay,
  runDay,
  type ExclusionReason,
  type RunContext,
} from '@/lib/engine'
import { ASSIGN_STAGES, PAIRS, STAGES } from '@/data/org'
import { STAFF } from '@/data/people'
import type { Person, Rule } from '@/data/types'
import { coversPlace, coversProduct } from '@/lib/coverage'

const { run: RUN, day: DAY } = board()

/**
 * The engine's job is to place work without ever breaking a rule that exists for
 * a compliance reason, and to explain itself when it cannot place something.
 * These tests pin the properties, not the numbers: a rule change should be free
 * to move the counts around, and must not be free to let a QC stage be reviewed
 * by its own author.
 */

const personById = (id: string) => STAFF.find((s) => s.id === id)

describe('QC independence', () => {
  /* The one rule where a bug is a compliance incident rather than a bug report:
     a check performed by the person who did the work is not a check. */
  it('never gives a QC stage to whoever did the stage it reviews', () => {
    const offenders = RUN.orders.flatMap((o) => {
      const plan = o.plan ?? {}
      return Object.entries(PAIRS)
        .filter(([qcStage, reviewed]) => plan[qcStage] && plan[qcStage] === plan[reviewed])
        .map(([qcStage]) => `${o.id}: ${qcStage} reviewed by its own author`)
    })

    expect(offenders).toEqual([])
  })

  it('reports self-review as the reason when it is what blocked a placement', () => {
    RUN.exc
      .filter((e) => e.why === 'self')
      .forEach((e) => {
        expect(PAIRS[e.stage], `${e.stage} is not a QC stage but blocked on self-review`).toBeDefined()
      })
  })

  /**
   * The property above passes against the seed roster even with the self-review
   * rule switched off — not because the rule is redundant, but because
   * fill-the-emptiest-first incidentally moves the author down the list once
   * their load has gone up. A test that cannot fail is not a test, so this one
   * builds the roster where the rule is the *only* thing standing in the way:
   * one person who is the sole member of both Search and Search QC.
   */
  describe('against a roster where nothing else would prevent it', () => {
    const soloist: Person = {
      ...STAFF[0],
      id: 'solo',
      n: 'Only Person',
      dep: ['Search', 'Search QC'],
      cap: 99,
      open: 0,
      avail: 'ok',
      active: true,
      lvl: undefined,
    }

    const context = (rules: Rule[]): Partial<RunContext> => ({
      staff: [soloist],
      rules,
      assignStages: ['Search', 'Search QC'],
      stages: ['Search', 'Search QC'],
      pairs: { 'Search QC': 'Search' },
      covStages: [],
      coversPlace: () => true,
      coversProduct: () => true,
    })

    const selfReview: Rule = { id: 'r4', n: 'Self-review', k: 'block', on: true }
    const emptiest: Rule = { id: 'r8', n: 'Fill the emptiest first', k: 'prefer', on: true }

    it('refuses the QC stage rather than letting the author check their own work', () => {
      const run = runDay(makeDay(), context([selfReview, emptiest]))

      const collisions = run.orders.filter((o) => o.plan?.['Search QC'] === o.plan?.Search && o.plan?.Search)
      expect(collisions, 'the author was allowed to review their own search').toHaveLength(0)

      /* And it must say so, rather than dropping the stage silently. */
      const blocked = run.exc.filter((e) => e.stage === 'Search QC')
      expect(blocked.length).toBeGreaterThan(0)
      blocked.forEach((e) => expect(e.why).toBe('self'))
      expect(run.avoided).toBeGreaterThan(0)
    })

    it('would otherwise place them on both — which is what the rule is for', () => {
      /* The counter-example. With r4 absent the same roster does exactly the
         thing the rule exists to prevent, so the assertion above is load-bearing. */
      const run = runDay(makeDay(), context([emptiest]))

      const collisions = run.orders.filter((o) => o.plan?.['Search QC'] === o.plan?.Search && o.plan?.Search)
      expect(collisions.length, 'the counter-example no longer reproduces').toBeGreaterThan(0)
      expect(run.avoided).toBe(0)
    })
  })
})

describe('exclusions', () => {
  /* An unplaced stage with no reason is the failure mode this design exists to
     prevent — five reasons, each with a different fix. */
  const reasons: ExclusionReason[] = ['no-dept', 'coverage', 'unavailable', 'capacity', 'self']

  it('gives every unplaced stage one of the five reasons', () => {
    RUN.exc.forEach((e) => {
      expect(reasons).toContain(e.why)
      expect(e.t.length, 'the reason must carry a sentence a person can act on').toBeGreaterThan(0)
    })
  })

  it('has a label and a remedy for each reason', () => {
    reasons.forEach((r) => {
      const entry = EXCLUSION[r]
      expect(entry, `no label for ${r}`).toBeDefined()
      const [label, tone, remedy] = entry
      expect(label.length).toBeGreaterThan(0)
      expect(['warn', 'bad']).toContain(tone)
      expect(remedy.length, `${r} has no remedy`).toBeGreaterThan(0)
    })
  })

  it('records a trace for every exception, so the decision can be replayed', () => {
    RUN.exc.forEach((e) => {
      expect(e.trace.length, `${e.o.id}/${e.stage} was refused with no trace`).toBeGreaterThan(0)
    })
  })

  it('accounts for every stage of every order exactly once', () => {
    /* Placed + unplaced must equal the work that arrived. A stage that is neither
       is work that silently vanished. */
    expect(RUN.assigns.length + RUN.exc.length).toBe(RUN.orders.length * ASSIGN_STAGES.length)
    expect(RUN.total).toBe(RUN.orders.length * ASSIGN_STAGES.length)
  })
})

describe('placement respects the blocking rules', () => {
  it('only ever places someone who belongs to that department', () => {
    RUN.assigns.forEach((a) => {
      const p = personById(a.who)
      expect(p, `${a.who} is not on the roster`).toBeDefined()
      expect(p!.dep, `${p!.n} does not belong to ${a.stage}`).toContain(a.stage)
    })
  })

  it('never places someone who is unavailable or inactive', () => {
    RUN.assigns.forEach((a) => {
      const p = personById(a.who)!
      expect(p.avail, `${p.n} was given work while ${p.avail}`).toBe('ok')
      expect(p.active).not.toBe(false)
    })
  })

  it('never places a search stage on someone who does not cover the place or product', () => {
    const covered = ['Search', 'Search QC']
    RUN.assigns
      .filter((a) => covered.includes(a.stage))
      .forEach((a) => {
        expect(
          coversPlace(a.who, a.o.st, a.o.co),
          `${a.who} was given ${a.o.co}, ${a.o.st} without covering it`,
        ).toBe(true)
        expect(
          coversProduct(a.who, a.o.pr),
          `${a.who} was given ${a.o.pr} without working it`,
        ).toBe(true)
      })
  })

  it('never loads anyone past their daily target', () => {
    /* The run deals one day at a time and resets each morning, so the check is
       per day rather than across the week. */
    makeDay().forEach((_, dayIndex) => {
      const days = makeDay()
      const single = runDay([days[dayIndex]])
      Object.entries(single.load).forEach(([id, load]) => {
        const p = personById(id)!
        expect(load, `${p.n} was loaded to ${load} against a target of ${p.cap}`).toBeLessThanOrEqual(
          p.cap,
        )
      })
    })
  })
})

describe('the run is deterministic', () => {
  /* The design pins its figures. Two runs over the same arrivals that disagree
     would mean the board changes under the reader for no reason. */
  it('produces the same placements from the same arrivals', () => {
    const a = runDay(makeDay())
    const b = runDay(makeDay())
    expect(a.assigns.map((x) => `${x.o.id}|${x.stage}|${x.who}`)).toEqual(
      b.assigns.map((x) => `${x.o.id}|${x.stage}|${x.who}`),
    )
    expect(a.exc.length).toBe(b.exc.length)
  })

  it('deals the same five days the module-level run used', () => {
    expect(DAY).toHaveLength(5)
    expect(RUN.days).toHaveLength(5)
  })
})

describe('rule accounting', () => {
  it('counts every rule it consulted', () => {
    /* A rule that fired thousands of times and never narrowed anything is doing
       nothing — which the Assignment screen is built to show. The counters have
       to exist for that to be visible. */
    Object.entries(RUN.narrowed).forEach(([id, narrowed]) => {
      expect(RUN.fired[id], `rule ${id} narrowed without ever firing`).toBeGreaterThanOrEqual(
        id === 'r1' ? 0 : narrowed,
      )
    })
  })

  it('knows which departments are entirely out', () => {
    RUN.deptOut.forEach((d) => {
      expect(STAGES).toContain(d)
      const members = STAFF.filter((s) => s.dep.includes(d))
      expect(members.length).toBeGreaterThan(0)
      expect(members.every((s) => s.avail !== 'ok')).toBe(true)
    })
  })
})
