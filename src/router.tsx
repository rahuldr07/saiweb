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
  /* Static before dynamic, so "new" is the form and not an order id. */
  screen('/orders/new', () => import('./screens/NewOrder')),
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
  /* The register's view state lives in the URL, so returning from a payslip
     lands back on the tab, month and person you left — and so a particular view
     can be sent to somebody. */
  createRoute({
    getParentRoute: () => rootRoute,
    path: '/payslips',
    validateSearch: (s: Record<string, unknown>): { tab?: string; m?: string; p?: string } => ({
      ...(typeof s.tab === 'string' ? { tab: s.tab } : {}),
      ...(typeof s.m === 'string' ? { m: s.m } : {}),
      ...(typeof s.p === 'string' ? { p: s.p } : {}),
    }),
    component: lazyRouteComponent(() => import('./screens/Payslips')),
  }),
  /* One person's payslip for one month. The month rides in the URL so a link to
     a slip is a link to that slip, not to whichever month is current. */
  createRoute({
    getParentRoute: () => rootRoute,
    path: '/payslips/$personId',
    validateSearch: (s: Record<string, unknown>): { m?: string } =>
      typeof s.m === 'string' ? { m: s.m } : {},
    component: lazyRouteComponent(() => import('./screens/PayslipDetail')),
  }),
  screen('/hiring', () => import('./screens/Recruitment')),
  screen('/petty', () => import('./screens/PettyCash')),

  /* Reference */
  /* The link monitor's tiles hand the coverage screen a filter, so it lives in
     the URL rather than in the screen — one register, two ways in. */
  createRoute({
    getParentRoute: () => rootRoute,
    path: '/counties',
    validateSearch: (s: Record<string, unknown>): { f?: string } =>
      typeof s.f === 'string' ? { f: s.f } : {},
    component: lazyRouteComponent(() => import('./screens/Counties')),
  }),
  screen('/linkcheck', () => import('./screens/LinkMonitor')),

  /* Insight */
  /* Orders hands the workload report the staff member or department it is
     filtered to, so "Workload report" lands on the answer rather than on the
     whole floor. All three are optional — /reports on its own still opens on
     Received. */
  createRoute({
    getParentRoute: () => rootRoute,
    path: '/reports',
    validateSearch: (s: Record<string, unknown>): { tab?: string; sw?: string; dw?: string } => ({
      ...(typeof s.tab === 'string' ? { tab: s.tab } : {}),
      ...(typeof s.sw === 'string' ? { sw: s.sw } : {}),
      ...(typeof s.dw === 'string' ? { dw: s.dw } : {}),
    }),
    component: lazyRouteComponent(() => import('./screens/Reports')),
  }),

  /* People — reached from the Company roster and from an order's assignment strip. */
  screen('/staff/$personId', () => import('./screens/PersonDetail')),

  /* Configure */
  screen('/integ', () => import('./screens/Integrations')),
  /* Reports links straight at Company → Turnaround & SLA, where the stage
     budgets it is complaining about are set, so the tab is nameable. */
  createRoute({
    getParentRoute: () => rootRoute,
    path: '/company',
    validateSearch: (s: Record<string, unknown>): { tab?: string } =>
      typeof s.tab === 'string' ? { tab: s.tab } : {},
    component: lazyRouteComponent(() => import('./screens/Company')),
  }),
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
