import { useMemo, useRef, useState } from 'react'
import { useNavigate, useSearch } from '@tanstack/react-router'
import {
  Avatar,
  Btn,
  Card,
  Chip,
  Kpi,
  Kpis,
  PageHead,
  Row,
  Rows,
  Tabs,
} from '@/components/ui'
import { ErrorBoundary } from '@/components/async'
import { RequireCap } from '@/components/RequireCap'
import { useUi } from '@/state/ui'
import { useSession } from '@/state/session'
import { PAYMONTHS, PAYRUNS, RUNSTATE } from '@/data/hrms'
import type { Person } from '@/data/types'
import { inr, paidStaff, payTotals, payslipOf, type Payslip } from '@/lib/payroll'
import { csvName, downloadCSV } from '@/lib/csv'
import {
  payslipFileStem,
  payslipRows,
  registerFileStem,
  registerRows,
} from '@/lib/payroll-csv'

/**
 * The payslips register.
 *
 * Tabs would be padding on a screen this short. What actually costs time here is
 * the question people ask — "send me my last three payslips" — which meant
 * clicking through three months. That gets its own view; the rest gets a search.
 */

const TABS = ['This month', 'One person'] as const
type Tab = (typeof TABS)[number]

/* The design's two grids, kept as constants so the header row and the body rows
   cannot drift apart. */
const MONTH_COLS = '200px 140px 130px 130px 130px 1fr'
const PERSON_COLS = '170px 130px 130px 130px 110px 1fr'

/** The most recent month that actually has payslips, not the most recent draft. */
function latestPublished(): string {
  const published = PAYMONTHS.filter((m) => PAYRUNS[m]?.published)
  return published.length ? published[published.length - 1] : PAYMONTHS[PAYMONTHS.length - 1]
}

/** Downloads, shared by both tabs and named the way the design names them. */
function useDownloads() {
  const { toast } = useUi()
  const { tenant } = useSession()

  return useMemo(
    () => ({
      payslip: (person: Person, month: string) => {
        const out = downloadCSV(
          csvName(payslipFileStem(person, month)),
          payslipRows(person, month, tenant.name),
        )
        toast(out.name)
      },
      register: (month: string, list: Payslip[]) => {
        const out = downloadCSV(csvName(registerFileStem(month)), registerRows(list))
        toast(`${out.name} — ${out.rows.length - 1} people`)
      },
    }),
    [toast, tenant.name],
  )
}

/* ── this month ─────────────────────────────────────────────────────────── */

function ThisMonth({
  month,
  setMonth,
  totals,
}: {
  month: string
  setMonth: (m: string) => void
  totals: ReturnType<typeof payTotals>
}) {
  const navigate = useNavigate()
  const { openModal, closeModal } = useUi()
  const download = useDownloads()
  const [only, setOnly] = useState<'all' | 'lop'>('all')
  const [query, setQuery] = useState('')
  const list = useRef<HTMLDivElement>(null)

  const run = PAYRUNS[month]

  const openPayslip = (personId: string) =>
    navigate({ to: '/payslips/$personId', params: { personId }, search: { m: month } })

  /* One filtered list, so the count on the pill and the rows under it are the
     same computation rather than two that agree by hand. */
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return totals.list.filter((x) => {
      if (only === 'lop' && x.unpaid <= 0) return false
      if (!q) return true
      return x.p.n.toLowerCase().includes(q) || x.p.dep.join(' ').toLowerCase().includes(q)
    })
  }, [totals.list, only, query])

  /* Take someone to the list already on the page rather than duplicating it, and
     flash it so the eye lands where the tile just sent them. */
  const focusList = () => {
    const el = list.current
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    el.classList.add('lit')
    setTimeout(() => el.classList.remove('lit'), 1500)
  }

  /* Each tile answers a different question, so each opens a different thing. */
  const showCredited = () =>
    openModal({
      title: `What was credited — ${month}`,
      body: (
        <>
          <Rows>
            <Row
              icon={<span className="gr" style={{ fontSize: '14.5px' }}>·</span>}
              title="Gross earnings"
              detail="before anything is taken off"
              right={<span className="mono">{inr(totals.gross)}</span>}
            />
            <Row
              icon={<span className="bad" style={{ fontSize: '14.5px' }}>⚑</span>}
              title="Less deductions"
              detail="PF, PT, ESI and tax"
              right={<span className="mono bad">−{inr(totals.ded)}</span>}
            />
          </Rows>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '13px 2px 0',
              fontSize: '14.5px',
              borderTop: '1px solid var(--hair)',
              marginTop: 10,
            }}
          >
            <b>Credited to {totals.list.length} accounts</b>
            <b className="mono ok">{inr(totals.net)}</b>
          </div>
          <p className="gr" style={{ fontSize: '12.5px', margin: '14px 0 0' }}>
            The same figures the payroll register was approved on. A payslip is not recomputed when
            it is opened.
          </p>
        </>
      ),
      footer: (
        <>
          <Btn
            variant="ghost"
            onClick={() => {
              closeModal()
              navigate({ to: '/payroll' })
            }}
          >
            The run
          </Btn>
          <Btn onClick={closeModal}>Close</Btn>
        </>
      ),
    })

  return (
    <>
      <div className="fbar" role="group" aria-label="Month">
        {PAYMONTHS.map((m) => {
          const r = PAYRUNS[m]
          return (
            <button
              key={m}
              type="button"
              className={`pill ${month === m ? 'on' : ''}`}
              aria-pressed={month === m}
              onClick={() => setMonth(m)}
            >
              {m} <Chip kind={r?.published ? 'v' : 'n'}>{r?.published ? 'Published' : 'Not out'}</Chip>
            </button>
          )
        })}
      </div>

      {!run?.published ? (
        <Card padded>
          <p className="gr" style={{ fontSize: '12.5px', margin: 0 }}>
            {month} is <b>{RUNSTATE[run?.state ?? 'draft'][0].toLowerCase()}</b>. Payslips are
            produced when the run is published — until then there is nothing to show, and showing a
            draft to anyone would be worse than showing nothing.
          </p>
          <div style={{ marginTop: 14 }}>
            <Btn onClick={() => navigate({ to: '/payroll' })}>Open the run</Btn>
          </div>
        </Card>
      ) : (
        <>
          <Kpis>
            <Kpi
              title="Payslips out"
              value={totals.list.length}
              detail="visible to each person"
              icon="›"
              hint="Show everyone, filters cleared"
              onClick={() => {
                setOnly('all')
                setQuery('')
                focusList()
              }}
            />
            <Kpi
              title="Total net"
              value={
                <span className="ok" style={{ fontSize: '23px' }}>
                  {inr(totals.net)}
                </span>
              }
              detail="as credited"
              icon="›"
              hint="Gross less deductions"
              onClick={showCredited}
            />
            <Kpi
              title="With a deduction for unpaid days"
              value={<span className={totals.lop.length ? 'warn' : 'ok'}>{totals.lop.length}</span>}
              tone={totals.lop.length ? 'warn' : undefined}
              detail="the ones people query"
              icon="›"
              hint="Filter the list to just these"
              onClick={() => {
                setOnly('lop')
                focusList()
              }}
            />
            <Kpi
              title="Approved by"
              value={<span style={{ fontSize: '17px' }}>{(run.by ?? '—').split(' ')[0]}</span>}
              detail={run.at ?? ''}
              icon="›"
              hint="Open the run it was approved on"
              onClick={() => navigate({ to: '/payroll' })}
            />
          </Kpis>

          <div className="fbar" role="group" aria-label="Which payslips">
            <button
              type="button"
              className={`pill ${only === 'all' ? 'on' : ''}`}
              aria-pressed={only === 'all'}
              onClick={() => setOnly('all')}
            >
              Everyone
            </button>
            <button
              type="button"
              className={`pill ${only === 'lop' ? 'on' : ''}`}
              aria-pressed={only === 'lop'}
              onClick={() => setOnly('lop')}
            >
              With a deduction — {totals.lop.length}
            </button>
            <div className="sp">
              <input
                className="inp"
                type="search"
                placeholder="Find a person or department"
                aria-label="Find a payslip"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          </div>

          <Card>
            <div className="tsc">
              <div style={{ minWidth: 860 }}>
                <div className="trow h" style={{ gridTemplateColumns: MONTH_COLS }}>
                  <span>Name</span>
                  <span>Department</span>
                  <span>Gross</span>
                  <span>Deductions</span>
                  <span>Net</span>
                  <span />
                </div>
                <div className="tb" ref={list}>
                  {!rows.length ? (
                    <div className="rw" style={{ padding: 18 }}>
                      <span />
                      <span className="gr" style={{ fontSize: '13.5px' }}>
                        Nobody matches that.
                      </span>
                      <span />
                    </div>
                  ) : (
                    rows.map((x) => (
                      <div
                        key={x.p.id}
                        className="trow"
                        role="button"
                        tabIndex={0}
                        aria-label={`Open ${x.p.n}’s payslip for ${month}`}
                        onClick={() => openPayslip(x.p.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            openPayslip(x.p.id)
                          }
                        }}
                        style={{ gridTemplateColumns: MONTH_COLS }}
                      >
                        <div className="cell">
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Avatar name={x.p.n} />
                            <div className="v">{x.p.n}</div>
                          </div>
                        </div>
                        <div className="cell">
                          <div className="v gr" style={{ fontSize: '12.5px' }}>
                            {x.p.dep[0] ?? '—'}
                          </div>
                        </div>
                        <div className="cell">
                          <div className="v mono">{inr(x.gross)}</div>
                          {x.unpaid ? <div className="s warn">{x.unpaid} unpaid</div> : null}
                        </div>
                        <div className="cell">
                          <div className="v mono warn">{inr(x.totalDed)}</div>
                        </div>
                        <div className="cell">
                          <div className="v mono ok" style={{ fontWeight: 650 }}>
                            {inr(x.net)}
                          </div>
                        </div>
                        <div className="cell">
                          <Btn
                            variant="ghost"
                            small
                            aria-label={`Download ${x.p.n}’s ${month} payslip`}
                            onClick={(e) => {
                              e.stopPropagation()
                              download.payslip(x.p, month)
                            }}
                          >
                            Download
                          </Btn>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </Card>

          <p className="gr" style={{ fontSize: '12.5px', marginTop: 10 }}>
            Each person sees only their own, under My payslips. This list exists so whoever runs
            payroll can answer a question without asking them to forward it.
          </p>
        </>
      )}
    </>
  )
}

/* ── one person ─────────────────────────────────────────────────────────── */

function OnePerson({
  who,
  people,
  onPick,
}: {
  who: Person | undefined
  people: Person[]
  onPick: (id: string) => void
}) {
  const navigate = useNavigate()
  const { openModal } = useUi()
  const download = useDownloads()

  const months = useMemo(() => PAYMONTHS.filter((m) => PAYRUNS[m]?.published), [])
  const rows = useMemo(
    () => (who ? months.map((m) => ({ m, s: payslipOf(who, m) })) : []),
    [who, months],
  )

  const sum = useMemo(
    () =>
      rows.reduce(
        (a, r) => ({
          gross: a.gross + r.s.gross,
          ded: a.ded + r.s.totalDed,
          net: a.net + r.s.net,
          tds: a.tds + r.s.tds,
          unpaid: a.unpaid + r.s.unpaid,
        }),
        { gross: 0, ded: 0, net: 0, tds: 0, unpaid: 0 },
      ),
    [rows],
  )

  const openPayslip = (mn: string) =>
    who && navigate({ to: '/payslips/$personId', params: { personId: who.id }, search: { m: mn } })

  /* An unpaid day is the commonest reason someone queries a payslip, so the
     months are named rather than left to be found. */
  const showUnpaid = () => {
    if (!who) return
    const withUnpaid = rows.filter((r) => r.s.unpaid > 0)
    openModal({
      title: `${who.n} — months with an unpaid day`,
      body: (
        <>
          {withUnpaid.length ? (
            <Rows>
              {withUnpaid.map((r) => (
                <Row
                  key={r.m}
                  icon={<span className="bad" style={{ fontSize: '14.5px' }}>⚑</span>}
                  title={r.m}
                  detail={`${r.s.unpaid} unpaid of ${r.s.a.working} working days`}
                  right={<span className="mono bad">−{inr(r.s.lopAmt)}</span>}
                />
              ))}
            </Rows>
          ) : (
            <p className="gr" style={{ fontSize: '13.5px', margin: 0 }}>
              No month has an unpaid day — every payslip is a full month.
            </p>
          )}
          <p className="gr" style={{ fontSize: '12.5px', margin: '14px 0 0' }}>
            An unpaid day is the commonest reason someone queries a payslip. Having the month named
            makes that a thirty-second conversation.
          </p>
        </>
      ),
    })
  }

  return (
    <>
      <div className="fld" style={{ maxWidth: 340, marginBottom: 16 }}>
        <label htmlFor="pspSel">Whose payslips</label>
        <select
          id="pspSel"
          className="inp"
          value={who?.id ?? ''}
          onChange={(e) => onPick(e.target.value)}
        >
          {people.map((p) => (
            <option key={p.id} value={p.id}>
              {p.n} — {p.dep[0] ?? '—'}
            </option>
          ))}
        </select>
      </div>

      {!rows.length ? (
        <Card padded>
          <p className="gr" style={{ fontSize: '13.5px', margin: 0 }}>
            No month has been published yet, so there is nothing to send.
          </p>
        </Card>
      ) : (
        <>
          <Kpis>
            <Kpi
              title="Gross so far"
              value={<span style={{ fontSize: '23px' }}>{inr(sum.gross)}</span>}
              detail={`across ${rows.length} months`}
              icon="›"
              hint="The latest payslip"
              onClick={() => openPayslip(rows[rows.length - 1].m)}
            />
            <Kpi
              title="Deducted"
              value={
                <span className="warn" style={{ fontSize: '23px' }}>
                  {inr(sum.ded)}
                </span>
              }
              detail={`including ${inr(sum.tds)} tax`}
              icon="›"
              hint="The latest payslip"
              onClick={() => openPayslip(rows[rows.length - 1].m)}
            />
            <Kpi
              title="Taken home"
              value={
                <span className="ok" style={{ fontSize: '23px' }}>
                  {inr(sum.net)}
                </span>
              }
              detail="as credited"
              icon="›"
              hint="The latest payslip"
              onClick={() => openPayslip(rows[rows.length - 1].m)}
            />
            <Kpi
              title="Unpaid days"
              value={<span className={sum.unpaid ? 'warn' : 'ok'}>{sum.unpaid}</span>}
              tone={sum.unpaid ? 'warn' : undefined}
              detail="the reason a month looks light"
              icon="›"
              hint="Which months, and why"
              onClick={showUnpaid}
            />
          </Kpis>

          <Card>
            <div className="tsc">
              <div style={{ minWidth: 760 }}>
                <div className="trow h" style={{ gridTemplateColumns: PERSON_COLS }}>
                  <span>Month</span>
                  <span>Gross</span>
                  <span>Deductions</span>
                  <span>Net</span>
                  <span>Unpaid</span>
                  <span />
                </div>
                <div className="tb">
                  {rows.map((r) => (
                    <div
                      key={r.m}
                      className="trow"
                      role="button"
                      tabIndex={0}
                      aria-label={`Open the ${r.m} payslip`}
                      onClick={() => openPayslip(r.m)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          openPayslip(r.m)
                        }
                      }}
                      style={{ gridTemplateColumns: PERSON_COLS }}
                    >
                      <div className="cell">
                        <div className="v">{r.m}</div>
                      </div>
                      <div className="cell">
                        <div className="v mono">{inr(r.s.gross)}</div>
                      </div>
                      <div className="cell">
                        <div className="v mono warn">{inr(r.s.totalDed)}</div>
                      </div>
                      <div className="cell">
                        <div className="v mono ok" style={{ fontWeight: 650 }}>
                          {inr(r.s.net)}
                        </div>
                      </div>
                      <div className="cell">
                        <div className={`v mono ${r.s.unpaid ? 'warn' : 'gr'}`}>
                          {r.s.unpaid || '—'}
                        </div>
                      </div>
                      <div className="cell">
                        <Btn
                          variant="ghost"
                          small
                          aria-label={`Download the ${r.m} payslip`}
                          onClick={(e) => {
                            e.stopPropagation()
                            if (who) download.payslip(who, r.m)
                          }}
                        >
                          Download
                        </Btn>
                      </div>
                    </div>
                  ))}
                  <div
                    className="trow"
                    style={{ gridTemplateColumns: PERSON_COLS, background: 'var(--tint)' }}
                  >
                    <div className="cell">
                      <div className="v" style={{ fontWeight: 700 }}>
                        Year to date
                      </div>
                    </div>
                    <div className="cell">
                      <div className="v mono" style={{ fontWeight: 700 }}>
                        {inr(sum.gross)}
                      </div>
                    </div>
                    <div className="cell">
                      <div className="v mono">{inr(sum.ded)}</div>
                    </div>
                    <div className="cell">
                      <div className="v mono ok" style={{ fontWeight: 700 }}>
                        {inr(sum.net)}
                      </div>
                    </div>
                    <div className="cell" />
                    <div className="cell" />
                  </div>
                </div>
              </div>
            </div>
          </Card>

          <p className="gr" style={{ fontSize: '12.5px', marginTop: 10 }}>
            This is the view for the question people actually ask — <i>send me my last three
            payslips</i>. It used to mean switching month by month and downloading one at a time.
          </p>
        </>
      )}
    </>
  )
}

/* ── the screen ─────────────────────────────────────────────────────────── */

function Payslips() {
  const navigate = useNavigate()
  const download = useDownloads()
  const search = useSearch({ from: '/payslips' })

  const people = useMemo(() => paidStaff(), [])

  /* The URL is the state. Anything it does not name falls back to the sensible
     opening view — the latest month that actually has payslips. */
  const tab: Tab = TABS.includes(search.tab as Tab) ? (search.tab as Tab) : 'This month'
  const month = search.m && PAYMONTHS.includes(search.m) ? search.m : latestPublished()
  const who = people.find((p) => p.id === search.p) ?? people[0]

  /* `replace` so changing month or tab does not put a step in the back stack —
     leaving the screen and coming back is one step either way. */
  const setView = (next: { tab?: Tab; m?: string; p?: string }) =>
    navigate({
      to: '/payslips',
      search: (prev: Record<string, unknown>) => ({ ...prev, ...next }),
      replace: true,
    })

  const totals = useMemo(() => payTotals(month), [month])
  const run = PAYRUNS[month]
  const publishedCount = useMemo(
    () => PAYMONTHS.filter((m) => PAYRUNS[m]?.published).length,
    [],
  )

  /* Nobody on the payroll at all is a different fact from a run not yet
     published, and it would otherwise render as an empty table with four zeroes
     over it. */
  if (!people.length) {
    return (
      <>
        <PageHead title="Payslips" sub="Nobody is on the payroll yet." />
        <Card padded>
          <p className="gr" style={{ fontSize: '13.5px', margin: 0 }}>
            No active person has a salary on record, so there is nothing to pay and no payslip to
            produce. Set a CTC on someone’s record and they appear here from the next run.
          </p>
          <div style={{ marginTop: 14 }}>
            <Btn onClick={() => navigate({ to: '/company' })}>Open the roster</Btn>
          </div>
        </Card>
      </>
    )
  }

  const sub =
    tab === 'One person'
      ? who
        ? `${who.n} · ${publishedCount} published payslip${publishedCount === 1 ? '' : 's'} this year`
        : 'Nobody on the payroll yet'
      : `${month} · ${
          run?.published
            ? `${totals.list.length} published`
            : `payroll is ${RUNSTATE[run?.state ?? 'draft'][0].toLowerCase()}`
        }`

  return (
    <>
      <PageHead
        title="Payslips"
        sub={sub}
        actions={
          <>
            <Btn variant="ghost" onClick={() => navigate({ to: '/payroll' })}>
              The run
            </Btn>
            {tab === 'This month' && run?.published ? (
              <Btn variant="ghost" onClick={() => download.register(month, totals.list)}>
                Export all
              </Btn>
            ) : null}
          </>
        }
      />

      <Tabs tabs={[...TABS]} value={tab} onChange={(t) => setView({ tab: t })} />

      {tab === 'This month' ? (
        <ThisMonth month={month} setMonth={(m) => setView({ m })} totals={totals} />
      ) : (
        <OnePerson who={who} people={people} onPick={(p) => setView({ p })} />
      )}
    </>
  )
}

export default function PayslipsRoute() {
  return (
    <RequireCap cap="pricing">
      <ErrorBoundary what="Payslips">
        <Payslips />
      </ErrorBoundary>
    </RequireCap>
  )
}
