import { useState } from 'react'
import { Banner, Btn } from '@/components/ui'
import { BADSTATES } from '@/data/catalog'
import { LSTATE, days, nextLinkCheck } from '@/lib/derived'
import { fmtDate } from '@/lib/format'
import { saveLink, useCoverage } from '@/state/coverage'
import type { County, LinkType } from '@/data/types'

/**
 * One link on one county.
 *
 * Two different things can be true and they get two different buttons. "Save
 * link" records a new address, which then has to be checked. "Mark working" is a
 * person saying they have just used the one on file — that clears the error and
 * the date it was first seen, because the failure is over.
 */
export function FixLink({
  county,
  type,
  onDone,
  onCancel,
}: {
  county: County
  type: LinkType
  onDone: (message: string) => void
  onCancel: () => void
}) {
  const { check } = useCoverage()
  const l = county.links[type.k] ?? { u: '', s: 'none' as const }
  const [url, setUrl] = useState(l.u)
  const failing = BADSTATES.includes(l.s)
  const since = days(check.last)

  return (
    <>
      <div className="frm">
        <div className="fld" style={{ gridColumn: '1/-1' }}>
          <label htmlFor="lk-u">Address</label>
          <input
            className="inp mono"
            id="lk-u"
            placeholder="no link on file"
            autoComplete="off"
            style={{ fontSize: '12.5px' }}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
        </div>
      </div>

      {failing ? (
        <Banner
          kind="d"
          icon="⚑"
          title={<span style={{ fontSize: '12.5px' }}>{LSTATE[l.s][0]}{l.err ? ` — ${l.err}` : ''}</span>}
          style={{ marginTop: 14 }}
        >
          <span style={{ fontSize: '12.5px' }}>
            First seen {l.since ? days(l.since) : '—'} days ago. Searchers working {county.n} have
            been without it since.
          </span>
        </Banner>
      ) : null}

      <Banner kind="b" icon="◷" style={{ marginTop: 14 }}>
        <span style={{ fontSize: '12.5px' }}>
          Checked every {check.every} days. Last run {since === 0 ? 'today' : `${since} days ago`},
          next {fmtDate(nextLinkCheck())}.
        </span>
      </Banner>

      <div style={{ display: 'flex', gap: 9, justifyContent: 'flex-end', marginTop: 18 }}>
        <Btn variant="ghost" onClick={onCancel}>
          Cancel
        </Btn>
        <Btn
          variant="ghost"
          onClick={() => {
            saveLink(county.n, county.st, type.k, { markOk: true })
            onDone(`${type.n} — ${county.n} marked working`)
          }}
        >
          Mark working
        </Btn>
        <Btn
          onClick={() => {
            saveLink(county.n, county.st, type.k, { url })
            onDone(
              url.trim()
                ? `${type.n} — ${county.n} saved, awaiting a check`
                : `${type.n} — ${county.n} link removed`,
            )
          }}
        >
          Save link
        </Btn>
      </div>
    </>
  )
}
