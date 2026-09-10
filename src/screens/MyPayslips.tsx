import { useMemo } from 'react'
import { useGo } from '@/lib/nav'
import { Btn, Card, Kpi, Kpis, PageHead, SectionHead, focusSection } from '@/components/ui'
import { LoanCard } from '@/components/LoanCard'
import { useSession } from '@/state/session'
import { PAYMONTHS, PAYRUNS } from '@/data/hrms'
import { inr, payslipOf, ytd } from '@/lib/payroll'
import { usePayslipDownloads } from './payslips/usePayslipDownloads'

const COLS = '150px 140px 140px 140px 1fr'

export default function MyPayslips() {
  const { me } = useSession()
  const navigate = useGo()
  const download = usePayslipDownloads()

  const published = useMemo(() => PAYMONTHS.filter((m) => PAYRUNS[m]?.published).reverse(), [])
  const pending = useMemo(() => PAYMONTHS.filter((m) => !PAYRUNS[m]?.published), [])

  const openPayslip = (month: string) =>
    navigate({ to: '/payslips/$personId', params: { personId: me.id }, search: { m: month } })

  if (!me.ctc) {
    return (
      <>
        <PageHead title="My payslips" />
        <Card padded style={{ maxWidth: 560 }}>
          <p style={{ fontSize: 'var(--t-body)', margin: 0 }}>
            There is no salary on your record yet, so no payslip has been produced. Whoever runs
            payroll can set it.
          </p>
        </Card>
      </>
    )
  }

  const newest = published[0]
  const latest = newest ? payslipOf(me, newest) : null
  const year = newest ? ytd(me, newest) : null

  return (
    <>
      <PageHead
        title="My payslips"
        sub={`${me.n} · ${published.length} published`}
        actions={newest ? <Btn onClick={() => openPayslip(newest)}>Open {newest}</Btn> : undefined}
      />

      {latest && year && newest ? (
        <Kpis>
          <Kpi
            title="Last net pay"
            value={inr(latest.net)}
            valueTone="ok"
            valueSize={23}
            detail={newest}
            hint="Open that payslip"
            onClick={() => openPayslip(newest)}
          />
          <Kpi
            title="Gross that month"
            value={inr(latest.gross)}
            valueSize={23}
            detail="before deductions"
            hint="Open that payslip"
            onClick={() => openPayslip(newest)}
          />
          <Kpi
            title="Deducted this year"
            value={inr(year.ded)}
            valueTone="warn"
            valueSize={23}
            detail={`of which ${inr(year.tds)} tax`}
          />
          <Kpi
            title="Received this year"
            value={inr(year.net)}
            valueSize={23}
            detail={`across ${published.length} month${published.length === 1 ? '' : 's'}`}
            hint="Month by month"
            onClick={() => focusSection('mpList')}
          />
        </Kpis>
      ) : null}

      <LoanCard personId={me.id} />

      <SectionHead id="mpList">Every payslip</SectionHead>

      {published.length ? (
        <Card>
          <div className="tsc">
            <div style={{ minWidth: 760 }}>
              <div className="trow h" style={{ gridTemplateColumns: COLS }}>
                <span>Month</span>
                <span>Gross</span>
                <span>Deductions</span>
                <span>Net pay</span>
                <span />
              </div>
              <div className="tb">
                {published.map((m) => {
                  const s = payslipOf(me, m)
                  return (
                    <div
                      key={m}
                      className="trow"
                      role="button"
                      tabIndex={0}
                      style={{ gridTemplateColumns: COLS, cursor: 'pointer' }}
                      onClick={() => openPayslip(m)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          openPayslip(m)
                        }
                      }}
                    >
                      <div className="cell">
                        <div className="v">{m}</div>
                        {s.a.lop ? (
                          <div className="s warn">
                            {s.a.lop} unpaid day{s.a.lop === 1 ? '' : 's'}
                          </div>
                        ) : null}
                      </div>
                      <div className="cell">
                        <div className="v mono">{inr(s.gross)}</div>
                      </div>
                      <div className="cell">
                        <div className="v mono warn">{inr(s.totalDed)}</div>
                      </div>
                      <div className="cell">
                        <div className="v mono ok" style={{ fontWeight: 650 }}>
                          {inr(s.net)}
                        </div>
                      </div>
                      <div className="cell">
                        <Btn
                          variant="ghost"
                          small
                          aria-label={`Download the ${m} payslip`}
                          onClick={(e) => {
                            e.stopPropagation()
                            download.payslip(me, m)
                          }}
                        >
                          Download
                        </Btn>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </Card>
      ) : (
        <Card padded>
          <p className="gr" style={{ fontSize: 'var(--t-small)', margin: 0 }}>
            Nothing published yet.
          </p>
        </Card>
      )}

      {pending.length ? (
        <p className="gr" style={{ fontSize: 'var(--t-small)', marginTop: 10 }}>
          {pending.join(', ')} {pending.length === 1 ? 'is' : 'are'} not published yet.{' '}
          {pending.length === 1 ? 'It' : 'They'} will appear here once payroll is approved and
          released — you are not missing anything.
        </p>
      ) : null}
    </>
  )
}
