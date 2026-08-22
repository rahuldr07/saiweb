import { Banner, Btn, Card, Label } from '@/components/ui'
import { useUi } from '@/state/ui'
import { useCompany, setProfile } from '@/state/company'
import { getDateFormat, setDateFormat, fmtDate, type DateFormat } from '@/lib/format'
import { now } from '@/lib/clock'
import { useState } from 'react'
import { exportEverything } from './exportAll'

/**
 * The workspace's own settings, and the two things you can do to the workspace
 * itself.
 *
 * The date format is the one setting here that changes every other screen, so
 * the hint shows today's date in the chosen format rather than describing it —
 * you pick the format by reading the result.
 */

const TIMEZONES = ['India Standard Time', 'Eastern', 'Central']

export function CompanyTab({ plan }: { plan: string }) {
  const { profile } = useCompany()
  const { openModal, closeModal, toast } = useUi()
  const [fmt, setFmt] = useState<DateFormat>(getDateFormat)

  const changeFormat = (v: DateFormat) => {
    setDateFormat(v)
    /* `setDateFormat` writes a module value that nothing subscribes to, so the
       local state is what re-renders this card — and with it the live example. */
    setFmt(v)
  }

  const runExport = () => {
    const files = exportEverything()
    toast(`${files.length} files — orders, clients, staff, invoices, county coverage`)
    return files
  }

  /* Deliberately awkward: the name has to be typed. A workspace closing is the
     one action here that nobody can undo for you. */
  const confirmClose = () =>
    openModal({
      title: `Close ${profile.name}?`,
      body: <CloseWorkspace name={profile.name} onCancel={closeModal} onExport={runExport} />,
    })

  return (
    <div className="two">
      <Card padded>
        <Label>Company</Label>
        <div className="frm">
          <div className="fld">
            <label htmlFor="co-n">Name</label>
            <input
              className="inp"
              id="co-n"
              defaultValue={profile.name}
              key={`n-${profile.name}`}
              onBlur={(e) => setProfile('name', e.target.value)}
            />
          </div>
          <div className="fld">
            <label htmlFor="co-s">Home state</label>
            <input
              className="inp"
              id="co-s"
              defaultValue={profile.state}
              key={`s-${profile.state}`}
              onBlur={(e) => setProfile('state', e.target.value)}
            />
          </div>
          <div className="fld">
            <label htmlFor="co-tz">Operating timezone</label>
            <select
              className="inp"
              id="co-tz"
              value={profile.tz}
              onChange={(e) => setProfile('tz', e.target.value)}
            >
              {TIMEZONES.map((x) => (
                <option key={x} value={x}>
                  {x}
                </option>
              ))}
            </select>
            <div className="hint">
              Where your team sits. Client deadlines are set under Turnaround &amp; SLA.
            </div>
          </div>
          <div className="fld">
            <label htmlFor="co-df">Date format</label>
            <select
              className="inp"
              id="co-df"
              value={fmt}
              onChange={(e) => changeFormat(e.target.value as DateFormat)}
            >
              <option value="MM/DD/YYYY">MM/DD/YYYY (US)</option>
              <option value="DD/MM/YYYY">DD/MM/YYYY</option>
            </select>
            <div className="hint">
              Every screen and export — today reads <b className="mono">{fmtDate(now())}</b>.
            </div>
          </div>
          <div className="fld">
            <label>Plan</label>
            <div className="ro">{plan}</div>
          </div>
        </div>
      </Card>

      <Card padded>
        <Label>Your data</Label>
        <div className="rows" style={{ border: 'none', borderRadius: 0, marginTop: 4 }}>
          <div className="rw">
            <span className="gr">↓</span>
            <span>
              <b>Export everything</b>
              <div className="sd">Orders, clients, invoices, documents and quality history.</div>
            </span>
            <span>
              <Btn variant="ghost" small onClick={runExport}>
                Export
              </Btn>
            </span>
          </div>
          <div className="rw">
            <span className="bad">⚠</span>
            <span>
              <b>Close this workspace</b>
              <div className="sd">Export first — this removes access for everyone.</div>
            </span>
            <span>
              <Btn variant="danger" small onClick={confirmClose}>
                Close
              </Btn>
            </span>
          </div>
        </div>
      </Card>
    </div>
  )
}

/** The confirmation. Typing the name is the point, not a formality. */
function CloseWorkspace({
  name,
  onCancel,
  onExport,
}: {
  name: string
  onCancel: () => void
  onExport: () => unknown[]
}) {
  const [typed, setTyped] = useState('')
  const [error, setError] = useState<string | null>(null)
  const matches = typed.trim() === name

  return (
    <>
      <Banner kind="d" icon="⚠" title={`Every user in ${name} loses access immediately`}>
        Export first. Once this is done there is nothing to come back to.
      </Banner>

      <div className="fld" style={{ marginTop: 14 }}>
        <label htmlFor="cw-n">Type {name} to confirm</label>
        <input
          className="inp"
          id="cw-n"
          autoComplete="off"
          placeholder={name}
          value={typed}
          onChange={(e) => {
            setTyped(e.target.value)
            setError(null)
          }}
        />
      </div>

      {error ? (
        <Banner kind="r" icon="⚠" style={{ margin: '12px 0 0' }}>
          {error}
        </Banner>
      ) : null}

      <div style={{ display: 'flex', gap: 9, justifyContent: 'flex-end', marginTop: 18 }}>
        <Btn variant="ghost" onClick={onCancel}>
          Cancel
        </Btn>
        <Btn variant="ghost" onClick={onExport}>
          Export everything
        </Btn>
        <Btn
          variant="danger"
          onClick={() => {
            if (!matches) {
              setError('The name does not match. This is deliberately awkward.')
              return
            }
            setError(
              'Closing a workspace needs the server — this build has no way to revoke access, and pretending otherwise would be the one thing this dialog must not do.',
            )
          }}
        >
          Close the workspace
        </Btn>
      </div>
    </>
  )
}
