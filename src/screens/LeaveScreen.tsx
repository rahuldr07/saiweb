import { useState } from 'react'
import { Banner, Btn, Card, CardHead, Chip, Kpi, Kpis, PageHead, Rows, SectionHead } from '@/components/ui'
import { DataTable, type DataRow } from '@/components/DataTable'
import { useSession } from '@/state/session'
import { useUi } from '@/state/ui'
import { LEAVE, LEAVETYPES, LEAVEPOLICY, LVSTATUS } from '@/data/hrms'
import type { Leave } from '@/data/types'
import { fmtDate } from '@/lib/format'
import { whoName } from '@/lib/permissions'
import { leaveBalance } from '@/lib/payroll'

const typeName = (k: string) => LEAVETYPES.find((t) => t.k === k)?.n ?? k

/** Requests, balances, and — for anyone who approves — the queue waiting on them. */
export default function LeaveScreen() {
  const { me, can } = useSession()
  const { toast, openModal } = useUi()
  const [decided, setDecided] = useState<Record<string, 'approved' | 'rejected'>>({})

  const canApprove = can('all') || can('people')
  const scope = canApprove ? LEAVE : LEAVE.filter((l) => l.who === me.id)
  const statusOf = (id: string, fallback: Leave['st']): Leave['st'] => decided[id] ?? fallback
  const pending = scope.filter((l) => statusOf(l.id, l.st) === 'pending')
  const bal = leaveBalance(me.id)

  const decide = (id: string, verdict: 'approved' | 'rejected') => {
    setDecided((d) => ({ ...d, [id]: verdict }))
    toast(verdict === 'approved' ? 'Leave approved' : 'Leave declined')
  }

  const open = (id: string) => {
    const l = scope.find((x) => x.id === id)
    if (!l) return
    const status = statusOf(l.id, l.st)
    openModal({
      title: `${whoName(l.who)} — ${typeName(l.type)}`,
      body: (
        <Rows>
          <div className="rw">
            <span className="gr">·</span>
            <span>
              <b>
                {fmtDate(l.from)} → {fmtDate(l.to)}
              </b>
              <div className="sd">
                {l.days} day{l.days === 1 ? '' : 's'} · {l.reason || 'no reason given'}
              </div>
            </span>
            <span>
              <Chip kind={LVSTATUS[status][1]}>{LVSTATUS[status][0]}</Chip>
            </span>
          </div>
          {l.by ? (
            <div className="rw">
              <span className="gr">·</span>
              <span>
                <b>Decided by</b>
                <div className="sd">{l.by}</div>
              </span>
              <span />
            </div>
          ) : null}
        </Rows>
      ),
      footer:
        canApprove && status === 'pending' ? (
          <>
            <Btn variant="danger" onClick={() => decide(l.id, 'rejected')}>
              Decline
            </Btn>
            <Btn onClick={() => decide(l.id, 'approved')}>Approve</Btn>
          </>
        ) : undefined,
    })
  }

  const rows: DataRow[] = scope.map((l) => {
    const status = statusOf(l.id, l.st)
    return {
      id: l.id,
      k: status,
      onClick: () => open(l.id),
      search: `${whoName(l.who)} ${typeName(l.type)} ${l.reason}`,
      c: [
        { v: whoName(l.who) },
        { v: typeName(l.type) },
        { v: `${fmtDate(l.from)} → ${fmtDate(l.to)}`, mono: true },
        { v: String(l.days), mono: true },
        { v: LVSTATUS[status][0], chip: LVSTATUS[status][1] },
        { v: l.reason || '—' },
      ],
    }
  })

  return (
    <>
      <PageHead
        title="Leave"
        sub={
          canApprove
            ? 'Every request, and the balances behind them.'
            : 'Your requests and what you have left.'
        }
        actions={<Btn onClick={() => toast('New leave request')}>＋ Request leave</Btn>}
      />

      {canApprove && pending.length ? (
        <Banner kind="r" icon="◷" title={`${pending.length} request${pending.length === 1 ? '' : 's'} awaiting a decision`}>
          Notice is {LEAVEPOLICY.noticeDays} days, and a department may not drop below {LEAVEPOLICY.minCover}{' '}
          person on cover.
        </Banner>
      ) : null}

      <SectionHead>My balances</SectionHead>
      <Kpis>
        {LEAVETYPES.map((t) => (
          <Kpi
            key={t.k}
            title={t.n}
            value={<span className="mono">{bal[t.k].left}</span>}
            detail={`${bal[t.k].taken} taken of ${bal[t.k].earned} earned`}
          />
        ))}
      </Kpis>

      <SectionHead>{canApprove ? 'Every leave request' : 'My requests'}</SectionHead>
      <DataTable
        noun="requests"
        min={960}
        search="Search a person or reason"
        pills={[
          { key: 'all', label: 'All', count: scope.length },
          { key: 'pending', label: 'Awaiting approval', count: pending.length, urgent: true },
          {
            key: 'approved',
            label: 'Approved',
            count: scope.filter((l) => statusOf(l.id, l.st) === 'approved').length,
          },
          {
            key: 'rejected',
            label: 'Declined',
            count: scope.filter((l) => statusOf(l.id, l.st) === 'rejected').length,
          },
        ]}
        cols={[
          { l: 'Person', w: 170 },
          { l: 'Type', w: 150 },
          { l: 'Dates', w: 210 },
          { l: 'Days', w: 80 },
          { l: 'Status', w: 160 },
          { l: 'Reason', w: 200, f: 1.4 },
        ]}
        rows={rows}
        emptyText="No leave requests match this filter."
      />

      <Card style={{ marginTop: 20 }}>
        <CardHead title="How leave works here" />
        <Rows>
          {LEAVETYPES.map((t) => (
            <div className="rw" key={t.k}>
              <span className="gr">·</span>
              <span>
                <b>{t.n}</b>
                <div className="sd">{t.d}</div>
              </span>
              <span className="mono gr" style={{ fontSize: '11.5px' }}>
                {t.annual}/yr
              </span>
            </div>
          ))}
        </Rows>
      </Card>
    </>
  )
}
