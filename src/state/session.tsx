import { createContext, use, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { STAFF } from '@/data/people'
import { TENANTS } from '@/data/org'
import { newPerson, type Person, type Tenant } from '@/data/types'
import { can as canFor, roleName } from '@/lib/permissions'
import { endSession as endApiSession, fetchMe, fetchMemberships, type Membership } from '@/lib/api'
import { DEMO_IDENTITY } from '@/lib/demo'
import {
  endSession as endSeedSession,
  readSession as readSeedSession,
  startSession as startSeedSession,
} from './seedSession'

export type AuthState = 'loading' | 'authenticated' | 'anonymous' | 'demo'

interface SessionValue {
  me: Person
  tenant: Tenant
  theme: 'light' | 'dark'
  navOpen: boolean
  authority: 'server' | 'seed'
  authState: AuthState
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

const isServerTenantId = (id: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)

const NO_TENANT: Tenant = { id: '', name: '', plan: '', state: '' }

export function SessionProvider({ children }: { children: ReactNode }) {
  const [meId, setMeId] = useState<string | null>(() => readSeedSession())
  const [pickedTenantId, setTenantId] = useState(TENANTS[0]?.id ?? NO_TENANT.id)
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const [navOpen, setNavOpen] = useState(false)
  const queryClient = useQueryClient()


  const memberships = useQuery({
    queryKey: ['memberships'],
    queryFn: () => fetchMemberships(null),
    retry: false,
    staleTime: 5 * 60_000,
  })

  const tenantId = isServerTenantId(pickedTenantId)
    ? pickedTenantId
    : ((memberships.data?.find((t) => t.current) ?? memberships.data?.[0])?.id ?? pickedTenantId)

  const header = isServerTenantId(tenantId) ? tenantId : null

  const me = useQuery({
    queryKey: ['me', header],
    queryFn: () => fetchMe(header),
    retry: false,
    staleTime: 5 * 60_000,
    enabled: header !== null,
  })


  const serverCaps = me.data?.capabilities
  const authority: 'server' | 'seed' = serverCaps ? 'server' : 'seed'

  const bootstrapping = memberships.isPending || (header !== null && me.isPending)

  const authState: AuthState = bootstrapping
    ? 'loading'
    : me.isSuccess
      ? 'authenticated'
      : meId
        ? 'demo'
        : 'anonymous'

  const person = useMemo<Person>(() => {
    const ref = me.data?.person?.ref
    return (
      (ref ? STAFF.find((s) => s.id === ref) : undefined) ??
      STAFF.find((s) => s.id === meId) ??
      STAFF[0] ??
      newPerson()
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
    return TENANTS.find((t) => t.id === tenantId) ?? TENANTS[0] ?? NO_TENANT
  }, [memberships.data, me.data, tenantId])

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

  const signInAs = useCallback((id: string) => {
    if (!DEMO_IDENTITY) return
    startSeedSession(id)
    setMeId(id)
  }, [])

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
