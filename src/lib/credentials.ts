import { STAFF } from '@/data/people'
import { ROLELIST } from '@/data/org'
import type { Person } from '@/data/types'

export type CredentialCheck = { ok: true; person: Person } | { ok: false; error: string }

export const ADMIN_EMAIL = 'hari@gmail.com'

const normalise = (email: string) => email.trim().toLowerCase()

export const personByEmail = (email: string): Person | undefined =>
  STAFF.find((s) => (s.e ?? '').toLowerCase() === normalise(email))

const hasCapability = (person: Person, capability: string) =>
  ROLELIST.find((r) => r.id === person.r)?.p.includes(capability) ?? false

const active = () => STAFF.filter((s) => s.active !== false)

export const adminAccount = (): Person | undefined =>
  active().find((s) => hasCapability(s, 'all') && hasCapability(s, 'people'))

export const staffAccount = (): Person | undefined =>
  active().find((s) => s.dep.length > 0 && !hasCapability(s, 'all'))

export interface CredentialOptions {
  passwordChecked: boolean
}

export function checkCredentials(
  email: string,
  password: string,
  { passwordChecked }: CredentialOptions,
): CredentialCheck {
  if (passwordChecked) {
    return {
      ok: false,
      error: 'This build signs in against the database. The sign-in service is not reachable.',
    }
  }
  if (!normalise(email)) return { ok: false, error: 'Your email address.' }
  if (!password) {
    return { ok: false, error: 'A password. It is not checked yet, but it is not optional either.' }
  }

  if (normalise(email) === ADMIN_EMAIL) {
    const admin = adminAccount()
    if (admin) return { ok: true, person: admin }
  }

  const known = personByEmail(email)
  if (known) {
    if (known.active === false) {
      return { ok: false, error: `${known.n}’s account is disabled. A company admin can re-enable it.` }
    }
    return { ok: true, person: known }
  }

  const staff = staffAccount()
  if (staff) return { ok: true, person: staff }

  return { ok: false, error: 'There is nobody on the roster to sign in as.' }
}
