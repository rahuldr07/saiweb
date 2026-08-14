import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { auth } from './auth'
import { assertServerRoleIsSafe } from './db/client'
import { authenticate, type Ctx } from './context'
import { sessionRoutes } from './routes/session'
import { productionRoutes } from './routes/production'
import { referenceRoutes } from './routes/reference'
import { hrmsRoutes } from './routes/hrms'
import { businessRoutes } from './routes/business'
import { configRoutes } from './routes/config'

/**
 * The API the front end talks to. Three rules run through all of it:
 *
 *  - Nothing touches the database outside `withTenant`, so every query is scoped
 *    by row-level security rather than by remembering a WHERE clause.
 *  - Capabilities are checked against our own tables, never against a claim in
 *    the token.
 *  - A route that serves both a personal and a company view narrows to the
 *    caller rather than refusing, so "my payslips" and "the pay run" are the
 *    same endpoint answering honestly to two different people.
 */

const app = new Hono<Ctx>()

app.use(
  '*',
  cors({
    origin: process.env.APP_URL ?? 'http://localhost:5173',
    credentials: true,
  }),
)

/* Better Auth mounts its own routes, and they run before authentication for the
   obvious reason: signing in cannot require being signed in. */
app.on(['GET', 'POST'], '/api/auth/*', (c) => auth.handler(c.req.raw))

/* Deliberately unauthenticated: a health check that needs credentials cannot be
   used by the thing that decides whether to route traffic here. */
app.get('/api/health', (c) => c.json({ ok: true }))

app.use('/api/*', authenticate)

app.route('/api', sessionRoutes)
app.route('/api', productionRoutes)
app.route('/api', referenceRoutes)
app.route('/api', businessRoutes)
app.route('/api/hr', hrmsRoutes)
app.route('/api/config', configRoutes)

const port = Number(process.env.PORT ?? 8787)

/**
 * Check the connection before accepting a single request. If this role can
 * bypass row-level security, every policy silently stops applying and the
 * server looks entirely healthy — so the only safe response is to not start.
 */
export const start = () =>
  assertServerRoleIsSafe().then(() =>
    serve({ fetch: app.fetch, port }, (info) => {
      console.log(`API listening on http://localhost:${info.port}`)
    }),
  )

/* Not started on import, so the tests can mount the same app without binding a
   port or racing each other for one. */
if (process.env.NODE_ENV !== 'test' && !process.env.VITEST) {
  start().catch((e: unknown) => {
    console.error(e instanceof Error ? e.message : e)
    process.exit(1)
  })
}

export default app
