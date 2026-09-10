import { useState } from 'react'
import { Banner, Btn, Chip, FormActions, Rows } from '@/components/ui'
import { BADSTATES } from '@/data/catalog'
import { isDuplicateName } from '@/lib/forms'
import {
  moveLinkType,
  removeLinkType,
  saveLinkType,
  typeUsage,
  useCoverage,
} from '@/state/counties'

export type LtView = { at: 'list' } | { at: 'edit'; k?: string } | { at: 'confirm'; k: string }

export function LinkTypes({
  view,
  onView,
  onClose,
}: {
  view: LtView
  onView: (v: LtView) => void
  onClose: () => void
}) {
  const { linkTypes, counties } = useCoverage()

  if (view.at === 'edit') {
    return <EditType k={view.k} onView={onView} />
  }

  if (view.at === 'confirm') {
    const t = linkTypes.find((x) => x.k === view.k)
    if (!t) return null
    const usage = typeUsage(t.k, BADSTATES)
    const last = linkTypes.length <= 1
    return (
      <>
        <p style={{ fontSize: 'var(--t-body)' }}>
          {usage.held ? (
            <>
              <b>
                {usage.held} {usage.held === 1 ? 'county has' : 'counties have'}
              </b>{' '}
              a {t.n} link on file. Removing the type discards{' '}
              {usage.held === 1 ? 'that address' : 'those addresses'}.
            </>
          ) : (
            'No county has one on file, so nothing is lost.'
          )}
        </p>
        {last ? (
          <Banner kind="d" icon="⚑" style={{ marginTop: 14 }}>
            This is the last link type. A county with no links is not much use.
          </Banner>
        ) : null}
        <FormActions>
          <Btn variant="ghost" onClick={() => onView({ at: 'list' })}>
            Cancel
          </Btn>
          <Btn
            variant="danger"
            disabled={last}
            onClick={() => {
              removeLinkType(t.k)
              onView({ at: 'list' })
            }}
          >
            Remove {t.n}
          </Btn>
        </FormActions>
      </>
    )
  }

  return (
    <>
      <p className="gr" style={{ fontSize: 'var(--t-small)', marginBottom: 14 }}>
        Every county holds one link of each type. Adding a type gives all {counties.length} counties
        a new empty slot, and the checker picks it up on its next run.
      </p>
      <Rows>
        {linkTypes.map((t, i) => {
          const u = typeUsage(t.k, BADSTATES)
          return (
            <div className="rw" key={t.k} style={{ gridTemplateColumns: '1fr auto' }}>
              <span>
                <b>{t.n}</b>
                {t.req ? <Chip kind="b">Required</Chip> : null}
                <div className="sd">{t.note}</div>
                <div className="sd" style={{ marginTop: 3 }}>
                  {u.held} of {counties.length} counties have one
                  {u.bad ? <> · <span className="bad">{u.bad} not working</span></> : null}
                  {u.missing ? ` · ${u.missing} missing` : ''}
                </div>
              </span>
              <span style={{ display: 'flex', gap: 5 }}>
                <Btn
                  variant="ghost"
                  small
                  disabled={i === 0}
                  aria-label={`Move ${t.n} up`}
                  onClick={() => moveLinkType(t.k, -1)}
                >
                  ↑
                </Btn>
                <Btn
                  variant="ghost"
                  small
                  disabled={i === linkTypes.length - 1}
                  aria-label={`Move ${t.n} down`}
                  onClick={() => moveLinkType(t.k, 1)}
                >
                  ↓
                </Btn>
                <Btn variant="ghost" small onClick={() => onView({ at: 'edit', k: t.k })}>
                  Edit
                </Btn>
              </span>
            </div>
          )
        })}
      </Rows>
      <FormActions>
        <Btn variant="ghost" onClick={onClose}>
          Close
        </Btn>
        <Btn onClick={() => onView({ at: 'edit' })}>＋ Add a link type</Btn>
      </FormActions>
    </>
  )
}

function EditType({ k, onView }: { k?: string | undefined; onView: (v: LtView) => void }) {
  const { linkTypes, counties } = useCoverage()
  const existing = linkTypes.find((x) => x.k === k)
  const [name, setName] = useState(existing?.n ?? '')
  const [note, setNote] = useState(existing?.note ?? '')
  const [req, setReq] = useState(existing?.req ?? false)
  const [error, setError] = useState<string | null>(null)

  const usage = k ? typeUsage(k, BADSTATES) : null

  const submit = () => {
    const n = name.trim()
    if (!n) return setError('A name is required.')
    if (isDuplicateName(linkTypes, n, (x) => x.n, (x) => x.k === k))
      return setError(`There is already a link type called ${n}.`)
    saveLinkType({ n, note: note.trim(), req }, k)
    onView({ at: 'list' })
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
          <label htmlFor="lt-n">Name</label>
          <input
            className="inp"
            id="lt-n"
            placeholder="e.g. Municipal lien"
            autoComplete="off"
            value={name}
            onChange={(e) => {
              setName(e.target.value)
              setError(null)
            }}
          />
        </div>
        <div className="fld">
          <label htmlFor="lt-r">Required</label>
          <select
            className="inp"
            id="lt-r"
            value={req ? '1' : '0'}
            onChange={(e) => setReq(e.target.value === '1')}
          >
            <option value="1">Yes — a county without it counts as a gap</option>
            <option value="0">No — nice to have</option>
          </select>
        </div>
        <div className="fld" style={{ gridColumn: '1/-1' }}>
          <label htmlFor="lt-d">What it is for</label>
          <input
            className="inp"
            id="lt-d"
            placeholder="One line, shown to whoever fills it in"
            autoComplete="off"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
      </div>

      {k && usage ? (
        <Banner kind="b" icon="◔" style={{ margin: '16px 0 0' }}>
          <b>
            {usage.held} of {counties.length}
          </b>{' '}
          counties have this link
          {usage.bad ? `, and ${usage.bad} of those are not working` : ''}.
        </Banner>
      ) : (
        <Banner
          kind="b"
          icon="◈"
          title={`All ${counties.length} counties get an empty slot`}
          style={{ margin: '16px 0 0' }}
        >
          Nothing is invented — each one shows as <b>no link on file</b> until someone fills it in,
          and the checker starts covering it on the next run.
        </Banner>
      )}

      <FormActions>
        <Btn variant="ghost" onClick={() => onView({ at: 'list' })}>
          Back
        </Btn>
        {k ? (
          <Btn variant="danger" onClick={() => onView({ at: 'confirm', k })}>
            Remove
          </Btn>
        ) : null}
        <Btn onClick={submit}>{k ? 'Save' : 'Add link type'}</Btn>
      </FormActions>
    </>
  )
}
