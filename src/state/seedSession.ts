import { STAFF } from '@/data/people'
import { DEMO_IDENTITY } from '@/lib/demo'
import { checkCredentials as check, type CredentialCheck } from '@/lib/credentials'

const KEY = 'titlecrm.seed-session'

export const checkCredentials = (email: string, password: string): CredentialCheck =>
  check(email, password, { passwordChecked: !DEMO_IDENTITY })

const store = (): Storage | null => {
  try {
    return typeof window === 'undefined' ? null : window.sessionStorage
  } catch {
    return null
  }
}

let inMemory: string | null = null

export function readSession(): string | null {
  if (!DEMO_IDENTITY) return null
  const id = store()?.getItem(KEY) ?? inMemory
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
