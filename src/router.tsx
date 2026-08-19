import {
  createRootRoute,
  createRoute,
  createRouter,
  lazyRouteComponent,
  redirect,
} from '@tanstack/react-router'
import { AppShell } from './app/AppShell'
import { NotFound } from './screens/NotFound'

/**
 * Code-based routes, one per screen id in the sidebar. Paths are real browser
 * paths so every screen deep-links — which is also why the host needs an SPA
 * rewrite to `/index.html`.
 *
 * Screens are lazy: the first paint carries the shell, not the whole app.
 */

const rootRoute = createRootRoute({
  component: AppShell,
  notFoundComponent: NotFound,
})

/** Generic over the path so TanStack keeps the literal type for `navigate({ to })`. */
const screen = <P extends string>(path: P, load: Parameters<typeof lazyRouteComponent>[0]) =>
  createRoute({ getParentRoute: () => rootRoute, path, component: lazyRouteComponent(load) })

const routeTree = rootRoute.addChildren([
  createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    beforeLoad: () => {
      throw redirect({ to: '/dash' })
    },
  }),

  /* Production */
  screen('/dash', () => import('./screens/Dashboard')),
  createRoute({
    getParentRoute: () => rootRoute,
    path: '/orders',
    /* The dashboard tiles deep-link into a filter, so the pill lives in the URL. */
    validateSearch: (s: Record<string, unknown>): { pill?: string } =>
      typeof s.pill === 'string' ? { pill: s.pill } : {},
    component: lazyRouteComponent(() => import('./screens/Orders')),
  }),
  screen('/orders/$orderId', () => import('./screens/OrderDetail')),
  screen('/mywork', () => import('./screens/MyWork')),
  screen('/mypay', () => import('./screens/MyPayslips')),
  screen('/myperf', () => import('./screens/MyPerformance')),
  screen('/assign', () => import('./screens/Assignment')),
  screen('/intake', () => import('./screens/Intake')),
  screen('/commitment', () => import('./screens/CommitmentReport')),

  /* Business */
  screen('/leads', () => import('./screens/Leads')),
  screen('/leads/new', () => import('./screens/NewLead')),
  screen('/leads/$leadId', () => import('./screens/LeadDetail')),
  screen('/billing', () => import('./screens/Invoicing')),
  screen('/clients/$clientCode', () => import('./screens/ClientDetail')),

  /* HRMS */
  screen('/attend', () => import('./screens/Attendance')),
  screen('/leave', () => import('./screens/LeaveScreen')),
  screen('/payroll', () => import('./screens/Payroll')),
  screen('/payslips', () => import('./screens/Payslips')),
  screen('/hiring', () => import('./screens/Recruitment')),
  screen('/petty', () => import('./screens/PettyCash')),

  /* Reference */
  screen('/counties', () => import('./screens/Counties')),
  screen('/linkcheck', () => import('./screens/LinkMonitor')),

  /* Insight */
  screen('/performance', () => import('./screens/Performance')),

  /* People — reached from the Company roster and from an order's assignment strip. */
  screen('/staff/$personId', () => import('./screens/PersonDetail')),

  /* Configure */
  screen('/integ', () => import('./screens/Integrations')),
  screen('/company', () => import('./screens/Company')),
  screen('/onboard', () => import('./screens/Onboard')),

  /* Account */
  /* The one public route. It carries where you were headed so signing in resumes it. */
  createRoute({
    getParentRoute: () => rootRoute,
    path: '/signin',
    validateSearch: (search: Record<string, unknown>): { next?: string } => {
      const next = search.next
      /* Only same-site paths — an absolute URL here would be an open redirect. */
      return typeof next === 'string' && next.startsWith('/') && !next.startsWith('//')
        ? { next }
        : {}
    },
    component: lazyRouteComponent(() => import('./screens/SignIn')),
  }),
])

export const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
  scrollRestoration: false,
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
