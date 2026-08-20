import { createContext, use, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { STAFF } from '@/data/people'
import { TENANTS } from '@/data/org'
import type { Person, Tenant } from '@/data/types'
import { can as canFor, roleName } from '@/lib/permissions'
import { endSession, fetchMe, fetchMemberships, type Membership } from '@/lib/api'
import { DEMO_IDENTITY } from '@/lib/demo'

/**
 * Who you are and which company you are inside.
 *
 * Capabilities have one authority, and it is the database. The client used to
 * answer `can()` from a role table shipped in the bundle; that agreed with the
 * server only because one had been transcribed from the other, and would have
 * stopped agreeing the moment roles became editable — which the schema already
 * supports. So the server's answer wins whenever there is one.
 *
 * The bundled roles remain as the fallback for the seed-data build, where there
 * is no server to ask. `authority` says which is in force rather than leaving it
 * to be guessed.
 */
/**
 * Whether this browser may see the application at all.
 *
 * `demo` exists because the seed build has no server to authenticate against.
 * It is reachable only where `DEMO_IDENTITY` is on — development, or a build
 * someone deliberately flagged. Any other build with no session is `anonymous`,
 * and anonymous gets the sign-in screen rather than a workspace.
 */
export type AuthState = 'loading' | 'authenticated' | 'anonymous' | 'demo'

/**
 * Whether a build with no API opens straight into the application.
 *
 * There is nothing to authenticate against until the database exists, so a gate
 * in front of the seed build only ever asked for credentials it could not check.
 * It is off while the data is fictional. Real sign-in is unaffected: the moment
 * `/api/me` answers, a browser without a session is `anonymous` and gets the
 * form, and clearing `VITE_DEMO_IDENTITY` turns this off with it.
 */
export const OPEN_ACCESS = DEMO_IDENTITY

interface SessionValue {
  me: Person
  tenant: Tenant
  theme: 'light' | 'dark'
  navOpen: boolean
  /** Where `can()` is getting its answer. */
  authority: 'server' | 'seed'
  authState: AuthState
  /** The workspaces this person belongs to, once the server has said. */
  memberships: Membership[]
  signInAs: (id: string) => void
  signOut: () => Promise<void>
  switchTenant: (id: string) => void
  toggleTheme: () => void
  setNavOpen: (open: boolean) => void
  can: (capability: string) => boolean
  roleLabel: string
}

const SessionContext = createContext<SessionValue | null>(null)

const DEFAULT_USER = 'hw'

/** Seed workspaces are keyed by slug; the server's are UUIDs. */
const isServerTenantId = (id: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)

export function SessionProvider({ children }: { children: ReactNode }) {
  const [meId, setMeId] = useState(DEFAULT_USER)
  const [tenantId, setTenantId] = useState(TENANTS[0].id)
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const [navOpen, setNavOpen] = useState(false)
  const queryClient = useQueryClient()


  /* Only send a workspace header once we hold a real id — before that the server
     falls back to whichever workspace the session is already inside. */
  const header = isServerTenantId(tenantId) ? tenantId : null

  /* `retry: false` because the interesting failure is "there is no server", and
     retrying it three times only delays the fallback. */
  const me = useQuery({
    queryKey: ['me', header],
    queryFn: () => fetchMe(header),
    retry: false,
    staleTime: 5 * 60_000,
  })

  const memberships = useQuery({
    queryKey: ['memberships'],
    queryFn: () => fetchMemberships(header),
    retry: false,
    staleTime: 5 * 60_000,
    enabled: me.isSuccess,
  })

  const serverCaps = me.data?.capabilities
  const authority: 'server' | 'seed' = serverCaps ? 'server' : 'seed'

  /* A failed /api/me means one of two things, and they are not the same: there
     is no server (the seed build, which opens straight into the application),
     or there is one and this browser has no session — which is the only case
     that gets the sign-in screen. */
  const authState: AuthState = me.isPending
    ? 'loading'
    : me.isSuccess
      ? 'authenticated'
      : OPEN_ACCESS
        ? 'demo'
        : 'anonymous'

  const seedMe = useMemo(() => STAFF.find((s) => s.id === meId) ?? STAFF[0], [meId])

  /* The server knows the person's name and role; the seed knows their
     department, capacity and level, which no endpoint exposes yet. Until the
     screens read the API, the seed record stays the shape everything renders
     from — only the capabilities are taken from the server. */
  const person = seedMe

  const tenant = useMemo<Tenant>(() => {
    const fromServer = memberships.data?.find((t) => t.id === tenantId)
    if (fromServer) {
      return { id: fromServer.id, name: fromServer.name, plan: fromServer.plan, state: fromServer.state }
    }
    if (me.data?.tenant && isServerTenantId(tenantId)) {
      const t = me.data.tenant
      return { id: t.id, name: t.name, plan: t.plan, state: t.state }
    }
    return TENANTS.find((t) => t.id === tenantId) ?? TENANTS[0]
  }, [memberships.data, me.data, tenantId])

  /* The design toggles these on <body>, and the stylesheet keys off them. */
  useEffect(() => {
    document.body.classList.toggle('dark', theme === 'dark')
  }, [theme])

  useEffect(() => {
    document.body.classList.toggle('navopen', navOpen)
  }, [navOpen])

  const can = useCallback(
    (capability: string) =>
      serverCaps ? serverCaps.includes(capability) : canFor(person, capability),
    [serverCaps, person],
  )

  /* Switching identity without a password is a development affordance; ignoring
     the call rather than removing it keeps every caller honest about that. */
  const signInAs = useCallback((id: string) => {
    if (!DEMO_IDENTITY) return
    setMeId(id)
  }, [])

  /* Ends the server session, then clears every cached answer — capabilities and
     workspace membership are per-person, so leaving them behind would show the
     next person the previous one's board until each query happened to refetch. */
  const signOut = useCallback(async () => {
    await endSession()
    await queryClient.resetQueries()
  }, [queryClient])

  const value = useMemo<SessionValue>(
    () => ({
      me: person,
      tenant,
      theme,
      navOpen,
      authority,
      authState,
      memberships: memberships.data ?? [],
      signInAs,
      signOut,
      switchTenant: setTenantId,
      toggleTheme: () => setTheme((t) => (t === 'dark' ? 'light' : 'dark')),
      setNavOpen,
      can,
      roleLabel: me.data?.person ? roleName(person.r) : roleName(person.r),
    }),
    [person, tenant, theme, navOpen, authority, authState, memberships.data, signInAs, signOut, can, me.data],
  )

  return <SessionContext value={value}>{children}</SessionContext>
}

export function useSession(): SessionValue {
  const ctx = use(SessionContext)
  if (!ctx) throw new Error('useSession must be used inside <SessionProvider>')
  return ctx
}
