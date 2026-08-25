import { STAFF } from '@/data/people'
import { DEMO_IDENTITY } from '@/lib/demo'
import { checkCredentials as check, type CredentialCheck } from '@/lib/credentials'

/**
 * Signing in when there is no server to ask.
 *
 * The seed build has no database, so Better Auth has nothing to check a password
 * against. It used to resolve that by not asking: the application opened
 * straight into a workspace as a fixed person, and identity was changed by
 * picking a name off a list. That demonstrates the permission model well and is
 * not a sign-in.
 *
 * This is the middle position, and it is deliberately narrow:
 *
 *  - **The email decides who you are.** Every person carries one on their record
 *    already, so each of the twenty-eight has their own login and lands in their
 *    own role, their own queue and their own payslips.
 *  - **The password is required but not verified.** There is nothing to verify it
 *    against until the database exists. It is asked for because a build that
 *    never asks trains everyone to expect that, and because the shape of the
 *    flow should be the real one before the check behind it is.
 *  - **None of this runs without `DEMO_IDENTITY`.** A build with the flag off
 *    gets Better Auth and only Better Auth, so this can never become the way
 *    into a deployment holding real records.
 *
 * The rule itself lives in `lib/credentials`; this is the part that needs a
 * browser.
 */

const KEY = 'titlecrm.seed-session'

/**
 * The lenient branch is reachable only where the demonstration flag is on.
 * Passing `passwordChecked: true` anywhere else makes the check refuse outright
 * rather than fall back, which is the whole point of the flag.
 */
export const checkCredentials = (email: string, password: string): CredentialCheck =>
  check(email, password, { passwordChecked: !DEMO_IDENTITY })

/* ── the session itself ──────────────────────────────────────────────────── */

/**
 * Per tab, not per browser.
 *
 * `sessionStorage` survives a reload, which is what somebody signing in expects,
 * and does not survive the tab, which keeps a shared machine from leaving the
 * last person signed in. It also lets two tabs hold two different people, which
 * is the fastest way to see what a role actually changes.
 */
const store = (): Storage | null => {
  try {
    return typeof window === 'undefined' ? null : window.sessionStorage
  } catch {
    /* Storage can be blocked outright. Signing in should still work; it just
       will not outlive the page. */
    return null
  }
}

let inMemory: string | null = null

/**
 * Both of these refuse outright where the demonstration flag is off, and that is
 * load-bearing rather than tidy.
 *
 * `sessionStorage` is the reader's to write. Anyone can open the console and set
 * this key, and the session provider turns a key it finds into `authState:
 * 'demo'`, which the route gate lets through — so a build that honoured the key
 * regardless of the flag could be entered as the administrator with no password
 * and no server, simply by typing one line into devtools. Removing the flag from
 * `.env.production` did not close that; only this does.
 *
 * With the flag off there is exactly one way in: Better Auth against the
 * database.
 */
export function readSession(): string | null {
  if (!DEMO_IDENTITY) return null
  const id = store()?.getItem(KEY) ?? inMemory
  /* A person removed from the roster since signing in is not signed in. */
  return id && STAFF.some((s) => s.id === id) ? id : null
}

export function startSession(personId: string): void {
  if (!DEMO_IDENTITY) return
  inMemory = personId
  store()?.setItem(KEY, personId)
}

export function endSession(): void {
  inMemory = null
  store()?.removeItem(KEY)
}
