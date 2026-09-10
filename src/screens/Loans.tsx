import { useMemo, useState } from 'react'
import {
  Avatar,
  Btn,
  Card,
  Chip,
  Empty,
  Kpi,
  Kpis,
  PageHead,
} from '@/components/ui'
import { ErrorBoundary } from '@/components/async'
import { useSession } from '@/state/session'
import { useUi } from '@/state/ui'
import { LNKIND, LNSTATUS } from '@/data/loans'
import { PAYMONTHS } from '@/data/hrms'
import { STAFF } from '@/data/people'
import { whoName } from '@/lib/permissions'
import { inr } from '@/lib/payroll'
import { csvName, downloadCSV } from '@/lib/csv'
import { useGo } from '@/lib/nav'
import { LOAN_POLICY, loanDeductionsFor, nextPayrollMonth, outstanding, recoveredInMonth, scheduleFor } from '@/lib/loans'
import { useLoanConfirm } from './loans/confirm'
import { useLoans } from '@/state/loans'
import type { LoanStatus } from '@/data/types'

const COLS = '180px 130px 100px 90px 100px 90px 110px 1fr'
const PAGE = 10

const TABS: [LoanStatus | 'all', string][] = [
  ['all', 'All'],
  ['requested', 'Requested'],
  ['active', 'Active'],
  ['paused', 'Paused'],
  ['closed', 'Closed'],
  ['rejected', 'Rejected'],
]

function Loans() {
  const go = useGo()
  const { me, can } = useSession()
  const { toast } = useUi()
  const { loans, payments } = useLoans()

  const [tab, setTab] = useState<LoanStatus | 'all'>('all')
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)

  const canAll = can('pricing')
  const scope = useMemo(
    () => (canAll ? loans : loans.filter((l) => l.who === me.id)),
    [canAll, loans, me.id],
  )

  const query = q.trim().toLowerCase()
  const filtered = useMemo(() => {
    const byTab = tab === 'all' ? scope : scope.filter((l) => l.st === tab)
    return query ? byTab.filter((l) => whoName(l.who).toLowerCase().includes(query)) : byTab
  }, [scope, tab, query])

  const sorted = useMemo(() => [...filtered].sort((a, b) => b.reqAt.getTime() - a.reqAt.getTime()), [filtered])
  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE))
  const shown = sorted.slice((page - 1) * PAGE, page * PAGE)

  const scopeIds = useMemo(() => new Set(scope.map((l) => l.id)), [scope])
  const scopedPayments = useMemo(() => payments.filter((p) => scopeIds.has(p.loanId)), [payments, scopeIds])
  const recoveredMonth = [...PAYMONTHS].reverse().find((m) => scopedPayments.some((p) => p.mn === m)) ?? null
  const recoveredAmt = recoveredMonth ? recoveredInMonth(scopedPayments, recoveredMonth) : 0

  const openCount = scope.filter((l) => l.st === 'active' || l.st === 'paused').length
  const outstandingTotal = scope
    .filter((l) => l.st === 'active' || l.st === 'paused')
    .reduce((a, l) => a + outstanding(l), 0)
  const activeCount = scope.filter((l) => l.st === 'active').length
  const requestedCount = scope.filter((l) => l.st === 'requested').length

  const previewMonth = nextPayrollMonth()
  const activeOwners = useMemo(
    () => [...new Set(loans.filter((l) => l.st === 'active').map((l) => l.who))],
    [loans],
  )
  const previewRows = useMemo(
    () => activeOwners.flatMap((pid) => loanDeductionsFor(pid, previewMonth, loans, payments)),
    [activeOwners, previewMonth, loans, payments],
  )

  const exportLoans = () => {
    const out = downloadCSV(csvName('loans-advances'), [
      ['Person', 'Type', 'Principal', 'EMI', 'Balance', 'Status', 'Requested'],
      ...sorted.map((l) => [
        whoName(l.who),
        LNKIND[l.kind][0],
        l.amt,
        l.emi,
        outstanding(l),
        LNSTATUS[l.st][0],
        l.reqAt.toDateString(),
      ]),
    ])
    toast(`${out.name} — ${out.rows.length - 1} rows`)
  }

  const confirm = useLoanConfirm()

  return (
    <>
      <PageHead
        title="Loans & advances"
        sub="Recovery happens inside the payroll run — approve here, deduct automatically, close at zero."
        actions={
          <>
            <Btn variant="ghost" onClick={exportLoans}>
              ↓ Export CSV
            </Btn>
            <Btn onClick={() => go({ to: '/loans/new' })}>+ New request</Btn>
          </>
        }
      />

      <Kpis>
        <Kpi title="Outstanding" value={inr(outstandingTotal)} valueSize={23} detail={`${openCount} open`} />
        <Kpi title="Active" value={activeCount} />
        <Kpi title="Requested" value={requestedCount} tone={requestedCount ? 'warn' : undefined} />
        <Kpi
          title={recoveredMonth ? `Recovered · ${recoveredMonth.split(' ')[0]}` : 'Recovered'}
          value={inr(recoveredAmt)}
          valueSize={23}
          valueTone="ok"
        />
      </Kpis>

      <div className="two" style={{ marginTop: 16, alignItems: 'start' }}>
        <div>
          <div className="fbar">
            {TABS.map(([key, label]) => (
              <button
                key={key}
                type="button"
                className={`pill ${tab === key ? 'on' : ''}`}
                aria-pressed={tab === key}
                onClick={() => {
                  setTab(key)
                  setPage(1)
                }}
              >
                {label}
                <span className="n">
                  {key === 'all' ? scope.length : scope.filter((l) => l.st === key).length}
                </span>
              </button>
            ))}
            <input
              className="inp"
              style={{ marginLeft: 'auto', maxWidth: 220 }}
              placeholder="Search by person"
              aria-label="Search by person"
              value={q}
              onChange={(e) => {
                setQ(e.target.value)
                setPage(1)
              }}
            />
          </div>

          {shown.length ? (
            <>
              <Card style={{ marginTop: 12 }}>
                <div className="tsc">
                  <div style={{ minWidth: 900 }}>
                    <div className="trow h" style={{ gridTemplateColumns: COLS }}>
                      <span>Person</span>
                      <span>Type</span>
                      <span>Principal</span>
                      <span>EMI</span>
                      <span>Balance</span>
                      <span>Next</span>
                      <span>Status</span>
                      <span />
                    </div>
                    <div className="tb">
                      {shown.map((l) => {
                        const person = STAFF.find((s) => s.id === l.who)
                        const due = scheduleFor(l, payments).find((r) => r.status === 'due')
                        const goTo = () => go({ to: '/loans/$loanId', params: { loanId: l.id } })
                        return (
                          <div
                            key={l.id}
                            className="trow"
                            role="button"
                            tabIndex={0}
                            style={{ gridTemplateColumns: COLS, cursor: 'pointer' }}
                            onClick={goTo}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') goTo()
                            }}
                          >
                            <div className="cell">
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <Avatar name={person?.n ?? whoName(l.who)} />
                                <div>
                                  <div className="v">{person?.n ?? whoName(l.who)}</div>
                                  {person?.dep.length ? <div className="s">{person.dep[0]}</div> : null}
                                </div>
                              </div>
                            </div>
                            <div className="cell">
                              <div className="v" style={{ fontSize: 'var(--t-small)' }}>
                                {LNKIND[l.kind][0]}
                              </div>
                            </div>
                            <div className="cell">
                              <div className="v mono">{inr(l.amt)}</div>
                            </div>
                            <div className="cell">
                              <div className="v mono">{inr(l.emi)}</div>
                            </div>
                            <div className="cell">
                              <div className="v mono">{inr(outstanding(l))}</div>
                            </div>
                            <div className="cell">
                              <div className="v" style={{ fontSize: 'var(--t-small)' }}>
                                {due ? due.due : '—'}
                              </div>
                            </div>
                            <div className="cell">
                              <Chip kind={LNSTATUS[l.st][1]}>{LNSTATUS[l.st][0]}</Chip>
                            </div>
                            <div className="cell" onClick={(e) => e.stopPropagation()}>
                              {canAll && l.st === 'requested' && l.who !== me.id ? (
                                <span style={{ display: 'flex', gap: 6 }}>
                                  <Btn variant="ghost" small onClick={() => confirm('reject', l)}>
                                    Reject
                                  </Btn>
                                  <Btn small onClick={() => confirm('approve', l)}>
                                    Approve
                                  </Btn>
                                </span>
                              ) : canAll && l.st === 'active' ? (
                                <Btn variant="ghost" small onClick={() => confirm('pause', l)}>
                                  Pause
                                </Btn>
                              ) : canAll && l.st === 'paused' ? (
                                <Btn small onClick={() => confirm('resume', l)}>
                                  Resume
                                </Btn>
                              ) : null}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              </Card>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
                <p className="gr" style={{ fontSize: 'var(--t-small)', margin: 0 }}>
                  Showing {shown.length} of {sorted.length}
                </p>
                {pageCount > 1 ? (
                  <div style={{ display: 'flex', gap: 6 }}>
                    <Btn variant="ghost" small disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                      Previous
                    </Btn>
                    <Btn
                      variant="ghost"
                      small
                      disabled={page >= pageCount}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      Next
                    </Btn>
                  </div>
                ) : null}
              </div>
            </>
          ) : (
            <Card padded style={{ marginTop: 12 }}>
              <Empty
                icon="₹"
                action={<Btn small onClick={() => go({ to: '/loans/new' })}>+ New request</Btn>}
              >
                {q || tab !== 'all' ? 'Nothing matches this filter.' : 'No loans or advances yet.'}
              </Empty>
            </Card>
          )}
        </div>

        {canAll ? (
          <aside>
            <Card padded style={{ position: 'sticky', top: 76 }}>
              <div className="lb">Payroll — {previewMonth} preview</div>
              <p className="gr" style={{ fontSize: 'var(--t-small)', marginTop: 4 }}>
                Deduction line-items this module will inject
              </p>
              {previewRows.length ? (
                <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
                  {previewRows.map((d) => (
                    <div key={d.loan.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--t-small)' }}>
                      <span>
                        {whoName(d.loan.who)} · {d.loan.kind === 'loan' ? 'EMI' : 'advance recovery'}
                      </span>
                      <span className="mono">{inr(d.amount)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="gr" style={{ fontSize: 'var(--t-small)', marginTop: 10 }}>
                  Nothing due next run.
                </p>
              )}
              <p style={{ fontSize: 'var(--t-small)', marginTop: 12 }} className="bnr v" >
                Injected automatically once the run advances — payslips print “Loan EMI ₹x · balance after
                ₹y”.
              </p>
            </Card>

            <Card padded style={{ marginTop: 16 }}>
              <div className="lb">Policy limits</div>
              <div style={{ display: 'grid', gap: 8, marginTop: 10, fontSize: 'var(--t-small)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Advance</span>
                  <b>≤ {LOAN_POLICY.advancePctOfNet}% of monthly net</b>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Loan</span>
                  <b>≤ {LOAN_POLICY.loanMultipleOfGross}× monthly gross</b>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Concurrent</span>
                  <b>1 loan + 1 advance</b>
                </div>
              </div>
              <div className="bnr r" style={{ marginTop: 12 }}>
                <span className="bi">⚑</span>
                <div style={{ fontSize: 'var(--t-small)' }}>
                  A request is decided by whoever holds pricing — never the person who asked for it.
                </div>
              </div>
            </Card>
          </aside>
        ) : null}
      </div>
    </>
  )
}

export default function LoansRoute() {
  return (
    <ErrorBoundary what="Loans & advances">
      <Loans />
    </ErrorBoundary>
  )
}
