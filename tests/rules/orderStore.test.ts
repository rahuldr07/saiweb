import { afterEach, describe, expect, it } from 'vitest'
import {
  addCost,
  addNote,
  orderAsEdited,
  resetOrders,
  setAssignee,
  setOrderField,
  workingOn,
} from '@/screens/orders/store'
import { addPrefix, clashOf, removePrefix, resetPrefixes } from '@/screens/clients/prefixes'
import { ORDERS } from '@/data/production'
import { PRODUCTS } from '@/data/catalog'
import { slaHours } from '@/lib/sla'

/**
 * Editing an order, and claiming an order-number prefix.
 *
 * Both are held in module-level stores that six screens read, so two properties
 * matter beyond "does it write": the seed register must come out unchanged,
 * because every other screen reads it, and a product change must move the
 * promise with it, because the header, the checkpoints and the register would
 * otherwise quote three different deadlines for one order.
 */

afterEach(() => {
  resetOrders()
  resetPrefixes()
})

const base = () => ORDERS.find((o) => o.cl === 'CSS' && o.pr === 'PRLP') ?? ORDERS[0]

describe('editing an order', () => {
  it('leaves the seed register untouched', () => {
    const o = base()
    const before = { pr: o.pr, fee: o.fee, due: o.due.getTime(), a: { ...o.a } }

    setOrderField(o.id, 'pr', 'COS')
    setOrderField(o.id, 'bw', 'Somebody Else')
    setAssignee(o.id, 'Search', 'us')

    const after = ORDERS.find((x) => x.id === o.id)!
    expect({ pr: after.pr, fee: after.fee, due: after.due.getTime(), a: { ...after.a } }).toEqual(before)
  })

  it('lays the edits over the record when asked for it', () => {
    const o = base()
    setOrderField(o.id, 'bw', 'Somebody Else')
    expect(orderAsEdited(o).bw).toBe('Somebody Else')
    expect(orderAsEdited(o).id).toBe(o.id)
  })

  /*
   * The one rule on this screen that moves more than the field it is on. CSS
   * promises 48 hours for a COS and 24 for everything else, so changing the
   * product has to re-read the SLA — otherwise the due date shown is the promise
   * for a product this order no longer is.
   */
  it('re-reads the promise when the product changes', () => {
    const o = base()
    expect(slaHours({ cl: o.cl, pr: 'PRLP' })).toBe(24)
    expect(slaHours({ cl: o.cl, pr: 'COS' })).toBe(48)

    setOrderField(o.id, 'pr', 'COS')
    const edited = orderAsEdited(o)

    expect(edited.due.getTime() - o.recv.getTime()).toBe(48 * 3600_000)
    expect(edited.fee).toBe(PRODUCTS.find((p) => p.id === 'COS')!.fee)
  })

  it('leaves the promise alone when the product does not change', () => {
    const o = base()
    setOrderField(o.id, 'bw', 'Anyone')
    expect(orderAsEdited(o).due.getTime()).toBe(o.due.getTime())
  })

  /* Marking an order Sent is what "done" means, and several counts read it. */
  it('follows the stage into delivered', () => {
    const o = base()
    setOrderField(o.id, 'stt', 'sent')
    expect(orderAsEdited(o).done).toBe(true)
    setOrderField(o.id, 'stt', 'typing')
    expect(orderAsEdited(o).done).toBe(false)
  })

  it('keeps the edits on one order off another', () => {
    const [a, b] = ORDERS
    setOrderField(a.id, 'bw', 'Only On A')
    expect(orderAsEdited(b).bw).not.toBe('Only On A')
  })

  it('keeps costs and notes with the order they were added to', () => {
    const o = base()
    addCost(o.id, 'Copy fee', 6.5, 'Tester')
    addNote(o.id, 'Something worth knowing', 'Tester')
    expect(workingOn(o.id).costs).toHaveLength(1)
    expect(workingOn(o.id).notes[0].text).toBe('Something worth knowing')
    expect(workingOn(ORDERS[1].id).costs).toHaveLength(0)
  })

  it('puts everything back on reset, so one test cannot leak into the next', () => {
    const o = base()
    setOrderField(o.id, 'pr', 'COS')
    addNote(o.id, 'anything', 'Tester')
    resetOrders()
    expect(workingOn(o.id).notes).toHaveLength(0)
    expect(orderAsEdited(o).pr).toBe(o.pr)
  })
})

describe('claiming an order-number prefix', () => {
  it('refuses one that is already claimed', () => {
    expect(clashOf('MGRMI-')).not.toBeNull()
  })

  /*
   * Collision is not equality. An order number matching the longer prefix also
   * matches the shorter, so whichever is checked first decides — which is not a
   * decision anybody made.
   */
  it('refuses one that merely overlaps, in either direction', () => {
    expect(clashOf('MGRMI'), 'shorter than an existing one').not.toBeNull()
    expect(clashOf('MGRMI-2024'), 'longer than an existing one').not.toBeNull()
  })

  it('allows one that shares no leading run', () => {
    expect(clashOf('ZZTOP-')).toBeNull()
  })

  /* The check has to see every client, not only the ones somebody has opened —
     that was the bug in the original: prefixes were materialised on view. */
  it('sees clients nobody has opened', () => {
    expect(clashOf('MJPA-')).not.toBeNull()
    expect(clashOf('NTCFL-')).not.toBeNull()
  })

  it('adds and removes', () => {
    expect(clashOf('ZZTOP-')).toBeNull()
    addPrefix('MGR', 'ZZTOP-')
    expect(clashOf('ZZTOP-')).toEqual(['MGR', 'ZZTOP-'])
    removePrefix('MGR', 'ZZTOP-')
    expect(clashOf('ZZTOP-')).toBeNull()
  })

  it('puts the seed back on reset', () => {
    addPrefix('MGR', 'ZZTOP-')
    resetPrefixes()
    expect(clashOf('ZZTOP-')).toBeNull()
  })
})
