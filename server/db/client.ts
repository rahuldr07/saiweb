import { drizzle } from 'drizzle-orm/postgres-js'
import { sql } from 'drizzle-orm'
import postgres from 'postgres'
import * as schema from './schema'

const url = process.env.DATABASE_URL
if (!url) {
  throw new Error('DATABASE_URL is not set — copy .env.example to .env and fill it in')
}

export const queryClient = postgres(url, { max: 10 })
export const db = drizzle(queryClient, { schema })
export type Db = typeof db

/**
 * Runs `fn` with `app.tenant_id` set for the duration of one transaction, which
 * is what the RLS policies read. Every request handler goes through here — that
 * is the whole of tenant isolation, and it is the database that enforces it.
 *
 * `set_config(..., true)` makes the setting local to the transaction, so a pooled
 * connection cannot carry one workspace's scope into the next request.
 */
export async function withTenant<T>(tenantId: string, fn: (tx: Db) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.tenant_id', ${tenantId}, true)`)
    return fn(tx as unknown as Db)
  })
}

export { schema }
