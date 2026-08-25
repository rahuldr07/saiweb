import { createContext, use, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { STAFF } from '@/data/people'
import { TENANTS } from '@/data/org'
import type { Person, Tenant } from '@/data/types'
import { can as canFor, roleName } from '@/lib/permissions'
import { endSession as endApiSession, fetchMe, fetchMemberships, type Membership } from '@/lib/api'
import { DEMO_IDENTITY } from '@/lib/demo'
import {
  endSession as endSeedSession,
  readSession as readSeedSession,
  startSession as startSeedSession,
} from './seedSession'

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

/*
 * There used to be an `OPEN_ACCESS` here, and with it the seed build opened
 * straight into a workspace as a fixed person. The reasoning was that a gate in
 * front of a build with no database can only ask for credentials it cannot
 * check.
 *
 * That was half right. It cannot check the password yet — but it can ask, and it
 * can let the email decide who you are, which is what gives each of the
 * twenty-eight people their own login instead of everybody arriving as the same
 * admin. See `seedSession.ts` for what is and is not verified.
 */

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

/** Seed workspaces are keyed by slug; the server's are UUIDs. */
const isServerTenantId = (id: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)

export function SessionProvider({ children }: { children: ReactNode }) {
  /* Whoever signed in on this tab. Nobody, until they do. */
  const [meId, setMeId] = useState<string | null>(() => readSeedSession())
  const [pickedTenantId, setTenantId] = useState(TENANTS[0].id)
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const [navOpen, setNavOpen] = useState(false)
  const queryClient = useQueryClient()


  /*
   * Which workspaces this user is in.
   *
   * Deliberately first, deliberately not gated on `me`, and deliberately asked
   * without a workspace header: it is the one call that answers with a session
   * alone. `/me` cannot answer until a workspace has been named, and the only
   * place a workspace id comes from is this list — so gating this on `me`
   * succeeding meant neither ever did, and a correct email and password landed
   * straight back on the sign-in form.
   */
  const memberships = useQuery({
    queryKey: ['memberships'],
    queryFn: () => fetchMemberships(null),
    retry: false,
    staleTime: 5 * 60_000,
  })

  /*
   * The workspace being asked about.
   *
   * A fresh session has settled on none, so the client adopts one as soon as it
   * knows which it may use: the one the server calls current, or the first it is
   * a member of. Derived rather than stored — an explicit pick outranks it the
   * moment there is one, and writing it back from an effect only buys a second
   * render.
   */
  const tenantId = isServerTenantId(pickedTenantId)
    ? pickedTenantId
    : ((memberships.data?.find((t) => t.current) ?? memberships.data?.[0])?.id ?? pickedTenantId)

  /* Only send a workspace header once we hold a real id — before that the server
     falls back to whichever workspace the session is already inside. */
  const header = isServerTenantId(tenantId) ? tenantId : null

  /*
   * `retry: false` because the interesting failure is "there is no server", and
   * retrying it three times only delays the fallback.
   *
   * Not asked at all until a workspace is known. Asking without one is answered
   * "no workspace selected", and an error here reads as "not signed in" two
   * lines below — so firing it during the bootstrap made entry a race between
   * two requests: if this one settled first the gate bounced to the sign-in form
   * with a perfectly good session in hand, and if the other did, it did not.
   */
  const me = useQuery({
    queryKey: ['me', header],
    queryFn: () => fetchMe(header),
    retry: false,
    staleTime: 5 * 60_000,
    enabled: header !== null,
  })


  const serverCaps = me.data?.capabilities
  const authority: 'server' | 'seed' = serverCaps ? 'server' : 'seed'

  /* Three outcomes, and they are not the same thing. The server knows you:
     authenticated. It does not, but this tab holds a seed sign-in: demo — the
     credential form was filled in, the email picked the person, and the password
     is the part that is not checked yet. Neither: anonymous, and anonymous gets
     the form rather than a workspace. */
  /* The bootstrap is two requests, not one, and it is not finished until both
     have had their turn: the workspace list, and then who you are inside the
     workspace it named. Calling it early is what bounced a signed-in person. */
  const bootstrapping = memberships.isPending || (header !== null && me.isPending)

  const authState: AuthState = bootstrapping
    ? 'loading'
    : me.isSuccess
      ? 'authenticated'
      : meId
        ? 'demo'
        : 'anonymous'

  /**
   * Who the application renders as.
   *
   * The seed record is still the shape everything reads — it carries the
   * department, capacity and level no endpoint exposes yet — but *which* record
   * has to come from the server when there is one. `people.ref` is the seed id,
   * so the two line up.
   *
   * This used to be the locally chosen id unconditionally, which meant a real
   * deployment rendered every signed-in person as the same default: their own
   * queue, their own payslips and their own "my work" all belonged to somebody
   * else. Capabilities were correct and identity was not, which is the worst
   * of the two to get wrong silently.
   */
  const person = useMemo(() => {
    const ref = me.data?.person?.ref
    return (
      (ref ? STAFF.find((s) => s.id === ref) : undefined) ??
      STAFF.find((s) => s.id === meId) ??
      STAFF[0]
    )
  }, [me.data?.person?.ref, meId])

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

  /* Taking the place of a seeded person. Reached from the sign-in form once the
     email has named them, and refused outright in a build with the demonstration
     flag off — there, Better Auth is the only way in. */
  const signInAs = useCallback((id: string) => {
    if (!DEMO_IDENTITY) return
    startSeedSession(id)
    setMeId(id)
  }, [])

  /* Ends the server session, then clears every cached answer — capabilities and
     workspace membership are per-person, so leaving them behind would show the
     next person the previous one's board until each query happened to refetch. */
  const signOut = useCallback(async () => {
    endSeedSession()
    setMeId(null)
    await endApiSession()
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
      roleLabel: roleName(person.r),
    }),
    [person, tenant, theme, navOpen, authority, authState, memberships.data, signInAs, signOut, can],
  )

  return <SessionContext value={value}>{children}</SessionContext>
}

export function useSession(): SessionValue {
  const ctx = use(SessionContext)
  if (!ctx) throw new Error('useSession must be used inside <SessionProvider>')
  return ctx
}
