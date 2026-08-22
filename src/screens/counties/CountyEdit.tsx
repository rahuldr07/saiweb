import { useState } from 'react'
import { Banner, Btn, Label } from '@/components/ui'
import { BADSTATES } from '@/data/catalog'
import { LSTATE, days } from '@/lib/derived'
import { removeCounty, saveCounty, useCoverage } from '@/state/coverage'
import type { County, CountyLink } from '@/data/types'

/**
 * Adding a county, or correcting one.
 *
 * The link fields are the reason this is one form rather than four: a county
 * arrives with its addresses, and making somebody save the county and then open
 * four separate dialogs is how three of them never get filled in.
 *
 * An address that has been edited comes back as **unchecked**, not working. The
 * checker decides what works; this form only records what was typed.
 */
export function CountyEdit({
  county,
  onDone,
  onCancel,
}: {
  county: County | null
  onDone: () => void
  onCancel: () => void
}) {
  const { counties, linkTypes, check } = useCoverage()
  const [n, setN] = useState(county?.n ?? '')
  const [st, setSt] = useState(county?.st ?? '')
  const [idx, setIdx] = useState(county?.idx ? String(county.idx) : '')
  const [urls, setUrls] = useState<Record<string, string>>(() =>
    Object.fromEntries(linkTypes.map((t) => [t.k, county?.links[t.k]?.u ?? ''])),
  )
  const [error, setError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)

  const submit = () => {
    const name = n.trim()
    const state = st.trim().toUpperCase()
    if (!name) return setError('A county name is required.')
    if (!/^[A-Z]{2}$/.test(state)) return setError('Use a two-letter state code.')

    const clash = counties.find(
      (c) =>
        c.n.toLowerCase() === name.toLowerCase() &&
        c.st === state &&
        !(county && c.n === county.n && c.st === county.st),
    )
    if (clash) return setError(`${name}, ${state} is already on file.`)

    /* An unchanged address keeps its health and its history; a new or edited one
       has to be checked again before anyone can call it working. */
    const links: Record<string, CountyLink> = {}
    for (const t of linkTypes) {
      const u = (urls[t.k] ?? '').trim()
      const prev = county?.links[t.k] ?? null
      links[t.k] = !u
        ? { u: '', s: 'none' }
        : prev && prev.u === u
          ? prev
          : { u, s: 'unchecked' }
    }

    const parsed = parseInt(idx, 10)
    saveCounty(
      { n: name, st: state, idx: Number.isFinite(parsed) ? parsed : null, links },
      county ? { n: county.n, st: county.st } : undefined,
    )
    onDone()
  }

  if (confirming && county) {
    const held = linkTypes.filter((t) => county.links[t.k]?.u).length
    return (
      <>
        <p style={{ fontSize: '13.5px' }}>
          Removing <b>{county.n} County, {county.st}</b> takes it off the coverage record.{' '}
          {held
            ? `The ${held} link${held === 1 ? '' : 's'} on file ${held === 1 ? 'goes' : 'go'} with it.`
            : 'It has no links on file, so nothing else is lost.'}
        </p>
        <Banner kind="d" icon="⚑" style={{ marginTop: 14 }}>
          Order intake validates against this record, so an order for {county.n} can no longer be
          taken.
        </Banner>
        <div style={{ display: 'flex', gap: 9, justifyContent: 'flex-end', marginTop: 18 }}>
          <Btn variant="ghost" onClick={() => setConfirming(false)}>
            Cancel
          </Btn>
          <Btn
            variant="danger"
            onClick={() => {
              removeCounty(county.n, county.st)
              onDone()
            }}
          >
            Remove {county.n}
          </Btn>
        </div>
      </>
    )
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
          <label htmlFor="cy-n">County</label>
          <input
            className="inp"
            id="cy-n"
            autoComplete="off"
            value={n}
            onChange={(e) => {
              setN(e.target.value)
              setError(null)
            }}
          />
        </div>
        <div className="fld">
          <label htmlFor="cy-s">State</label>
          <input
            className="inp"
            id="cy-s"
            maxLength={2}
            placeholder="PA"
            autoComplete="off"
            value={st}
            onChange={(e) => {
              setSt(e.target.value)
              setError(null)
            }}
          />
        </div>
        <div className="fld" style={{ gridColumn: '1/-1' }}>
          <label htmlFor="cy-i">Recorder index starts</label>
          <input
            className="inp mono"
            id="cy-i"
            placeholder="leave blank if manual"
            autoComplete="off"
            value={idx}
            onChange={(e) => setIdx(e.target.value)}
          />
          <div className="hint">
            A search that has to go deeper than this needs a courthouse trip. Quoting uses it.
          </div>
        </div>
      </div>

      <div style={{ marginTop: 18 }}>
        <Label>Links</Label>
      </div>
      <div style={{ display: 'grid', gap: 9 }}>
        {linkTypes.map((t) => {
          const l = county?.links[t.k] ?? { u: '', s: 'none' as const }
          const flagged = BADSTATES.includes(l.s)
          return (
            <div className="fld" key={t.k}>
              <label htmlFor={`cy-${t.k}`}>
                {t.n}
                {county ? (
                  <span
                    className={`chip ${LSTATE[l.s][1]}`}
                    style={{ fontSize: '9.5px', padding: '1px 7px', marginLeft: 5 }}
                  >
                    {LSTATE[l.s][0]}
                  </span>
                ) : null}
              </label>
              <input
                className="inp mono"
                id={`cy-${t.k}`}
                placeholder="no link on file"
                autoComplete="off"
                style={{
                  fontSize: '12.5px',
                  ...(flagged
                    ? { borderColor: 'var(--flagline)', background: 'var(--flag)' }
                    : {}),
                }}
                value={urls[t.k] ?? ''}
                onChange={(e) => setUrls((u) => ({ ...u, [t.k]: e.target.value }))}
              />
              {l.err ? (
                <div className="hint bad">
                  {l.err} — first seen {l.since ? days(l.since) : '—'} days ago
                </div>
              ) : null}
            </div>
          )
        })}
      </div>

      <Banner kind="b" icon="◷" style={{ margin: '16px 0 0' }}>
        <span style={{ fontSize: '12.5px' }}>
          All {linkTypes.length} are checked automatically every {check.every} days. Anything
          that stops working is reported to{' '}
          {check.notify === 'admins' ? 'company admins' : check.notify}.
        </span>
      </Banner>

      <div style={{ display: 'flex', gap: 9, justifyContent: 'flex-end', marginTop: 18 }}>
        <Btn variant="ghost" onClick={onCancel}>
          Cancel
        </Btn>
        {county ? (
          <Btn variant="danger" onClick={() => setConfirming(true)}>
            Remove
          </Btn>
        ) : null}
        <Btn onClick={submit}>{county ? 'Save county' : 'Add county'}</Btn>
      </div>
    </>
  )
}
