import { describe, expect, it } from 'vitest'
import {
  DATE_FORMATS,
  readAssignee,
  readDecision,
  readEnabled,
  readSettings,
} from '../../server/routes/validate'

/**
 * What the write endpoints accept.
 *
 * Each of these guards a route that used to read `c.req.json()` and trust the
 * shape it hoped for. The cases that matter are the ones a browser never sends
 * and a script does: a missing body, a wrong type, an empty patch, and a value
 * outside the range the rule downstream divides by.
 */

/* Bodies that are not an object at all. Every reader has to survive them, since
   `c.req.json()` yields whatever was posted — or null when nothing parsed. */
const NOT_OBJECTS = [null, undefined, 'string', 42, true, []]

describe('assigning a stage', () => {
  it('takes a person id', () => {
    const out = readAssignee({ assigneeId: 'abc' })
    expect(out.ok && out.value.assigneeId).toBe('abc')
  })

  /* Clearing a stage is a real instruction, not a missing field. */
  it('takes null as "unassign"', () => {
    const out = readAssignee({ assigneeId: null })
    expect(out.ok && out.value.assigneeId).toBe(null)
  })

  it('refuses a number, an object, or an empty string', () => {
    for (const v of [42, {}, '', '   ', true]) {
      expect(readAssignee({ assigneeId: v }).ok, JSON.stringify(v)).toBe(false)
    }
  })

  it('refuses anything that is not an object', () => {
    for (const body of NOT_OBJECTS) expect(readAssignee(body).ok).toBe(false)
  })
})

describe('deciding leave', () => {
  it('takes the two decisions', () => {
    expect(readDecision({ status: 'approved' })).toEqual({ ok: true, value: 'approved' })
    expect(readDecision({ status: 'rejected' })).toEqual({ ok: true, value: 'rejected' })
  })

  it('refuses anything else, including a near miss', () => {
    for (const v of ['Approved', 'approve', 'pending', '', 1, null]) {
      expect(readDecision({ status: v }).ok, String(v)).toBe(false)
    }
    for (const body of NOT_OBJECTS) expect(readDecision(body).ok).toBe(false)
  })
})

describe('toggling a rule', () => {
  it('takes a boolean and nothing that merely looks like one', () => {
    expect(readEnabled({ enabled: true })).toEqual({ ok: true, value: true })
    expect(readEnabled({ enabled: false })).toEqual({ ok: true, value: false })
    for (const v of ['true', 1, 0, null, undefined]) {
      expect(readEnabled({ enabled: v }).ok, String(v)).toBe(false)
    }
  })
})

describe('workspace settings', () => {
  it('takes each field on its own', () => {
    expect(readSettings({ slaBufferPct: 15 })).toEqual({ ok: true, value: { slaBufferPct: 15 } })
    expect(readSettings({ onTimeTarget: 95 })).toEqual({ ok: true, value: { onTimeTarget: 95 } })
    expect(readSettings({ dateFormat: 'DD/MM/YYYY' })).toEqual({
      ok: true,
      value: { dateFormat: 'DD/MM/YYYY' },
    })
  })

  /* The reason the endpoint builds its patch field by field: anything else that
     arrives must not reach the query builder as a column. */
  it('drops keys it does not own', () => {
    const out = readSettings({ slaBufferPct: 10, tenantId: 'someone-else', id: 1 })
    expect(out.ok && out.value).toEqual({ slaBufferPct: 10 })
  })

  it('refuses an empty patch rather than issuing an empty update', () => {
    expect(readSettings({}).ok).toBe(false)
    expect(readSettings({ nothingWeOwn: 1 }).ok).toBe(false)
  })

  /* The buffer is held back before the stages divide the rest, so at 100 there
     is nothing left to divide and every checkpoint collapses onto arrival. */
  it('keeps the buffer under 100', () => {
    expect(readSettings({ slaBufferPct: 99.9 }).ok).toBe(true)
    expect(readSettings({ slaBufferPct: 0 }).ok).toBe(true)
    for (const v of [100, 101, -1, NaN, Infinity, 'ten']) {
      expect(readSettings({ slaBufferPct: v }).ok, String(v)).toBe(false)
    }
  })

  it('keeps the on-time target a percentage', () => {
    expect(readSettings({ onTimeTarget: 100 }).ok).toBe(true)
    for (const v of [-1, 101, 'high']) {
      expect(readSettings({ onTimeTarget: v }).ok, String(v)).toBe(false)
    }
  })

  it('only takes a date format the application can render', () => {
    for (const f of DATE_FORMATS) expect(readSettings({ dateFormat: f }).ok).toBe(true)
    for (const v of ['YYYY-MM-DD', 'MM-DD-YYYY', '', 1]) {
      expect(readSettings({ dateFormat: v }).ok, String(v)).toBe(false)
    }
  })

  it('refuses anything that is not an object', () => {
    for (const body of NOT_OBJECTS) expect(readSettings(body).ok).toBe(false)
  })
})
