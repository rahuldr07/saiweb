import { useState } from 'react'
import { useParams, useSearch } from '@tanstack/react-router'
import {
  Btn,
  Card,
  Chip,
  KeyValues,
  NotFoundRecord,
  PageHead,
  Tabs,
  Timeline,
  type TimelineEntry,
} from '@/components/ui'
import { useSession } from '@/state/session'
import { LNKIND, LNSTATUS } from '@/data/loans'
import { STAFF } from '@/data/people'
import { whoName } from '@/lib/permissions'
import { inr } from '@/lib/payroll'
import { fmtDT } from '@/lib/format'
import { useGo } from '@/lib/nav'
import { activityFor, outstanding, scheduleFor } from '@/lib/loans'
import { useLoanConfirm } from './loans/confirm'
import { useLoans } from '@/state/loans'

const TABS = ['Overview', 'Schedule', 'Activity'] as const
type Tab = (typeof TABS)[number]

const isTab = (v: unknown): v is Tab => TABS.includes(v as Tab)

export default function LoanDetail() {
  const { loanId } = useParams({ from: '/loans/$loanId' })
  const { tab: tabParam } = useSearch({ from: '/loans/$loanId' })
  const go = useGo()
  const { me, can } = useSession()
  const { loans, payments, events } = useLoans()
  const confirm = useLoanConfirm()

  const [tab, setTab] = useState<Tab>(isTab(tabParam) ? tabParam : 'Overview')

  const loan = loans.find((l) => l.id === loanId)
  const canAll = can('pricing')
  const visible = loan && (loan.who === me.id || canAll)

  if (!loan || !visible) {
    return <NotFoundRecord what="loan or advance" backTo="/loans" backLabel="Loans & advances" />
  }

  const person = STAFF.find((s) => s.id === loan.who)
  const schedule = scheduleFor(loan, payments)
  const activity = activityFor(loan.id, events, payments)

  const ACTION_LABEL: Record<string, string> = {
    requested: 'Requested',
    approved: 'Approved',
    rejected: 'Rejected',
    paused: 'Paused',
    resumed: 'Resumed',
    closed: 'Closed',
  }

  const timeline: TimelineEntry[] = activity.map((a, i) => ({
    id: `${a.kind}-${i}`,
    when: fmtDT(a.at),
    who: a.kind === 'event' ? whoName(a.event!.by) : `Payroll — ${a.payment!.mn}`,
    what:
      a.kind === 'event'
        ? `${ACTION_LABEL[a.event!.action]}${a.event!.note ? ` — ${a.event!.note}` : ''}`
        : `${inr(a.payment!.amt)} recovered`,
  }))

  const actions =
    canAll && loan.st === 'requested' && loan.who !== me.id ? (
      <>
        <Btn variant="ghost" onClick={() => confirm('reject', loan)}>
          Reject
        </Btn>
        <Btn onClick={() => confirm('approve', loan)}>Approve</Btn>
      </>
    ) : canAll && loan.st === 'active' ? (
      <Btn variant="ghost" onClick={() => confirm('pause', loan)}>
        Pause
      </Btn>
    ) : canAll && loan.st === 'paused' ? (
      <Btn onClick={() => confirm('resume', loan)}>Resume</Btn>
    ) : undefined

  return (
    <>
      <PageHead
        parent={{ to: '/loans', label: 'Loans & advances' }}
        title={`${person?.n ?? whoName(loan.who)} — ${LNKIND[loan.kind][0]}`}
        sub={<Chip kind={LNSTATUS[loan.st][1]}>{LNSTATUS[loan.st][0]}</Chip>}
        actions={actions}
      />

      <Tabs
        tabs={[...TABS]}
        value={tab}
        onChange={(t) => {
          setTab(t)
          go({ to: '/loans/$loanId', params: { loanId: loan.id }, search: { tab: t }, replace: true })
        }}
      />

      {tab === 'Overview' ? (
        <Card padded style={{ marginTop: 14, maxWidth: 640 }}>
          <KeyValues
            rows={[
              ['Person', person?.n ?? whoName(loan.who)],
              ['Department', person?.dep.join(', ') ?? '—'],
              ['Type', LNKIND[loan.kind][0]],
              ['Principal', inr(loan.amt)],
              ['EMI', inr(loan.emi)],
              ['Paid so far', inr(loan.paid)],
              ['Balance', inr(outstanding(loan))],
              ['Requested', fmtDT(loan.reqAt)],
              ...(loan.decidedBy
                ? ([['Decided by', `${whoName(loan.decidedBy)} · ${loan.decidedAt ? fmtDT(loan.decidedAt) : '—'}`]] as [
                    string,
                    string,
                  ][])
                : []),
              ...(loan.takenOn ? ([['Disbursed', fmtDT(loan.takenOn)]] as [string, string][]) : []),
              ['Purpose', loan.note],
            ]}
          />
        </Card>
      ) : null}

      {tab === 'Schedule' ? (
        <Card style={{ marginTop: 14 }}>
          {schedule.length ? (
            <div className="tsc">
              <div style={{ minWidth: 500 }}>
                <div className="trow h" style={{ gridTemplateColumns: '60px 1fr 140px 120px' }}>
                  <span>#</span>
                  <span>Due</span>
                  <span>Amount</span>
                  <span>Status</span>
                </div>
                <div className="tb">
                  {schedule.map((r) => (
                    <div className="trow" style={{ gridTemplateColumns: '60px 1fr 140px 120px' }} key={r.seq}>
                      <div className="cell">
                        <div className="v mono">{r.seq}</div>
                      </div>
                      <div className="cell">
                        <div className="v">{r.due}</div>
                      </div>
                      <div className="cell">
                        <div className="v mono">{inr(r.amount)}</div>
                      </div>
                      <div className="cell">
                        <Chip kind={r.status === 'paid' ? 'v' : r.status === 'due' ? 'r' : 'n'}>
                          {r.status === 'paid' ? 'Paid' : r.status === 'due' ? 'Due next' : 'Upcoming'}
                        </Chip>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <p className="gr" style={{ fontSize: 'var(--t-small)', padding: 16, margin: 0 }}>
              No schedule until this request is approved.
            </p>
          )}
        </Card>
      ) : null}

      {tab === 'Activity' ? (
        <Card padded style={{ marginTop: 14 }}>
          {timeline.length ? (
            <Timeline entries={timeline} />
          ) : (
            <p className="gr" style={{ fontSize: 'var(--t-small)', margin: 0 }}>
              Nothing recorded yet.
            </p>
          )}
        </Card>
      ) : null}
    </>
  )
}
