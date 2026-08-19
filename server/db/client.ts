import { assertRlsApplies, createDb, withTenantOn, schema, type Db } from './connect'

/**
 * The connection the server uses. It is deliberately *not* the owner: see
 * `connect.ts` for why the two roles cannot be the same one.
 */
const MISSING_URL =
  'APP_DATABASE_URL is not set. The server connects as the non-owner application ' +
  'role so that row-level security applies to it — see server/db/rls.sql. ' +
  'Copy .env.example to .env and fill it in.'

/**
 * Connected on first use, not on import.
 *
 * A serverless function imports this module to get the app; throwing here killed
 * the whole function before any handler ran, so a missing variable surfaced as an
 * opaque 500 on every route — including the health check, whose entire job is to
 * answer when the database cannot. Deferring it means the misconfiguration is
 * reported by the request that actually needed a database, with its own message.
 */
let connection: { db: Db; queryClient: ReturnType<typeof createDb>['queryClient'] } | null = null

function connect() {
  if (connection) return connection
  const url = process.env.APP_DATABASE_URL
  if (!url) throw new Error(MISSING_URL)
  connection = createDb(url)
  return connection
}

/** True when a connection could be made at all — no query, no round trip. */
export const isConfigured = () => Boolean(process.env.APP_DATABASE_URL)

/* A proxy so every existing `db.select(…)` call site is unchanged: the drizzle
   instance is built on the first property access rather than at import. */
export const db: Db = new Proxy({} as Db, {
  get: (_t, prop, receiver) => Reflect.get(connect().db as object, prop, receiver) as unknown,
  has: (_t, prop) => Reflect.has(connect().db as object, prop),
})

export const queryClient = new Proxy({} as ReturnType<typeof createDb>['queryClient'], {
  get: (_t, prop, receiver) => Reflect.get(connect().queryClient as object, prop, receiver) as unknown,
})

export { schema, assertRlsApplies }
export type { Db }

/** Every request handler goes through here — that is the whole of tenant isolation. */
export const withTenant = <T>(tenantId: string, fn: (tx: Db) => Promise<T>): Promise<T> =>
  withTenantOn(db, tenantId, fn)

/** Checks this specific connection, at startup. */
export const assertServerRoleIsSafe = () => assertRlsApplies(db)
