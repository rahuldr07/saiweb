import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Banner, Btn, SecHead } from '@/components/ui'
import { DataTable, type DataRow } from '@/components/DataTable'
import { useNotBuilt } from '@/components/notBuilt'
import { useUi } from '@/state/ui'
import { StaffForm, StaffDelete } from './forms/StaffForm'
import { RoleForm } from './forms/RoleForm'
import { useStaff } from '@/state/company'
import type { Person } from '@/data/types'
import { AVAIL } from '@/data/people'
import { board } from '@/lib/engine'
import { roleName } from '@/lib/permissions'
import { csvName, downloadCSV } from '@/lib/csv'

/**
 * The roster.
 *
 * Target is today's load against the daily maximum, not the maximum alone —
 * a capacity figure with nothing measured against it says nothing about whether
 * anyone is close to it.
 */
export function StaffTab({ tenantName, onOpenRoles }: { tenantName: string; onOpenRoles: () => void }) {
  const navigate = useNavigate()
  const notBuilt = useNotBuilt()
  const { openModal, closeModal, toast } = useUi()
  const { run } = board()
  const STAFF = useStaff()
  const [showOff, setShowOff] = useState(false)

  /* Editing somebody, and stepping out to create a role without losing what has
     already been typed — the design's one genuinely two-step flow. */
  const editStaff = (id?: string, draft?: Partial<Person> | null) =>
    openModal({
      title: id ? `Edit ${STAFF.find((s) => s.id === id)?.n ?? ''}` : 'Add staff',
      body: (
        <StaffForm
          id={id}
          draft={draft}
          onCancel={closeModal}
          onDone={(m) => {
            closeModal()
            toast(m)
          }}
          onRemove={(rid) => confirmRemove(rid)}
          onNewRole={(typed) => newRoleFor(id, typed)}
        />
      ),
    })

  const confirmRemove = (id: string) =>
    openModal({
      title: `Remove ${STAFF.find((s) => s.id === id)?.n ?? ''}?`,
      body: (
        <StaffDelete
          id={id}
          onCancel={() => editStaff(id)}
          onDone={(m) => {
            closeModal()
            toast(m)
          }}
        />
      ),
    })

  const newRoleFor = (id: string | undefined, typed: Partial<Person>) =>
    openModal({
      title: 'Add a role',
      body: (
        <RoleForm
          isAdmin
          onCancel={() => editStaff(id, typed)}
          onManagePerms={() => editStaff(id, typed)}
          onRemove={() => editStaff(id, typed)}
          onDone={(m, roleId) => {
            toast(m)
            /* Straight back to the staff form, with the new role already chosen
               and nothing that was typed lost. */
            editStaff(id, { ...typed, r: roleId })
          }}
        />
      ),
    })

  const list = STAFF.filter((s) => showOff || s.active !== false)
  const off = STAFF.filter((s) => s.active === false).length
  /* Someone in a stage and its own QC. Assignment refuses it per order, but the
     pairing existing at all is a decision somebody should make deliberately. */
  const clash = STAFF.filter((s) => s.conflict && s.active !== false)

  const exportStaff = () =>
    downloadCSV(csvName('staff'), [
      ['Name', 'Email', 'Departments', 'Role', 'Today', 'Target', 'Availability', 'Active'],
      ...list.map((s) => [
        s.n,
        s.e ?? '',
        s.dep.join(' / '),
        roleName(s.r),
        run.load[s.id] ?? 0,
        s.cap,
        AVAIL[s.avail][0],
        s.active === false ? 'no' : 'yes',
      ]),
    ])

  const rows: DataRow[] = list.map((s) => ({
    id: s.id,
    onClick: () => navigate({ to: '/staff/$personId', params: { personId: s.id } }),
    search: `${s.n} ${s.e ?? ''} ${s.dep.join(' ')}`,
    c: [
      {
        v: s.n,
        s: s.active === false ? 'disabled' : s.conflict ? 'in a stage and its own QC' : '',
      },
      { v: s.e || '—', mono: true },
      { v: s.dep.join(', ') || '—' },
      { v: roleName(s.r), chip: s.r === 'admin' ? 'b' : s.r === 'staff' ? 'n' : 'r' },
      { v: s.cap ? `${run.load[s.id] ?? 0} / ${s.cap}` : '—', mono: true },
      {
        v: s.active === false ? 'Disabled' : AVAIL[s.avail][0],
        chip: s.active === false ? 'n' : AVAIL[s.avail][1],
      },
      {
        raw: (
          <Btn
            variant="ghost"
            small
            aria-label={`Edit ${s.n}`}
            onClick={(e) => {
              e.stopPropagation()
              editStaff(s.id)
            }}
          >
            Edit
          </Btn>
        ),
      },
    ],
  }))

  return (
    <>
      <SecHead
        sub={`${list.length} ${showOff ? 'total' : 'active'} in ${tenantName}${
          off && !showOff ? ` · ${off} disabled` : ''
        }.`}
        actions={
          <>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: '12.5px',
                color: 'var(--gr)',
              }}
            >
              <input
                type="checkbox"
                checked={showOff}
                onChange={(e) => setShowOff(e.target.checked)}
              />{' '}
              Show disabled
            </label>
            <Btn variant="ghost" onClick={onOpenRoles}>
              Roles
            </Btn>
            <Btn
              variant="ghost"
              onClick={() => notBuilt('Bulk import', 'a file picker and a column mapper', exportStaff)}
            >
              Bulk import
            </Btn>
            <Btn onClick={() => editStaff()}>＋ Add staff</Btn>
          </>
        }
      />

      {clash.length ? (
        <Banner
          kind="r"
          icon="⚖"
          title={`${
            clash.length === 1 ? `${clash[0].n} sits` : `${clash.length} people sit`
          } in both Typing and Typing QC`}
          actions={
            <Btn variant="ghost" small onClick={() => navigate({ to: '/reports' })}>
              Review rule
            </Btn>
          }
        >
          They can be assigned to type an order and to QC that same typing. Assignment blocks it per
          order, but it is worth deciding whether the pairing should exist at all.
        </Banner>
      ) : null}

      <DataTable
        noun="people"
        total={list.length}
        min={1000}
        search="Search name, email or department"
        cols={[
          { l: 'Name', w: 180, f: 1.2 },
          { l: 'Email', w: 210, f: 1.2 },
          { l: 'Departments', w: 200, f: 1.2 },
          { l: 'Role', w: 100 },
          { l: 'Target', w: 90 },
          { l: 'Today', w: 120 },
          { l: '', w: 80 },
        ]}
        rows={rows}
        emptyText="Nobody matches that."
      />

      <p className="gr" style={{ fontSize: '12.5px', marginTop: 12 }}>
        Target is today’s load against the daily maximum. Adding or disabling someone re-runs the
        day, so capacity and assignment follow immediately.
      </p>
    </>
  )
}
