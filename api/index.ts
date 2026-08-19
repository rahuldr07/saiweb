/**
 * The API as a Vercel function.
 *
 * Vercel has no long-lived process to `serve()` into, so the same Hono app that
 * `npm run server` binds to a port is handed to the platform's fetch handler
 * instead. One app, two entry points — the routes, the authentication middleware
 * and the tenant scoping are identical either way, because they are the app
 * rather than the server around it.
 *
 * Node runtime, not Edge: the Postgres driver and Better Auth's Drizzle adapter
 * both need Node APIs.
 */
import { handle } from 'hono/vercel'
import app from '../server/index'
import { assertServerRoleIsSafe } from '../server/db/client'

export const config = {
  runtime: 'nodejs',
}

/**
 * The check `npm run server` runs before it binds a port.
 *
 * Row-level security is bypassed entirely for table owners and superusers, so a
 * function connected as the owner would enforce nothing while looking perfectly
 * healthy. There is no startup here to refuse, so it is done once per cold start
 * and every request on a bad role is failed closed rather than served.
 */
let roleChecked: Promise<void> | null = null
const checkRole = () => (roleChecked ??= assertServerRoleIsSafe())

const handler = handle(app)

export default async function (req: Request): Promise<Response> {
  try {
    await checkRole()
  } catch (e) {
    /* Retry the check on the next request rather than caching the failure —
       a database that was briefly unreachable should not sideline the whole
       warm instance. */
    roleChecked = null
    const message = e instanceof Error ? e.message : 'Database role check failed'
    return Response.json({ error: message }, { status: 503 })
  }
  return handler(req)
}
