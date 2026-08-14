/**
 * Talking to the API.
 *
 * Paths are same-origin (`/api/…`) because the dev server proxies them, which is
 * why there is no CORS in development and no base URL to configure here.
 *
 * The active workspace travels as a header rather than in the path. The server
 * resolves capabilities *inside* the named workspace for the signed-in user, so
 * naming one you do not belong to yields a 403 — the header selects, membership
 * decides.
 */

export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }

  /** The person is signed in but this workspace or capability is not theirs. */
  get isForbidden() {
    return this.status === 403
  }

  get isUnauthenticated() {
    return this.status === 401
  }
}

async function request<T>(path: string, tenantId: string | null, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      ...(init?.body ? { 'content-type': 'application/json' } : {}),
      ...(tenantId ? { 'x-tenant-id': tenantId } : {}),
      ...init?.headers,
    },
  })

  if (!res.ok) {
    /* An error body is JSON when the API produced it and something else when a
       proxy or a crash did, so the fallback is the status line rather than a
       parse failure surfacing as the error. */
    const detail = await res
      .json()
      .then((b: { error?: string }) => b.error)
      .catch(() => null)
    throw new ApiError(res.status, detail ?? `${res.status} ${res.statusText}`)
  }

  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

export const api = {
  get: <T>(path: string, tenantId: string | null) => request<T>(path, tenantId),
  post: <T>(path: string, tenantId: string | null, body: unknown) =>
    request<T>(path, tenantId, { method: 'POST', body: JSON.stringify(body) }),
}

/* ── the shapes the server returns ──────────────────────────────────────── */

export interface Membership {
  id: string
  slug: string
  name: string
  plan: string
  state: string
  personId: string
  current: boolean
}

export interface Me {
  person: {
    id: string
    ref: string
    name: string
    email: string
    capacity: number
    availability: string
    shift: string
    active: boolean
  } | null
  tenant: { id: string; slug: string; name: string; plan: string; state: string } | null
  settings: { dateFormat: string; slaBufferPct: number; onTimeTarget: number } | null
  capabilities: string[]
}

export const fetchMe = (tenantId: string | null) => api.get<Me>('/me', tenantId)
export const fetchMemberships = (tenantId: string | null) =>
  api.get<Membership[]>('/memberships', tenantId)
