import { STAFF } from '@/data/people'
import { ROLELIST } from '@/data/org'
import type { Person } from '@/data/types'

/**
 * Who a set of credentials belongs to.
 *
 * Pure, and separate from the session it starts, for the same reason
 * `lib/timeclock` is separate from `state/timeclock`: the rule about who may sign
 * in should be testable without a browser, and the thing that remembers it
 * cannot exist without one.
 *
 * **This currently lets anybody in.** While there is no database, the screen
 * asks for an email and a password and then decides only *which* account you
 * land in:
 *
 *  - `hari@gmail.com` — the administrator, who sees every screen.
 *  - a seeded person's own address — that person, in their own role and queue.
 *  - anything else — a member of production staff, so the restricted view can be
 *    seen without knowing anybody's address.
 *
 * The password is not read at all beyond being present. That is deliberate for a
 * demonstration over fictional records and must not survive contact with real
 * ones, which is what `passwordChecked` is for: with it on — wherever a database
 * is answering — every branch below is refused and Better Auth is the only way
 * in. It is the caller's decision rather than this module's so that the one build
 * that must never take this path cannot reach it by accident.
 */

export type CredentialCheck = { ok: true; person: Person } | { ok: false; error: string }

/** Signs in as the administrator, whatever else is on the roster. */
export const ADMIN_EMAIL = 'hari@gmail.com'

const normalise = (email: string) => email.trim().toLowerCase()

export const personByEmail = (email: string): Person | undefined =>
  STAFF.find((s) => (s.e ?? '').toLowerCase() === normalise(email))

const hasCapability = (person: Person, capability: string) =>
  ROLELIST.find((r) => r.id === person.r)?.p.includes(capability) ?? false

const active = () => STAFF.filter((s) => s.active !== false)

/** The account an unrecognised address lands in. */
export const adminAccount = (): Person | undefined =>
  active().find((s) => hasCapability(s, 'all') && hasCapability(s, 'people'))

/**
 * A member of production staff — somebody in a department who cannot see every
 * order, so the narrowed view is what an unfamiliar address gets.
 */
export const staffAccount = (): Person | undefined =>
  active().find((s) => s.dep.length > 0 && !hasCapability(s, 'all'))

export interface CredentialOptions {
  /**
   * On wherever a database is answering, and then nothing here is accepted.
   * Never on in the seed build, where no password can be verified.
   */
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

  /* A seeded address still signs that person in, so each of the twenty-eight
     keeps their own login and lands in their own role, queue and payslips. */
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
