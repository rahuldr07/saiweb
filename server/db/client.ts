import { assertRlsApplies, createDb, withTenantOn, schema, type Db } from './connect'

/**
 * The connection the server uses. It is deliberately *not* the owner: see
 * `connect.ts` for why the two roles cannot be the same one.
 */
const url = process.env.APP_DATABASE_URL
if (!url) {
  throw new Error(
    'APP_DATABASE_URL is not set. The server connects as the non-owner application ' +
      'role so that row-level security applies to it — see server/db/rls.sql. ' +
      'Copy .env.example to .env and fill it in.',
  )
}

const { db, queryClient } = createDb(url)

export { db, queryClient, schema, assertRlsApplies }
export type { Db }

/** Every request handler goes through here — that is the whole of tenant isolation. */
export const withTenant = <T>(tenantId: string, fn: (tx: Db) => Promise<T>): Promise<T> =>
  withTenantOn(db, tenantId, fn)

/** Checks this specific connection, at startup. */
export const assertServerRoleIsSafe = () => assertRlsApplies(db)
