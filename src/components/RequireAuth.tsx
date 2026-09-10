import { useEffect, type ReactNode } from 'react'
import { useRouterState } from '@tanstack/react-router'
import { useGo } from '@/lib/nav'
import { useSession } from '@/state/session'

export function RequireAuth({ children }: { children: ReactNode }) {
  const { authState } = useSession()
  const navigate = useGo()
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const isPublic = pathname === '/signin'

  useEffect(() => {
    if (authState === 'anonymous' && !isPublic) {
      navigate({ to: '/signin', search: { next: pathname }, replace: true })
    }
  }, [authState, isPublic, pathname, navigate])

  if (authState === 'loading') return <div aria-busy="true" style={{ minHeight: '100vh' }} />

  if (authState === 'anonymous' && !isPublic) return null

  return <>{children}</>
}
