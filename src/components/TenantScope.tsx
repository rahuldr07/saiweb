import type { ReactNode } from 'react'
import { useSession } from '@/state/session'
import { Btn, Card, Empty, PageHead } from './ui'
import { TENANTS } from '@/data/org'

/**
 * Which company's records the bundled seed data actually is.
 *
 * All of it — the orders, the people, the counties, the invoices — belongs to
 * one company. The addresses are Pennsylvania, the email addresses are at
 * keystoneabstract.com. It was never three companies' data.
 */
export const SEEDED_TENANT = TENANTS[0].id

/**
 * Stops the seed build showing one company's records under another's name.
 *
 * Switching workspace used to change the sidebar, the tint and the page subtitle
 * and then hand back the same eight orders, which reads as three companies that
 * happen to be identical. They are not identical; two of them simply have
 * nothing seeded. Saying so is the honest render, and it is also the safe one —
 * an empty register cannot leak the other company's rows.
 *
 * This applies only to the seed build. Once the API answers, scoping is the
 * database's job: every table carries `tenant_id` and the policies in
 * `server/db/rls.sql` enforce it, so a workspace with no rows returns none
 * without the client deciding anything.
 */
export function TenantScope({ children }: { children: ReactNode }) {
  const { tenant, authority, switchTenant } = useSession()

  if (authority === 'server' || tenant.id === SEEDED_TENANT) return <>{children}</>

  const seeded = TENANTS.find((t) => t.id === SEEDED_TENANT)

  return (
    <>
      <PageHead title={tenant.name} sub={`${tenant.plan} · ${tenant.state}`} />
      <Card>
        <Empty
          icon="◫"
          action={
            <Btn small onClick={() => switchTenant(SEEDED_TENANT)}>
              Switch to {seeded?.name}
            </Btn>
          }
        >
          Nothing is seeded for {tenant.name}. The demonstration data belongs to {seeded?.name}, and showing
          it here would present one company's orders, people and invoices as another's. Connect the database
          and this workspace fills from its own rows.
        </Empty>
      </Card>
    </>
  )
}
