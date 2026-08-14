/**
 * Permissions live in our own tables, not in the auth provider. A role carries a
 * set of capability keys; every nav item and guarded action names the capability
 * it needs. Anything a person lacks is hidden rather than disabled, which is why
 * `visibleNav` filters rather than annotates.
 */
import { ROLELIST, NAVPERM } from '@/data/org'
import { STAFF } from '@/data/people'
import type { Person, Role } from '@/data/types'
import { NAV, type NavGroup } from '@/app/nav'

export const roleOf = (roleId: string): Role =>
  ROLELIST.find((r) => r.id === roleId) ?? ROLELIST[0]

export const roleName = (roleId: string) => roleOf(roleId).n

export const personById = (id: string): Person | undefined => STAFF.find((s) => s.id === id)

export const whoName = (id: string) => personById(id)?.n ?? '—'

/** Capability check for a given person. */
export function can(person: Person | undefined, capability: string): boolean {
  if (!person) return false
  return roleOf(person.r).p.includes(capability)
}

export const isAdmin = (person: Person | undefined) => person?.r === 'admin'

/**
 * The three personal screens are deliberately the inverse of the company ones:
 * someone who can see every order uses the dashboard, not "My work"; someone who
 * runs payroll uses the run itself, not "My payslips".
 */
export function visibleNav(person: Person | undefined): NavGroup[] {
  const has = (k: string) => can(person, k)
  return NAV.map((g) => ({
    ...g,
    t: g.t.filter((item) => {
      const route = item[1]
      if (route === 'mywork') return !has('all')
      if (route === 'myperf') return (person?.dep.length ?? 0) > 0
      if (route === 'mypay') return !has('pricing')
      if (route === 'dash') return has('all')
      const need = NAVPERM[route]
      return !need || has(need)
    }),
  })).filter((g) => g.t.length > 0)
}

/** Every route that exists, mapped to the capability it needs (null = everyone). */
export const routeNeeds = (route: string): string | null => NAVPERM[route] ?? null

export function mayVisit(person: Person | undefined, route: string): boolean {
  if (route === 'dash') return can(person, 'all')
  const need = routeNeeds(route)
  return !need || can(person, need)
}
