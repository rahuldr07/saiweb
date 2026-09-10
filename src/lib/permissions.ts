import { ROLELIST, NAVPERM } from '@/data/org'
import { STAFF } from '@/data/people'
import type { Person, Role } from '@/data/types'
import { NAV, type NavGroup } from '@/app/nav'

const NO_ROLE: Role = { id: '', n: '—', desc: '', p: [] }

export const roleOf = (roleId: string): Role =>
  ROLELIST.find((r) => r.id === roleId) ?? ROLELIST[0] ?? NO_ROLE

export const roleName = (roleId: string) => roleOf(roleId).n

export const personById = (id: string): Person | undefined => STAFF.find((s) => s.id === id)

export const whoName = (id: string) => personById(id)?.n ?? '—'

export function can(person: Person | undefined, capability: string): boolean {
  if (!person) return false
  return roleOf(person.r).p.includes(capability)
}

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

export const routeNeeds = (route: string): string | null => NAVPERM[route] ?? null

export function mayVisit(person: Person | undefined, route: string): boolean {
  if (route === 'dash') return can(person, 'all')
  const need = routeNeeds(route)
  return !need || can(person, need)
}
