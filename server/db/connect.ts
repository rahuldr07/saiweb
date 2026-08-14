import { drizzle } from 'drizzle-orm/postgres-js'
import { sql } from 'drizzle-orm'
import postgres from 'postgres'
import * as schema from './schema'

/**
 * Connecting to the database, shared by the server and the seed.
 *
 * There are two roles, and the difference between them is the whole of tenant
 * isolation:
 *
 *  - The **owner** (`DATABASE_URL`) creates tables and loads seed data. It holds
 *    `BYPASSRLS`, because provisioning a workspace means writing the row that
 *    defines the scope every policy checks against — there is no scope to be
 *    inside yet.
 *  - The **application role** (`APP_DATABASE_URL`) owns nothing and bypasses
 *    nothing, so the policies in `rls.sql` actually apply to it. This is the one
 *    the server uses.
 *
 * Handing the server the owner's URL would disable every policy at once and look
 * completely normal, which is why `assertRlsApplies` exists.
 */

export type Db = ReturnType<typeof drizzle<typeof schema>>

export function createDb(url: string, max = 10) {
  const queryClient = postgres(url, {
    max,
    /* `drop policy if exists` and friends raise a NOTICE per statement, which is
       expected and says nothing — the scripts verify their own effects instead. */
    onnotice: () => {},
  })
  return { db: drizzle(queryClient, { schema }), queryClient }
}

/**
 * Runs `fn` with `app.tenant_id` set for the duration of one transaction, which
 * is what the RLS policies read.
 *
 * `set_config(..., true)` makes the setting local to the transaction, so a pooled
 * connection cannot carry one workspace's scope into the next request.
 */
export async function withTenantOn<T>(
  db: Db,
  tenantId: string,
  fn: (tx: Db) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.tenant_id', ${tenantId}, true)`)
    return fn(tx as unknown as Db)
  })
}

/**
 * Refuses to continue if the connected role would bypass row-level security.
 *
 * Owner-bypass and `BYPASSRLS` are silent and total: every policy stops applying
 * and nothing looks wrong. A misconfigured `APP_DATABASE_URL` is therefore not a
 * degraded mode, it is a full cross-tenant data leak with no symptom — so this
 * is a startup error, not a warning.
 */
export async function assertRlsApplies(db: Db): Promise<void> {
  const rows = await db.execute<{
    role: string
    superuser: boolean
    bypassrls: boolean
    owned: number
  }>(sql`
    select
      current_user::text as role,
      r.rolsuper       as superuser,
      r.rolbypassrls   as bypassrls,
      (select count(*)::int from pg_tables
         where schemaname = 'public' and tableowner = current_user) as owned
    from pg_roles r
    where r.rolname = current_user
  `)

  const row = Array.from(rows)[0]
  if (!row) return

  const why =
    row.superuser ? 'is a superuser'
    : row.bypassrls ? 'holds BYPASSRLS'
    : row.owned > 0 ? `owns ${row.owned} table(s) in schema public`
    : null

  if (why) {
    throw new Error(
      `Refusing to start: the database role "${row.role}" ${why}, so it bypasses ` +
        'row-level security and tenant isolation would not be enforced. Point ' +
        'APP_DATABASE_URL at the app_user role created by server/db/rls.sql.',
    )
  }
}

export { schema }
