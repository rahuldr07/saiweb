import { describe, expect, it } from 'vitest'
import { board, defaultContext, narrowPool, type RunContext } from '@/lib/engine'
import { ORDERS } from '@/data/production'
import { STAFF } from '@/data/people'
import { ASSIGN_STAGES, COVSTAGES, RULES } from '@/data/org'
import { coversPlace, coversProduct } from '@/lib/qualification'
import { newPerson, type Person, type Rule } from '@/data/types'

/**
 * Who may take one stage of one order.
 *
 * This answer used to be written out three times — the automatic pass, the
 * intake preview, and "Assign all" on an order screen — and the third copy had
 * lost the routing and coverage rules while its own confirmation modal told the
 * reader it followed the same ones. The property that matters is that the
 * answer cannot depend on which screen asked, so most of these tests are stated
 * against the rules themselves rather than against a copy of them.
 */

const LOAD = board().run.load

/** The stages coverage applies to, and that the run places automatically. */
const COVERED = COVSTAGES.filter((s) => ASSIGN_STAGES.includes(s))

const person = (over: Partial<Person> & Pick<Person, 'id' | 'n' | 'dep' | 'cap'>): Person => ({
  ...newPerson(),
  e: `${over.id}@example.com`,
  ...over,
})

/** A complete context, so a test can state the whole world it is asking about. */
const ctx = (over: Partial<RunContext>): RunContext => ({ ...defaultContext(), ...over })

/**
 * The order/stage pairs where the narrowing proposed nobody at all.
 *
 * Both properties below read the first name out of the pool and have nothing to
 * say when there is no name, so a narrowing that returned an empty pool
 * everywhere would satisfy them both while "Assign all" proposed nobody for
 * anything. The floor is every pair, not some fraction of them: these tests ask
 * with the daily target off and no stage yet taken, which leaves only
 * department, routing, coverage and availability able to empty a pool, and
 * against this register none of them does. Any pair that falls short is named.
 */
const unfilled = (proposals: { o: { id: string }; stage: string; picked?: Person }[]) =>
  proposals.filter((p) => !p.picked).map((p) => `${p.o.id}/${p.stage}`)

describe('the coverage rules the order screen had dropped', () => {
  /**
   * The register carries a LIEN order in Cambria, PA. Asha P is in Search,
   * available, and by a straight load sort the emptiest desk in the department —
   * so the copy on the order screen picked her. She is on Level 1, which works
   * COS and nothing else, and the automatic pass takes her off a LIEN order at
   * `engine.ts` r7. Two screens, one order, two different searchers.
   */
  const lien = ORDERS.find((o) => o.pr === 'LIEN' && o.st === 'PA' && o.co === 'Cambria')

  it('has that order in the register, or this test is asking about nothing', () => {
    expect(lien, 'the seed no longer carries a LIEN order in Cambria, PA').toBeDefined()
    expect(coversProduct('ap', 'LIEN'), 'Asha P now works LIEN, so the case is gone').toBe(false)
    expect(coversPlace('ap', 'PA', 'Cambria'), 'Asha P no longer covers Cambria').toBe(true)
  })

  it('refuses the searcher who does not work that product', () => {
    const picked = narrowPool(lien!, 'Search', { load: LOAD, target: false }).pool[0]

    expect(picked, 'nobody at all was eligible, which is not the point being made').toBeDefined()
    expect(picked.id, 'a searcher who does not work LIEN was proposed').not.toBe('ap')
    expect(coversProduct(picked.id, lien!.pr)).toBe(true)
    expect(coversPlace(picked.id, lien!.st, lien!.co)).toBe(true)
  })

  it('would otherwise propose her — which is what the order screen was doing', () => {
    /* The counter-example. With the coverage stages emptied, the narrowing is
       exactly what `OrderDetail.pickFor` used to be: department, availability
       and self-review, sorted by load. It picks Asha P, so the assertion above
       is load-bearing rather than a restatement of the seed. */
    const withoutCoverage = narrowPool(lien!, 'Search', {
      ctx: ctx({ covStages: [] }),
      load: LOAD,
      target: false,
    })

    expect(withoutCoverage.pool[0].id, 'the counter-example no longer reproduces').toBe('ap')
  })

  it('proposes nobody the coverage rules exclude, on any order in the register', () => {
    const proposals = ORDERS.flatMap((o) =>
      COVERED.map((stage) => ({ o, stage, picked: narrowPool(o, stage, { load: LOAD, target: false }).pool[0] })),
    )

    const offenders = proposals.flatMap(({ o, stage, picked }) => {
      if (!picked) return []
      const bad: string[] = []
      if (!coversPlace(picked.id, o.st, o.co)) bad.push(`${o.id}/${stage}: ${picked.n} does not cover ${o.co}, ${o.st}`)
      if (!coversProduct(picked.id, o.pr)) bad.push(`${o.id}/${stage}: ${picked.n} does not work ${o.pr}`)
      return bad
    })

    expect(unfilled(proposals), 'the coverage rules narrowed these to nobody').toEqual([])
    expect(offenders).toEqual([])
  })
})

describe('what stopped it, when nobody is left', () => {
  const only = (p: Person, over: Partial<RunContext> = {}) =>
    ctx({
      staff: [p],
      assignStages: ['Search', 'Search QC'],
      stages: ['Search', 'Search QC'],
      pairs: { 'Search QC': 'Search' },
      covStages: ['Search', 'Search QC'],
      coversPlace: () => true,
      coversProduct: () => true,
      ...over,
    })

  const order = { pr: 'COS', st: 'AK', cl: 'MGR', co: 'Nome' }
  const searcher = person({ id: 'x1', n: 'Ex One', dep: ['Search'], cap: 5 })

  it('says nobody belongs to the stage when the department is empty', () => {
    const r = narrowPool(order, 'Search', { ctx: only(searcher, { staff: [] }) })
    expect(r.pool).toEqual([])
    expect(r.stop).toEqual({ why: 'no-dept', rule: 'r1' })
  })

  it('blames the place, not the roster, when nobody covers the county', () => {
    const r = narrowPool(order, 'Search', { ctx: only(searcher, { coversPlace: () => false }) })
    expect(r.stop).toEqual({ why: 'coverage', rule: 'r6' })
  })

  it('blames the product separately, so the remedy differs', () => {
    const r = narrowPool(order, 'Search', { ctx: only(searcher, { coversProduct: () => false }) })
    expect(r.stop).toEqual({ why: 'coverage', rule: 'r7' })
  })

  it('says unavailable only when the person was otherwise a candidate', () => {
    const away = person({ id: 'x1', n: 'Ex One', dep: ['Search'], cap: 5, avail: 'leave' })
    const r = narrowPool(order, 'Search', { ctx: only(away) })
    expect(r.stop).toEqual({ why: 'unavailable', rule: 'r2' })
  })

  it('says at target when the only candidate is full', () => {
    const r = narrowPool(order, 'Search', { ctx: only(searcher), load: { x1: 5 } })
    expect(r.stop).toEqual({ why: 'capacity', rule: 'r3' })
  })

  it('says self-review when the only person left did the paired stage', () => {
    const both = person({ id: 'x1', n: 'Ex One', dep: ['Search', 'Search QC'], cap: 5 })
    const r = narrowPool(order, 'Search QC', { ctx: only(both), taken: { Search: 'x1' } })
    expect(r.stop).toEqual({ why: 'self', rule: 'r4' })
    expect(r.paired).toBe('Search')
  })

  it('lets the same person through when they did not do the paired stage', () => {
    /* Without this the test above would pass against a rule that refuses every
       QC stage outright. */
    const both = person({ id: 'x1', n: 'Ex One', dep: ['Search', 'Search QC'], cap: 5 })
    const r = narrowPool(order, 'Search QC', { ctx: only(both), taken: { Search: 'someone-else' } })
    expect(r.stop).toBeUndefined()
    expect(r.pool.map((p) => p.id)).toEqual(['x1'])
  })
})

describe('the routing rules', () => {
  /* r5 sends LIEN typing to three named people. The order screen never
     consulted it, so a LIEN order could be typed by anybody in the department. */
  const r5 = RULES.find((r) => r.id === 'r5') as Rule
  const lienTyping = { pr: 'LIEN', st: 'PA', cl: 'MGR', co: 'Cambria' }

  it('is a routing rule that is on and names a pool', () => {
    expect(r5.k).toBe('route')
    expect(r5.on).toBe(true)
    expect(r5.pool?.length).toBeGreaterThan(0)
  })

  it('narrows LIEN typing to the group the rule names', () => {
    const r = narrowPool(lienTyping, 'Typing', { load: LOAD, target: false })
    expect(r.pool.length).toBeGreaterThan(0)
    r.pool.forEach((p) => expect(r5.pool, `${p.n} is not in the LIEN typing group`).toContain(p.id))
  })

  it('leaves a different product to the whole department, so the rule is doing it', () => {
    /* The counter-example: the same stage on a COS order reaches somebody the
       LIEN rule would have excluded, so the narrowing above is the rule's. */
    const cos = narrowPool({ ...lienTyping, pr: 'COS' }, 'Typing', { load: LOAD, target: false })
    expect(cos.pool.some((p) => !r5.pool?.includes(p.id)), 'nobody outside the group types at all').toBe(true)
  })
})

describe('the daily target, which the order screen deliberately does not enforce', () => {
  const full = person({ id: 'x1', n: 'Ex One', dep: ['Search'], cap: 5 })
  const world = ctx({
    staff: [full],
    assignStages: ['Search'],
    stages: ['Search'],
    pairs: {},
    covStages: [],
  })

  it('refuses somebody already at their target when the pass is automatic', () => {
    const r = narrowPool({ pr: 'COS', st: 'PA', cl: 'MGR', co: 'Cambria' }, 'Search', {
      ctx: world,
      load: { x1: 5 },
    })
    expect(r.stop?.why).toBe('capacity')
  })

  it('proposes them anyway when a person is assigning by hand', () => {
    /* The one difference between the three call sites that is kept on purpose:
       the load counted here is the automatic deal, which routinely fills a
       department, and a lead assigning by hand is the case for going past it. */
    const r = narrowPool({ pr: 'COS', st: 'PA', cl: 'MGR', co: 'Cambria' }, 'Search', {
      ctx: world,
      load: { x1: 5 },
      target: false,
    })
    expect(r.stop).toBeUndefined()
    expect(r.pool.map((p) => p.id)).toEqual(['x1'])
  })

  it('is the only rule the option touches', () => {
    /* Turning the target off must not also let a searcher through who does not
       cover the county — it takes away one rule, not the block of them. */
    const noCover = ctx({ ...world, covStages: ['Search'], coversPlace: () => false })
    const r = narrowPool({ pr: 'COS', st: 'PA', cl: 'MGR', co: 'Cambria' }, 'Search', {
      ctx: noCover,
      load: { x1: 5 },
      target: false,
    })
    expect(r.stop).toEqual({ why: 'coverage', rule: 'r6' })
  })
})

describe('the order it hands them back in', () => {
  it('puts the emptiest desk first, measured against each person’s own target', () => {
    /* Proportion of target, not headcount: someone at 9/10 is fuller than
       someone at 15/30 even though they hold fewer orders. */
    const roster = [
      person({ id: 'a1', n: 'Ada One', dep: ['Search'], cap: 10 }),
      person({ id: 'b2', n: 'Bo Two', dep: ['Search'], cap: 30 }),
    ]
    const world = ctx({
      staff: roster,
      assignStages: ['Search'],
      stages: ['Search'],
      pairs: {},
      covStages: [],
    })

    const r = narrowPool({ pr: 'COS', st: 'PA', cl: 'MGR', co: 'Cambria' }, 'Search', {
      ctx: world,
      load: { a1: 9, b2: 15 },
    })
    expect(r.pool.map((p) => p.id)).toEqual(['b2', 'a1'])
  })
})

describe('every screen gets the same answer', () => {
  /**
   * Stated against the rules rather than against another copy of the narrowing,
   * so this cannot pass by two copies agreeing on the same mistake.
   */
  it('proposes nobody the automatic pass would refuse, for any order in the register', () => {
    const routeRules = RULES.filter((x) => x.k === 'route' && x.on && x.cond)

    const proposals = ORDERS.flatMap((o) =>
      ASSIGN_STAGES.map((stage) => ({ o, stage, picked: narrowPool(o, stage, { load: LOAD, target: false }).pool[0] })),
    )

    const offenders = proposals.flatMap(({ o, stage, picked }) => {
      if (!picked) return []
      const say = (why: string) => `${o.id}/${stage}: ${picked.n} ${why}`
      const bad: string[] = []
      if (!picked.dep.includes(stage)) bad.push(say(`is not in ${stage}`))
      if (picked.avail !== 'ok') bad.push(say(`is ${picked.avail}`))
      if (picked.active === false) bad.push(say('has left'))
      routeRules.forEach((r) => {
        const c = r.cond ?? {}
        const matches = (!c.stage || c.stage === stage) && (!c.product || c.product === o.pr) && (!c.state || c.state === o.st)
        if (matches && !r.pool?.includes(picked.id)) bad.push(say(`is outside the pool ${r.n} routes to`))
      })
      if (COVERED.includes(stage)) {
        if (!coversPlace(picked.id, o.st, o.co)) bad.push(say(`does not cover ${o.co}, ${o.st}`))
        if (!coversProduct(picked.id, o.pr)) bad.push(say(`does not work ${o.pr}`))
      }
      return bad
    })

    expect(unfilled(proposals), 'the automatic pass proposed nobody for these').toEqual([])
    expect(offenders).toEqual([])
  })

  it('is asking about a roster where those rules can bite', () => {
    /* If every searcher covered everything and every rule were off, the property
       above would hold for free. */
    expect(STAFF.some((s) => s.dep.includes('Search') && !coversProduct(s.id, 'LIEN'))).toBe(true)
    expect(STAFF.some((s) => s.avail !== 'ok')).toBe(true)
    expect(RULES.some((r) => r.k === 'route' && r.on)).toBe(true)
  })
})
