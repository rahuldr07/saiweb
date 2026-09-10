export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }

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

export async function startSession(email: string, password: string): Promise<void> {
  const res = await fetch('/api/auth/sign-in/email', {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  if (!res.ok) {
    const detail = await res
      .json()
      .then((b: { message?: string; error?: string }) => b.message ?? b.error)
      .catch(() => null)
    if (res.status === 404) throw new ApiError(404, 'The sign-in service is not reachable.')
    throw new ApiError(res.status, detail ?? 'That email and password did not match.')
  }
}

export async function endSession(): Promise<void> {
  await fetch('/api/auth/sign-out', { method: 'POST', credentials: 'include' }).catch(() => null)
}
