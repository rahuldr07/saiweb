import { useState } from 'react'
import { useSearch } from '@tanstack/react-router'
import { PageHead, Tabs } from '@/components/ui'
import { RequireCap } from '@/components/RequireCap'
import { ErrorBoundary } from '@/components/async'
import { useSession } from '@/state/session'
import { useCompany } from '@/state/company'
import { COTABS } from '@/data/org'
import { CompanyTab } from './company/CompanyTab'
import { StaffTab } from './company/StaffTab'
import { ClientsTab } from './company/ClientsTab'
import { DepartmentsTab } from './company/DepartmentsTab'
import { RolesTab } from './company/RolesTab'
import { WorkflowTab } from './company/WorkflowTab'
import { SlaTab } from './company/SlaTab'
import { PayrollTab } from './company/PayrollTab'

/** Tenant settings: profile, people, clients, departments, roles and turnaround. */
function Company() {
  const { tenant, can } = useSession()
  /* The name shown is the one this screen's own form edits, or renaming it here
     would leave the title arguing with the field directly under it. */
  const { profile } = useCompany()

  const search = useSearch({ from: '/company' })

  /* The tab can be named in the URL so another screen can point at the setting
     it is talking about, rather than saying "it is somewhere under Company". */
  const [tab, setTab] = useState<string>(() =>
    search.tab && COTABS.includes(search.tab) ? search.tab : COTABS[0],
  )

  return (
    <>
      <PageHead
        title="Company"
        sub={`Everything that defines how ${profile.name} runs.`}
      />

      <Tabs tabs={COTABS} value={tab} onChange={setTab} />

      {tab === 'Company' ? <CompanyTab plan={tenant.plan} /> : null}

      {tab === 'Staff' ? (
        <StaffTab tenantName={profile.name} onOpenRoles={() => setTab('Roles')} />
      ) : null}

      {tab === 'Clients' ? <ClientsTab /> : null}

      {tab === 'Departments' ? <DepartmentsTab onOpenStaff={() => setTab('Staff')} /> : null}

      {tab === 'Roles' ? (
        <RolesTab tenantName={profile.name} isAdmin={can('all')} onOpenStaff={() => setTab('Staff')} />
      ) : null}

      {tab === 'Workflow' ? <WorkflowTab /> : null}

      {tab === 'Turnaround & SLA' ? <SlaTab initialSub={search.sub} /> : null}

      {tab === 'Payroll' ? <PayrollTab /> : null}
    </>
  )
}

export default function CompanyRoute() {
  return (
    <RequireCap cap="people">
      <ErrorBoundary what="Company">
        <Company />
      </ErrorBoundary>
    </RequireCap>
  )
}
