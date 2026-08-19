import { useEffect, type ReactNode } from 'react'
import { useNavigate, useRouterState } from '@tanstack/react-router'
import { useSession } from '@/state/session'

/**
 * The gate. Nothing inside the shell renders until we know who is asking.
 *
 * Hiding nav items is presentation, not protection — a URL can still be typed
 * or shared — so this sits above the router outlet and applies to every route
 * rather than being remembered screen by screen. `/signin` is the one public
 * route, and the redirect carries where you were going so signing in resumes it.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { authState } = useSession()
  const navigate = useNavigate()
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const isPublic = pathname === '/signin'

  useEffect(() => {
    if (authState === 'anonymous' && !isPublic) {
      navigate({ to: '/signin', search: { next: pathname }, replace: true })
    }
  }, [authState, isPublic, pathname, navigate])

  /* A blank frame rather than a spinner: the session resolves from one request,
     and a spinner that flashes for 80ms reads as jank rather than as progress. */
  if (authState === 'loading') return <div aria-busy="true" style={{ minHeight: '100vh' }} />

  /* Render nothing on the way out — showing the board for one frame before the
     redirect lands is exactly the leak this component exists to prevent. */
  if (authState === 'anonymous' && !isPublic) return null

  return <>{children}</>
}
