import { useRef } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Banner, Btn, Card, CardHead, Chip, Kpi, Kpis, Label, PageHead, Row, Rows, SectionHead } from '@/components/ui'
import { ErrorBoundary } from '@/components/async'
import { useUi } from '@/state/ui'
import { STAFF } from '@/data/people'
import { LSTATE, brokenLinks, days, linkStats, nextLinkCheck, type FlatLink } from '@/lib/derived'
import { fmtDT, fmtDate, TZ } from '@/lib/format'
import { now } from '@/lib/clock'
import { runLinkCheck, setCheckEvery, setCheckNotify, useCoverage } from '@/state/coverage'
import { FixLink } from './counties/FixLink'
import type { LinkStatus } from '@/data/types'

/**
 * Link monitor.
 *
 * The county portals searchers depend on, and whether they still answer. A link
 * that quietly moved costs an order its SLA, so the states are explicit rather
 * than a boolean — "moved" and "asks for a login" are different problems with
 * different fixes, which is why the failures are grouped by cause rather than
 * listed in one undifferentiated table.
 */

const BROKEN_COLS = '160px 120px 1fr 130px 120px'

/** The intervals the checker can be set to. */
const EVERY = [1, 2, 3, 7, 14]

const NOTIFY: [string, string][] = [
  ['admins', 'Company admins'],
  ['leads', 'Admins and department leads'],
  ['everyone', 'Everyone'],
]

/** What each failing state actually means, in the order the design lists them. */
const CAUSES: [LinkStatus, string][] = [
  ['broken', 'The page does not load at all — 404, timeout, or the host has gone'],
  ['moved', 'It redirects somewhere else. Still works, but the address on file is stale'],
  ['auth', 'It now asks for a login that the searchers do not have'],
  ['slow', 'It answers, but slowly enough to hold up a search'],
  ['none', 'No address on file. Nothing to check, and nothing for the searcher to open'],
]

function LinkMonitor() {
  const navigate = useNavigate()
  const { openModal, closeModal, toast } = useUi()
  const { counties, check } = useCoverage()
  const broken = useRef<HTMLHeadingElement>(null)
  const schedule = useRef<HTMLHeadingElement>(null)

  const stats = linkStats()
  const bad = brokenLinks()
  const due = now() >= nextLinkCheck()
  const sinceLast = days(check.last)
  const lastRun = sinceLast === 0 ? 'today' : `${sinceLast} days ago`

  /* Grouped by what went wrong, because each cause has a different remedy — a
     moved portal needs a new address, a login wall needs an account.
     Ordered by the severity the legend below states, rather than by whichever
     county happened to fail first: groups that reshuffle as you fix things move
     the next row out from under the cursor. */
  const byCause = CAUSES.map(([s]) => [s, bad.filter((x) => x.l.s === s)] as const).filter(
    ([, list]) => list.length,
  )

  const admins = STAFF.filter((s) => s.r === 'admin' && s.active !== false).map((s) => s.n)
  const countiesHit = new Set(bad.map((x) => x.c.n)).size

  const focus = (el: HTMLElement | null) => {
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    el.classList.add('lit')
    setTimeout(() => el.classList.remove('lit'), 1500)
  }

  /** Sends the reader to the coverage register with a filter already applied. */
  const toCoverage = (f?: 'ok' | 'gap') =>
    navigate({ to: '/counties', search: f ? { f } : {} })

  const runNow = () => {
    const { checked, stillBroken } = runLinkCheck()
    toast(
      checked
        ? `Checked — ${checked} link${checked === 1 ? '' : 's'} resolved, ${stillBroken} still not working`
        : `Checked — nothing new, ${stillBroken} still not working`,
    )
  }

  const fix = (x: FlatLink) =>
    openModal({
      title: `${x.lbl} link — ${x.c.n}, ${x.c.st}`,
      body: (
        <FixLink
          county={x.c}
          type={{ k: x.k, n: x.lbl, req: false, note: '' }}
          onCancel={closeModal}
          onDone={(message) => {
            closeModal()
            toast(message)
          }}
        />
      ),
    })

  return (
    <>
      <PageHead
        title="Link monitor"
        sub={`Every county link is checked every ${check.every} days. Anything that stops working is reported here.`}
        actions={
          <>
            <Btn variant="ghost" onClick={() => toCoverage()}>
              County coverage
            </Btn>
            <Btn onClick={runNow}>Run the check now</Btn>
          </>
        }
      />

      {bad.length ? (
        <Banner
          kind="d"
          icon="⚑"
          title={`${bad.length} link${bad.length === 1 ? ' is' : 's are'} not working`}
        >
          Across {countiesHit} {countiesHit === 1 ? 'county' : 'counties'}. A searcher working{' '}
          {bad.length === 1 ? 'that county' : 'those counties'} is doing it without the portal.
          <div className="bs">
            Found by the check that ran {lastRun}. Notifying{' '}
            <b>{check.notify === 'admins' ? 'company admins' : check.notify}</b>.
          </div>
        </Banner>
      ) : (
        <Banner kind="v" icon="✓" title="Every link is working">
          Last checked {lastRun}.
        </Banner>
      )}

      <Kpis>
        <Kpi
          title="Links on file"
          value={stats.covered}
          detail={`of ${stats.total} possible across ${counties.length} counties`}
          icon="›"
          hint="Every county"
          onClick={() => toCoverage()}
        />
        <Kpi
          title="Working"
          value={<span className="ok">{stats.by.ok}</span>}
          detail={`${stats.covered ? Math.round((stats.by.ok / stats.covered) * 100) : 0}% of what we hold`}
          icon="›"
          hint="Counties with every link working"
          onClick={() => toCoverage('ok')}
        />
        <Kpi
          title="Not working"
          value={<span className={stats.bad ? 'bad' : 'ok'}>{stats.bad}</span>}
          tone={stats.bad ? 'alert' : undefined}
          detail={stats.bad ? 'listed below' : 'none'}
          icon="›"
          hint={stats.bad ? 'What is broken and why' : 'Every county'}
          onClick={() => (stats.bad ? focus(broken.current) : toCoverage())}
        />
        <Kpi
          title="No link at all"
          value={<span className={stats.by.none ? 'warn' : 'gr'}>{stats.by.none}</span>}
          tone={stats.by.none ? 'warn' : undefined}
          detail="nothing to check"
          icon="›"
          hint="Counties missing an address"
          onClick={() => toCoverage('gap')}
        />
        <Kpi
          title="Next check"
          value={
            <span style={{ fontSize: '19px' }}>{due ? 'Due now' : fmtDate(nextLinkCheck())}</span>
          }
          tone={due ? 'warn' : undefined}
          detail={`every ${check.every} days`}
          icon="›"
          hint="How the check runs"
          onClick={() => focus(schedule.current)}
        />
      </Kpis>

      {bad.length ? (
        <>
          <div ref={broken}>
            <SectionHead>What is broken, grouped by what went wrong</SectionHead>
          </div>
          {byCause.map(([s, list]) => (
            <Card key={s} style={{ marginBottom: 13 }}>
              <CardHead
                title={LSTATE[s][0]}
                actions={
                  <Chip kind={LSTATE[s][1]}>
                    {list.length} link{list.length === 1 ? '' : 's'}
                  </Chip>
                }
              />
              <div className="tsc">
                <div style={{ minWidth: 820 }}>
                  <div className="trow h" style={{ gridTemplateColumns: BROKEN_COLS }}>
                    <span>County</span>
                    <span>Link</span>
                    <span>What happened</span>
                    <span>Broken for</span>
                    <span />
                  </div>
                  <div className="tb">
                    {list.map((x) => (
                      <div
                        className="trow"
                        key={`${x.c.st}-${x.c.n}-${x.k}`}
                        style={{ gridTemplateColumns: BROKEN_COLS }}
                      >
                        <div className="cell">
                          <div className="v">
                            <b>{x.c.n}</b>
                          </div>
                          <div className="s">{x.c.st}</div>
                        </div>
                        <div className="cell">
                          <div className="v">{x.lbl}</div>
                        </div>
                        <div className="cell">
                          <div className="v" style={{ fontSize: '12.5px' }}>
                            {x.l.err || '—'}
                          </div>
                          <div className="s mono" style={{ fontSize: '11.5px' }}>
                            {x.l.u || 'no address'}
                          </div>
                        </div>
                        <div className="cell">
                          <div
                            className={`v mono ${x.l.since && days(x.l.since) > 7 ? 'bad' : 'warn'}`}
                          >
                            {x.l.since ? `${days(x.l.since)} days` : '—'}
                          </div>
                        </div>
                        <div className="cell">
                          <Btn
                            variant="ghost"
                            small
                            aria-label={`Fix the ${x.lbl} link for ${x.c.n}`}
                            onClick={() => fix(x)}
                          >
                            Fix
                          </Btn>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </>
      ) : null}

      <div ref={schedule}>
        <SectionHead>The check</SectionHead>
      </div>
      <div className="two">
        <Card padded>
          <Label>Schedule</Label>
          <div className="frm">
            <div className="fld">
              <label htmlFor="lc-e">Run every</label>
              <select
                className="inp"
                id="lc-e"
                value={String(check.every)}
                onChange={(e) => setCheckEvery(Number(e.target.value))}
              >
                {EVERY.map((d) => (
                  <option key={d} value={d}>
                    {d} day{d === 1 ? '' : 's'}
                  </option>
                ))}
              </select>
              <div className="hint">
                County portals change without warning. Three days keeps it fresh without hammering
                them.
              </div>
            </div>
            <div className="fld">
              <label htmlFor="lc-n">Tell</label>
              <select
                className="inp"
                id="lc-n"
                value={check.notify}
                onChange={(e) => setCheckNotify(e.target.value)}
              >
                {NOTIFY.map(([v, label]) => (
                  <option key={v} value={v}>
                    {label}
                  </option>
                ))}
              </select>
              <div className="hint">Currently {admins.join(', ') || 'nobody'}.</div>
            </div>
          </div>

          <div style={{ marginTop: 16 }}>
            <Rows>
              <Row
                icon={<span className="gr">·</span>}
                title="Last run"
                detail={`${fmtDT(check.last)} ${TZ}`}
                right={
                  <span className="gr mono" style={{ fontSize: '11.5px' }}>
                    {sinceLast === 0 ? 'today' : `${sinceLast}d ago`}
                  </span>
                }
              />
              <Row
                icon={<span className={due ? 'warn' : 'gr'}>·</span>}
                title="Next run"
                detail={fmtDate(nextLinkCheck())}
                right={
                  <span className={`${due ? 'warn' : 'gr'} mono`} style={{ fontSize: '11.5px' }}>
                    {due ? 'due now' : 'scheduled'}
                  </span>
                }
              />
            </Rows>
          </div>
        </Card>

        <Card padded>
          <Label>What counts as broken</Label>
          <Rows>
            {CAUSES.map(([s, what]) => (
              <div className="rw" key={s}>
                <span>
                  <Chip kind={LSTATE[s][1]}>{LSTATE[s][0]}</Chip>
                </span>
                <span className="gr" style={{ fontSize: '12.5px' }}>
                  {what}
                </span>
                <span />
              </div>
            ))}
          </Rows>
          <p className="gr" style={{ fontSize: '12.5px', marginTop: 12 }}>
            A redirect is reported rather than followed silently — a county that moved its portal
            usually changed how the search works too.
          </p>
        </Card>
      </div>
    </>
  )
}

export default function LinkMonitorRoute() {
  return (
    <ErrorBoundary what="Link monitor">
      <LinkMonitor />
    </ErrorBoundary>
  )
}
