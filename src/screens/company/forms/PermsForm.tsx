import { useState } from 'react'
import { Banner, Btn, Chip, Rows } from '@/components/ui'
import { removePerm, savePerm, usePerms, useRoles } from '@/state/company'

/**
 * The permission vocabulary.
 *
 * The built-in ones are wired to real behaviour, so they can be reworded but not
 * deleted. One you add is a label you can tick against roles — it records intent
 * and gates nothing until that behaviour exists, which the form says plainly
 * rather than letting somebody assume otherwise.
 */

export type PermView = { at: 'list' } | { at: 'edit'; k?: string } | { at: 'confirm'; k: string }

export function PermsManager({
  view,
  onView,
  onClose,
  onDone,
}: {
  view: PermView
  onView: (v: PermView) => void
  onClose: () => void
  onDone: (message: string) => void
}) {
  const perms = usePerms()
  const roles = useRoles()
  const usage = (k: string) => roles.filter((r) => r.p.includes(k)).map((r) => r.n)

  if (view.at === 'edit') {
    return <EditPerm k={view.k} onView={onView} onDone={onDone} />
  }

  if (view.at === 'confirm') {
    const p = perms.find((x) => x.k === view.k)
    if (!p || p.sys) return null
    const held = usage(p.k)
    return (
      <>
        <p style={{ fontSize: '13.5px' }}>
          {held.length ? (
            <>
              It is ticked on <b>{held.join(', ')}</b> and will come off{' '}
              {held.length === 1 ? 'that role' : 'those roles'}.
            </>
          ) : (
            'No role has it ticked.'
          )}
        </p>
        <div style={{ display: 'flex', gap: 9, justifyContent: 'flex-end', marginTop: 18 }}>
          <Btn variant="ghost" onClick={() => onView({ at: 'list' })}>
            Cancel
          </Btn>
          <Btn
            variant="danger"
            onClick={() => {
              removePerm(p.k)
              onView({ at: 'list' })
              onDone(`“${p.n}” removed`)
            }}
          >
            Remove
          </Btn>
        </div>
      </>
    )
  }

  return (
    <>
      <p className="gr" style={{ fontSize: '12.5px', marginBottom: 14 }}>
        The built-in ones are wired to real behaviour — turning one off actually stops the thing
        happening. You can rename any of them, and add your own on top.
      </p>
      <Rows>
        {perms.map((p) => {
          const held = usage(p.k)
          return (
            <div className="rw" key={p.k} style={{ gridTemplateColumns: '1fr auto' }}>
              <span>
                <b>{p.n}</b>
                {p.sys ? <Chip kind="n">Built in</Chip> : <Chip kind="b">Yours</Chip>}
                {p.never ? <Chip kind="d">Never granted</Chip> : null}
                <div className="sd">{held.length ? `Held by ${held.join(', ')}` : 'Held by nobody'}</div>
              </span>
              <span>
                <Btn variant="ghost" small onClick={() => onView({ at: 'edit', k: p.k })}>
                  Edit
                </Btn>
              </span>
            </div>
          )
        })}
      </Rows>
      <div style={{ display: 'flex', gap: 9, justifyContent: 'flex-end', marginTop: 18 }}>
        <Btn variant="ghost" onClick={onClose}>
          Close
        </Btn>
        <Btn onClick={() => onView({ at: 'edit' })}>＋ Add a permission</Btn>
      </div>
    </>
  )
}

function EditPerm({
  k,
  onView,
  onDone,
}: {
  k?: string
  onView: (v: PermView) => void
  onDone: (message: string) => void
}) {
  const perms = usePerms()
  const roles = useRoles()
  const p = perms.find((x) => x.k === k)
  const [n, setN] = useState(p?.n ?? '')
  const [error, setError] = useState<string | null>(null)
  const held = k ? roles.filter((r) => r.p.includes(k)).map((r) => r.n) : []

  const submit = () => {
    const wording = n.trim()
    if (!wording) return setError('Some wording is required.')
    if (perms.some((x) => x.k !== k && x.n.toLowerCase() === wording.toLowerCase()))
      return setError(`There is already a permission worded “${wording}”.`)
    savePerm(wording, k)
    onView({ at: 'list' })
    onDone(k ? `“${wording}” saved` : `“${wording}” added`)
  }

  return (
    <>
      {error ? (
        <Banner kind="d" icon="⚠" style={{ marginBottom: 14 }}>
          {error}
        </Banner>
      ) : null}

      <div className="frm">
        <div className="fld" style={{ gridColumn: '1/-1' }}>
          <label htmlFor="pm-n">Wording</label>
          <input
            className="inp"
            id="pm-n"
            placeholder="e.g. Approve a rush order"
            autoComplete="off"
            value={n}
            onChange={(e) => {
              setN(e.target.value)
              setError(null)
            }}
          />
          <div className="hint">
            {p?.sys
              ? 'Renaming changes how it reads everywhere. What it controls stays the same.'
              : 'Shown on the roles matrix and in the role editor.'}
          </div>
        </div>
      </div>

      {p?.never ? (
        <Banner
          kind="r"
          icon="🔒"
          title={<span style={{ fontSize: '12.5px' }}>This one can never be granted</span>}
          style={{ margin: '16px 0 0' }}
        >
          <span style={{ fontSize: '12.5px' }}>
            It sits on the matrix so its absence is visible rather than merely missing.
          </span>
        </Banner>
      ) : p?.sys ? (
        <Banner
          kind="b"
          icon="⚙"
          title={<span style={{ fontSize: '12.5px' }}>Built in</span>}
          style={{ margin: '16px 0 0' }}
        >
          <span style={{ fontSize: '12.5px' }}>
            Wired to real behaviour, so it can be renamed but not deleted.{' '}
            {held.length ? `Held by ${held.join(', ')}.` : 'Held by nobody.'}
          </span>
        </Banner>
      ) : (
        <Banner
          kind="b"
          icon="◔"
          title={<span style={{ fontSize: '12.5px' }}>Your own permission</span>}
          style={{ margin: '16px 0 0' }}
        >
          <span style={{ fontSize: '12.5px' }}>
            A permission you add is a label you can tick against roles. It records intent — it will
            not gate anything until that behaviour is built.
          </span>
        </Banner>
      )}

      <div style={{ display: 'flex', gap: 9, justifyContent: 'flex-end', marginTop: 18 }}>
        <Btn variant="ghost" onClick={() => onView({ at: 'list' })}>
          Back
        </Btn>
        {k && !p?.sys ? (
          <Btn variant="danger" onClick={() => onView({ at: 'confirm', k })}>
            Remove
          </Btn>
        ) : null}
        <Btn onClick={submit}>{k ? 'Save' : 'Add permission'}</Btn>
      </div>
    </>
  )
}
