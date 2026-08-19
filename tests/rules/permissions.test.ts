import { describe, expect, it } from 'vitest'
import { can, mayVisit, roleOf, visibleNav } from '@/lib/permissions'
import { NAVPERM, ROLELIST } from '@/data/org'
import { STAFF } from '@/data/people'
import { NAV } from '@/app/nav'
import type { Person } from '@/data/types'

/**
 * The permission model, checked without a browser.
 *
 * It is asserted here rather than only through the identity switcher because
 * that switcher is deliberately absent from production builds — so without
 * these, the model is verified in development and nowhere else.
 *
 * Navigation and access are checked as one thing on purpose. A hidden nav item
 * and a reachable URL disagreeing is the failure that matters: hiding is
 * presentation, `mayVisit` is the gate, and they must not drift apart.
 */

const person = (id: string): Person => {
  const p = STAFF.find((s) => s.id === id)
  if (!p) throw new Error(`No seeded person "${id}"`)
  return p
}

/** One representative per role, named so a failure says who broke. */
const ADMIN = person('hw') // Harry Whitfield — Company admin
const LEAD = person('sk') // Ashok S — Lead, Typing + Typing QC
const STAFF_SEARCH = person('us') // Uma Sankar — production staff, Search
const STAFF_QC = person('jr') // JP Ramesh — production staff, Search QC

const routesIn = (p: Person) => visibleNav(p).flatMap((g) => g.t.map((t) => t[1]))

describe('roles carry the capabilities they claim', () => {
  it('admin holds everything except overriding a blocking rule', () => {
    const admin = roleOf('admin')
    expect(admin.p).toEqual(
      expect.arrayContaining(['own', 'all', 'assign', 'pricing', 'qc', 'config', 'people', 'export']),
    )
    expect(admin.p).not.toContain('override')
  })

  it('a lead assigns work and sees every order, but not pricing or configuration', () => {
    expect(can(LEAD, 'assign')).toBe(true)
    expect(can(LEAD, 'all')).toBe(true)
    expect(can(LEAD, 'pricing')).toBe(false)
    expect(can(LEAD, 'config')).toBe(false)
    expect(can(LEAD, 'people')).toBe(false)
  })

  it('production staff see only their own work', () => {
    expect(can(STAFF_SEARCH, 'own')).toBe(true)
    expect(can(STAFF_SEARCH, 'all')).toBe(false)
    expect(can(STAFF_SEARCH, 'assign')).toBe(false)
    expect(can(STAFF_SEARCH, 'pricing')).toBe(false)
  })

  it('QC staff may enter ratings, and are still production staff otherwise', () => {
    expect(can(STAFF_QC, 'qc')).toBe(true)
    expect(can(STAFF_QC, 'all')).toBe(false)
    expect(can(STAFF_QC, 'assign')).toBe(false)
  })

  it('nobody holds a capability that is not declared in the role list', () => {
    const declared = new Set(ROLELIST.flatMap((r) => r.p))
    for (const need of Object.values(NAVPERM)) {
      if (need) expect(declared.has(need), `no role grants "${need}"`).toBe(true)
    }
  })
})

describe('navigation reflects capability', () => {
  it('an admin sees more of the sidebar than a lead, who sees more than staff', () => {
    expect(routesIn(ADMIN).length).toBeGreaterThan(routesIn(LEAD).length)
    expect(routesIn(LEAD).length).toBeGreaterThan(routesIn(STAFF_SEARCH).length)
  })

  it('payroll, invoicing and petty cash need pricing', () => {
    for (const route of ['payroll', 'payslips', 'billing', 'petty']) {
      expect(routesIn(ADMIN)).toContain(route)
      expect(routesIn(LEAD)).not.toContain(route)
      expect(routesIn(STAFF_SEARCH)).not.toContain(route)
    }
  })

  it('company and recruitment need people', () => {
    for (const route of ['company', 'hiring']) {
      expect(routesIn(ADMIN)).toContain(route)
      expect(routesIn(STAFF_SEARCH)).not.toContain(route)
    }
  })

  it('assignment needs assign', () => {
    expect(routesIn(ADMIN)).toContain('assign')
    expect(routesIn(LEAD)).toContain('assign')
    expect(routesIn(STAFF_SEARCH)).not.toContain('assign')
  })

  it('the personal screens are the inverse of the company ones', () => {
    /* Somebody who sees every order uses the dashboard, not "My work". */
    expect(routesIn(ADMIN)).toContain('dash')
    expect(routesIn(ADMIN)).not.toContain('mywork')
    expect(routesIn(STAFF_SEARCH)).toContain('mywork')
    expect(routesIn(STAFF_SEARCH)).not.toContain('dash')

    /* Somebody who runs payroll uses the run, not "My payslips". */
    expect(routesIn(ADMIN)).not.toContain('mypay')
    expect(routesIn(STAFF_SEARCH)).toContain('mypay')
  })

  it('everyone signed in reaches the open screens', () => {
    for (const route of ['orders', 'counties', 'linkcheck', 'leave', 'commitment']) {
      for (const p of [ADMIN, LEAD, STAFF_SEARCH, STAFF_QC]) {
        expect(routesIn(p), `${route} for ${p.n}`).toContain(route)
      }
    }
  })
})

describe('hiding a nav item and refusing the URL agree', () => {
  const everyRoute = NAV.flatMap((g) => g.t.map((t) => t[1]))

  it.each([
    ['admin', ADMIN],
    ['lead', LEAD],
    ['search staff', STAFF_SEARCH],
    ['QC staff', STAFF_QC],
  ])('%s: every hidden route is also refused, and every shown route allowed', (_label, p) => {
    const shown = new Set(routesIn(p))
    for (const route of everyRoute) {
      /* The three personal screens are filtered on something other than
         capability — being on the dashboard does not make "My work" forbidden,
         only redundant — so they are excluded from this equivalence. */
      if (['mywork', 'mypay', 'myperf'].includes(route)) continue
      expect(mayVisit(p, route), `${route} for ${p.n}`).toBe(shown.has(route))
    }
  })

  it('an unknown route needs no capability, and an absent person has none', () => {
    expect(mayVisit(ADMIN, 'not-a-route')).toBe(true)
    expect(mayVisit(undefined, 'orders')).toBe(true)
    expect(mayVisit(undefined, 'payroll')).toBe(false)
    expect(can(undefined, 'all')).toBe(false)
  })
})
