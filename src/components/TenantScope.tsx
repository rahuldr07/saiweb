import type { ReactNode } from 'react'
import { useSession } from '@/state/session'
import { Btn, Card, Empty, PageHead } from './ui'
import { TENANTS } from '@/data/org'

export const SEEDED_TENANT = TENANTS[0].id

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
