import { Btn, Card, CardHead, SecHead } from '@/components/ui'
import { useUi } from '@/state/ui'
import { useRoles, usePerms, useStaff } from '@/state/company'
import { RoleForm, RoleDelete } from './forms/RoleForm'
import { PermsManager, type PermView } from './forms/PermsForm'
import { csvName, downloadCSV } from '@/lib/csv'

/**
 * What each role can do, and who holds it.
 *
 * The flagged row is the point of the matrix: one permission no role can hold,
 * because a blocking rule that somebody can be granted their way around is not a
 * blocking rule. It is shown rather than hidden so the absence is deliberate.
 */
export function RolesTab({
  tenantName,
  isAdmin,
  onOpenStaff,
}: {
  tenantName: string
  isAdmin: boolean
  onOpenStaff: () => void
}) {
  const { openModal, closeModal, toast } = useUi()
  const ROLELIST = useRoles()
  const PERMS = usePerms()
  const STAFF = useStaff()
  const holders = (id: string) => STAFF.filter((s) => s.r === id && s.active !== false)

  const exportRoles = () =>
    downloadCSV(csvName('roles'), [
      ['Permission', 'Key', ...ROLELIST.map((r) => r.n)],
      ...PERMS.map((p) => [p.n, p.k, ...ROLELIST.map((r) => (r.p.includes(p.k) ? 'yes' : 'no'))]),
      [],
      ['Role', 'Description', 'People', 'Holders'],
      ...ROLELIST.map((r) => [
        r.n,
        r.desc ?? '',
        holders(r.id).length,
        holders(r.id).map((s) => s.n).join(', '),
      ]),
    ])

  const managePerms = (view: PermView = { at: 'list' }): void => {
    const named = view.at !== 'list' && view.k ? PERMS.find((p) => p.k === view.k)?.n : null
    openModal({
      title:
        view.at === 'confirm'
          ? `Remove “${named ?? ''}”?`
          : view.at === 'edit'
            ? named
              ? `Edit “${named}”`
              : 'Add a permission'
            : 'Permissions',
      body: (
        <PermsManager
          view={view}
          onView={managePerms}
          onClose={closeModal}
          onDone={toast}
        />
      ),
    })
  }

  const editRole = (id?: string) =>
    openModal({
      title: id ? `Edit ${ROLELIST.find((r) => r.id === id)?.n ?? ''}` : 'Add a role',
      body: (
        <RoleForm
          id={id}
          isAdmin={isAdmin}
          onCancel={closeModal}
          onManagePerms={() => managePerms()}
          onRemove={(x) => confirmRemove(x)}
          onDone={(m) => { closeModal(); toast(m) }}
        />
      ),
    })

  const confirmRemove = (id: string) =>
    openModal({
      title: `Remove ${ROLELIST.find((r) => r.id === id)?.n ?? ''}?`,
      body: (
        <RoleDelete
          id={id}
          onCancel={() => editRole(id)}
          onDone={(m) => { closeModal(); toast(m) }}
        />
      ),
    })

  return (
    <>
      <SecHead
        sub={`What each role can do, and who holds it. ${ROLELIST.length} roles in ${tenantName}.`}
        actions={
          <>
            {isAdmin ? (
              <Btn
                variant="ghost"
                onClick={() => managePerms()}
              >
                Permissions
              </Btn>
            ) : null}
            <Btn
              variant="ghost"
              onClick={() => {
                const out = exportRoles()
                toast(`${out.name} — ${PERMS.length} permissions, ${ROLELIST.length} roles`)
              }}
            >
              Export
            </Btn>
            <Btn variant="ghost" onClick={onOpenStaff}>
              Staff
            </Btn>
            <Btn onClick={() => editRole()}>＋ Add role</Btn>
          </>
        }
      />

      <Card>
        <div className="tsc">
          <table className="mat" style={{ minWidth: 380 + ROLELIST.length * 110 }}>
            <thead>
              <tr>
                <th style={{ minWidth: 240 }}>Permission</th>
                {ROLELIST.map((r) => (
                  <th key={r.id} style={{ textAlign: 'center', minWidth: 100 }}>
                    <button
                      type="button"
                      style={{ font: 'inherit', color: 'inherit' }}
                      title={`Edit ${r.n}`}
                      onClick={() => editRole(r.id)}
                    >
                      {r.n}
                    </button>
                    <div
                      className="sd gr"
                      style={{
                        fontWeight: 400,
                        textTransform: 'none',
                        letterSpacing: 0,
                        fontSize: '10.5px',
                      }}
                    >
                      {holders(r.id).length}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PERMS.map((p) => (
                <tr key={p.k} style={p.never ? { background: 'var(--flag)' } : undefined}>
                  <td>
                    {p.n}
                    {p.never ? (
                      <div className="sd gr" style={{ fontSize: '11.5px' }}>
                        No role can hold this. A blocking rule is not configurable away.
                      </div>
                    ) : p.sys ? null : (
                      <div className="sd gr" style={{ fontSize: '11.5px' }}>
                        Added here — a label, not yet wired to anything
                      </div>
                    )}
                  </td>
                  {ROLELIST.map((r) => (
                    <td
                      key={r.id}
                      style={{ textAlign: 'center' }}
                      className={r.p.includes(p.k) ? 'ok' : 'gr'}
                    >
                      {r.p.includes(p.k) ? '✓' : '·'}
                    </td>
                  ))}
                </tr>
              ))}
              <tr>
                <td className="gr" style={{ fontSize: '11.5px' }}>
                  —
                </td>
                {ROLELIST.map((r) => (
                  <td key={r.id} style={{ textAlign: 'center' }}>
                    <Btn variant="ghost" small onClick={() => editRole(r.id)}>
                      Edit
                    </Btn>
                    {r.lock ? (
                      <div className="sd gr" style={{ fontSize: '10.5px', marginTop: 3 }}>
                        cannot be deleted
                      </div>
                    ) : null}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      <Card style={{ marginTop: 18 }}>
        <CardHead title="Who holds each role" />
        <div className="rows" style={{ border: 'none', borderRadius: 0 }}>
          {ROLELIST.map((r) => {
            const list = holders(r.id)
            return (
              <div className="rw" key={r.id}>
                <span className="br">{list.length}</span>
                <span>
                  <b>{r.n}</b>
                  <div className="sd">{r.desc}</div>
                  {list.length ? (
                    <div className="sd" style={{ marginTop: 4 }}>
                      {list.map((s) => s.n).join(', ')}
                    </div>
                  ) : (
                    <div className="sd gr">nobody holds this role</div>
                  )}
                </span>
                <span>
                  <Btn variant="ghost" small onClick={() => editRole(r.id)}>
                    Edit
                  </Btn>
                </span>
              </div>
            )
          })}
        </div>
      </Card>

      <p className="gr" style={{ fontSize: '12.5px', marginTop: 12 }}>
        <b>Staff</b> and <b>Company admin</b> can be renamed and adjusted like any other role, but
        not deleted — every workspace needs a floor and a ceiling. Add as many roles in between as
        you need, and you can create one without leaving the staff form.
      </p>
    </>
  )
}
