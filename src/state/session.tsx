import { createContext, use, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { STAFF } from '@/data/people'
import { TENANTS } from '@/data/org'
import type { Person, Tenant } from '@/data/types'
import { can as canFor, roleName } from '@/lib/permissions'

/**
 * Who you are and which company you are inside. Both are deliberately explicit:
 * tenant isolation has to be visible, and the signed-in identity drives which
 * screens exist at all.
 */
interface SessionValue {
  me: Person
  tenant: Tenant
  theme: 'light' | 'dark'
  navOpen: boolean
  signInAs: (id: string) => void
  switchTenant: (id: string) => void
  toggleTheme: () => void
  setNavOpen: (open: boolean) => void
  can: (capability: string) => boolean
  roleLabel: string
}

const SessionContext = createContext<SessionValue | null>(null)

const DEFAULT_USER = 'hw'

export function SessionProvider({ children }: { children: ReactNode }) {
  const [meId, setMeId] = useState(DEFAULT_USER)
  const [tenantId, setTenantId] = useState(TENANTS[0].id)
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const [navOpen, setNavOpen] = useState(false)

  const me = useMemo(() => STAFF.find((s) => s.id === meId) ?? STAFF[0], [meId])
  const tenant = useMemo(() => TENANTS.find((t) => t.id === tenantId) ?? TENANTS[0], [tenantId])

  /* The design toggles these on <body>, and the stylesheet keys off them. */
  useEffect(() => {
    document.body.classList.toggle('dark', theme === 'dark')
  }, [theme])

  useEffect(() => {
    document.body.classList.toggle('navopen', navOpen)
  }, [navOpen])

  const can = useCallback((capability: string) => canFor(me, capability), [me])

  const value = useMemo<SessionValue>(
    () => ({
      me,
      tenant,
      theme,
      navOpen,
      signInAs: setMeId,
      switchTenant: setTenantId,
      toggleTheme: () => setTheme((t) => (t === 'dark' ? 'light' : 'dark')),
      setNavOpen,
      can,
      roleLabel: roleName(me.r),
    }),
    [me, tenant, theme, navOpen, can],
  )

  return <SessionContext value={value}>{children}</SessionContext>
}

export function useSession(): SessionValue {
  const ctx = use(SessionContext)
  if (!ctx) throw new Error('useSession must be used inside <SessionProvider>')
  return ctx
}
