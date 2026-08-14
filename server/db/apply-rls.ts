/**
 * Applies `rls.sql`, and creates the application role it grants to.
 *
 *   npm run db:rls
 *
 * The role is created here rather than in the SQL file because its password
 * comes out of `APP_DATABASE_URL` — the same string the server connects with.
 * Deriving it from one place is the point: a role whose password has drifted
 * from the server's connection string fails at startup, but a role whose
 * *privileges* have drifted fails silently by letting every policy through.
 */
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { sql } from 'drizzle-orm'
import { createDb } from './connect'

const ownerUrl = process.env.DATABASE_URL
const appUrl = process.env.APP_DATABASE_URL

if (!ownerUrl || !appUrl) {
  throw new Error(
    'Both DATABASE_URL (the owner) and APP_DATABASE_URL (the application role) ' +
      'must be set — copy .env.example to .env and fill them in.',
  )
}

const parsed = new URL(appUrl)
const appRole = decodeURIComponent(parsed.username)
const appPassword = decodeURIComponent(parsed.password)

if (!appRole || !appPassword) {
  throw new Error(
    'APP_DATABASE_URL must include both a username and a password: the role is ' +
      'created with that password so the server can then connect as it.',
  )
}

const { db, queryClient } = createDb(ownerUrl, 1)

async function main() {
  const [{ is_super: isSuper, role: owner }] = Array.from(
    await db.execute<{ is_super: boolean; role: string }>(sql`
      select rolsuper as is_super, current_user::text as role
      from pg_roles where rolname = current_user
    `),
  )

  /* Creating a workspace means writing the row every policy scopes against, so
     the seed cannot run from inside a scope. BYPASSRLS is how Postgres says
     "this role provisions, it does not serve requests". */
  if (isSuper) {
    await db.execute(sql.raw(`alter role "${owner}" bypassrls`))
  } else {
    const [{ has }] = Array.from(
      await db.execute<{ has: boolean }>(sql`
        select rolbypassrls as has from pg_roles where rolname = current_user
      `),
    )
    if (!has) {
      console.warn(
        `! Role "${owner}" is neither a superuser nor holds BYPASSRLS.\n` +
          '  db:seed will be refused by the policies. Grant BYPASSRLS, or seed before running this.',
      )
    }
  }

  /* Idempotent: the script is expected to be re-run whenever the schema changes. */
  const exists = Array.from(
    await db.execute<{ one: number }>(
      sql`select 1 as one from pg_roles where rolname = ${appRole}`,
    ),
  ).length

  const verb = exists ? 'alter' : 'create'
  await db.execute(
    sql.raw(`${verb} role "${appRole}" login password '${appPassword.replace(/'/g, "''")}'`),
  )

  /* Belt and braces: if this role were ever made an owner or given BYPASSRLS,
     every policy below would stop applying without any visible symptom. */
  await db.execute(sql.raw(`alter role "${appRole}" nosuperuser nobypassrls nocreatedb nocreaterole`))
  console.log(`  ${verb === 'alter' ? 'updated' : 'created'} role ${appRole}`)

  const path = fileURLToPath(new URL('./rls.sql', import.meta.url))
  const script = await readFile(path, 'utf8').then((s) => s.replaceAll('app_user', appRole))
  await db.execute(sql.raw(script))
  console.log('  row-level security applied')

  /* Prove it took, rather than trusting that the script ran. */
  const unprotected = Array.from(
    await db.execute<{ tablename: string }>(sql`
      select c.relname as tablename
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relkind = 'r'
        and c.relname not in ('user', 'session', 'account', 'verification', '__drizzle_migrations')
        and not (c.relrowsecurity and c.relforcerowsecurity)
      order by 1
    `),
  )

  if (unprotected.length) {
    throw new Error(
      'These tables are not under FORCEd row-level security, so they would leak ' +
        `across workspaces: ${unprotected.map((r) => r.tablename).join(', ')}. ` +
        'Add them to the table list in rls.sql.',
    )
  }
  console.log('  every business table verified under FORCEd RLS')
}

main()
  .then(() => queryClient.end({ timeout: 5 }))
  .then(() => process.exit(0))
  .catch(async (e) => {
    console.error(e instanceof Error ? e.message : e)
    await queryClient.end({ timeout: 5 }).catch(() => {})
    process.exit(1)
  })
