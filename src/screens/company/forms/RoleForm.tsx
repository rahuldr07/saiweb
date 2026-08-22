import { useState } from 'react'
import { Banner, Btn, Label } from '@/components/ui'
import { ADMIN_FLOOR, removeRole, saveRole, usePerms, useRoles, useStaff } from '@/state/company'

/**
 * A role, and what it can do.
 *
 * Two guards are structural rather than stylistic. The permission nobody may
 * hold stays visible but unticakable, so its absence is deliberate; and the admin
 * role keeps the floor it needs to administer, because a workspace that can lock
 * itself out of its own settings has no way back in.
 */
export function RoleForm({
  id,
  onCancel,
  onDone,
  onRemove,
  onManagePerms,
  isAdmin,
}: {
  id?: string
  onCancel: () => void
  onDone: (message: string, roleId: string) => void
  onRemove: (id: string) => void
  onManagePerms: () => void
  isAdmin: boolean
}) {
  const roles = useRoles()
  const perms = usePerms()
  const staff = useStaff()

  const r = roles.find((x) => x.id === id)
  const [n, setN] = useState(r?.n ?? '')
  const [desc, setDesc] = useState(r?.desc ?? '')
  const [picked, setPicked] = useState<string[]>(r?.p ?? ['own'])
  const [error, setError] = useState<string | null>(null)

  const held = id ? staff.filter((s) => s.r === id && s.active !== false).length : 0

  const toggle = (k: string, on: boolean) => {
    setPicked((p) => (on ? [...new Set([...p, k])] : p.filter((x) => x !== k)))
    setError(null)
  }

  const submit = () => {
    const name = n.trim()
    if (!name) return setError('A name is required.')
    if (roles.some((x) => x.id !== id && x.n.toLowerCase() === name.toLowerCase()))
      return setError(`There is already a role called ${name}.`)
    if (!picked.length)
      return setError('A role that can do nothing is not much use — pick at least one permission.')
    const made = saveRole({ n: name, desc: desc.trim(), p: [...picked], lock: r?.lock }, id)
    onDone(id ? `${name} saved` : `${name} added`, made)
  }

  return (
    <>
      {error ? (
        <Banner kind="d" icon="⚑" style={{ marginBottom: 14 }}>
          {error}
        </Banner>
      ) : null}

      <div className="frm">
        <div className="fld">
          <label htmlFor="r-n">Name</label>
          <input
            className="inp"
            id="r-n"
            placeholder="e.g. Billing clerk"
            autoComplete="off"
            value={n}
            onChange={(e) => {
              setN(e.target.value)
              setError(null)
            }}
          />
          {r?.lock ? <div className="hint">Call it whatever suits you. It cannot be deleted.</div> : null}
        </div>
        <div className="fld">
          <label htmlFor="r-d">What it is for</label>
          <input
            className="inp"
            id="r-d"
            placeholder="One line"
            autoComplete="off"
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
          />
        </div>
      </div>

      <div style={{ marginTop: 18 }}>
        <Label>What this role can do</Label>
      </div>
      <div style={{ display: 'grid', gap: 7 }}>
        {perms.map((p) => {
          const on = picked.includes(p.k)
          const block = !!p.never
          const floor = id === 'admin' && ADMIN_FLOOR.includes(p.k)
          return (
            <label
              key={p.k}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10,
                fontSize: '13.5px',
                padding: '9px 12px',
                border: `1px solid ${block ? 'var(--flagline)' : 'var(--hair)'}`,
                borderRadius: 9,
                background: block ? 'var(--flag)' : on ? 'var(--tint)' : 'var(--card)',
                ...(block ? { opacity: 0.75 } : {}),
              }}
            >
              <input
                type="checkbox"
                checked={on && !block}
                disabled={block || floor}
                style={{ marginTop: 2 }}
                onChange={(e) => toggle(p.k, e.target.checked)}
              />
              <span>
                <b>{p.n}</b>
                {block ? (
                  <div className="sd gr" style={{ fontSize: '11.5px' }}>
                    Not available to any role, by design.
                  </div>
                ) : floor ? (
                  <div className="sd gr" style={{ fontSize: '11.5px' }}>
                    The admin role keeps this — someone has to be able to administer.
                  </div>
                ) : p.sys ? null : (
                  <div className="sd gr" style={{ fontSize: '11.5px' }}>
                    Your own permission
                  </div>
                )}
              </span>
            </label>
          )
        })}
      </div>

      {isAdmin ? (
        <Btn variant="ghost" small style={{ marginTop: 12 }} onClick={onManagePerms}>
          Manage permissions
        </Btn>
      ) : null}

      {r?.lock ? (
        <Banner
          kind="b"
          icon="🔒"
          title={<span style={{ fontSize: '12.5px' }}>This role’s name is fixed</span>}
          style={{ margin: '16px 0 0' }}
        >
          <span style={{ fontSize: '12.5px' }}>
            Staff is the floor and Company admin the ceiling — every workspace needs both. You can
            still adjust what they can do, within reason.
          </span>
        </Banner>
      ) : null}

      {held ? (
        <Banner kind="r" icon="◔" style={{ margin: '16px 0 0' }}>
          <span style={{ fontSize: '12.5px' }}>
            <b>
              {held} {held === 1 ? 'person holds' : 'people hold'} this role.
            </b>{' '}
            A change applies to all of them at once.
          </span>
        </Banner>
      ) : null}

      <div style={{ display: 'flex', gap: 9, justifyContent: 'flex-end', marginTop: 18 }}>
        <Btn variant="ghost" onClick={onCancel}>
          Cancel
        </Btn>
        {id && !r?.lock ? (
          <Btn variant="danger" onClick={() => onRemove(id)}>
            Remove
          </Btn>
        ) : null}
        <Btn onClick={submit}>{id ? 'Save role' : 'Add role'}</Btn>
      </div>
    </>
  )
}

/** Removing a role. Its holders drop to Staff rather than to nothing. */
export function RoleDelete({
  id,
  onCancel,
  onDone,
}: {
  id: string
  onCancel: () => void
  onDone: (message: string) => void
}) {
  const roles = useRoles()
  const staff = useStaff()
  const r = roles.find((x) => x.id === id)
  if (!r || r.lock) return null
  const held = staff.filter((s) => s.r === id)

  return (
    <>
      <p style={{ fontSize: '13.5px' }}>
        {held.length ? (
          <>
            <b>
              {held.length} {held.length === 1 ? 'person' : 'people'}
            </b>{' '}
            — {held.map((s) => s.n).join(', ')} — will drop back to <b>Staff</b>.
          </>
        ) : (
          'Nobody holds this role.'
        )}
      </p>
      <div style={{ display: 'flex', gap: 9, justifyContent: 'flex-end', marginTop: 18 }}>
        <Btn variant="ghost" onClick={onCancel}>
          Cancel
        </Btn>
        <Btn
          variant="danger"
          onClick={() => {
            removeRole(id)
            onDone(`${r.n} removed`)
          }}
        >
          Remove {r.n}
        </Btn>
      </div>
    </>
  )
}
