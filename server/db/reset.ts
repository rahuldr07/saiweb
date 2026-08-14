/**
 * Empties every table without touching the schema.
 *
 *   npm run db:reset && npm run db:seed
 *
 * Runs as the owner, which holds BYPASSRLS — the policies would otherwise scope
 * the truncate to the workspace you happen to be inside, which is not what
 * "reset" means. Used by the integration tests to get a known starting point.
 */
import { sql } from 'drizzle-orm'
import { createDb } from './connect'

const url = process.env.DATABASE_URL
if (!url) throw new Error('DATABASE_URL is not set — the reset runs as the owning role.')

const { db, queryClient } = createDb(url, 1)

async function main() {
  const rows = Array.from(
    await db.execute<{ tablename: string }>(sql`
      select c.relname as tablename
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relkind = 'r'
        and c.relname <> '__drizzle_migrations'
      order by 1
    `),
  )

  if (!rows.length) {
    console.log('nothing to reset — run npm run db:push first')
    return
  }

  /* One statement so the foreign keys never see a half-empty database. */
  const list = rows.map((r) => `"${r.tablename}"`).join(', ')
  await db.execute(sql.raw(`truncate table ${list} restart identity cascade`))
  console.log(`reset ${rows.length} tables`)
}

main()
  .then(() => queryClient.end({ timeout: 5 }))
  .then(() => process.exit(0))
  .catch(async (e) => {
    console.error(e instanceof Error ? e.message : e)
    await queryClient.end({ timeout: 5 }).catch(() => {})
    process.exit(1)
  })
