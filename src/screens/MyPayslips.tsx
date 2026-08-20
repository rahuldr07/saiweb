import { useNavigate } from '@tanstack/react-router'
import { Card, CardHead, Chip, Kpi, Kpis, PageHead, Rows, SectionHead } from '@/components/ui'
import { useSession } from '@/state/session'
import { PAYMONTHS, PAYRUNS } from '@/data/hrms'
import { inr, leaveBalance, payslipOf, structureOf, ytd } from '@/lib/payroll'

/** A person's own payslip history. No comparison to anyone else appears here. */
export default function MyPayslips() {
  const { me } = useSession()
  const navigate = useNavigate()

  if (!me.ctc) {
    return (
      <>
        <PageHead title="My payslips" sub="Nothing on payroll for this account." />
        <Card padded>
          <p style={{ fontSize: '13.5px', margin: 0 }}>
            {me.n} has no salary record, so there are no payslips to show.
          </p>
        </Card>
      </>
    )
  }

  const latest = PAYMONTHS[PAYMONTHS.length - 1]
  const st = structureOf(me)
  const year = ytd(me, latest)
  const bal = leaveBalance(me.id)

  /* Opens the payslip itself. A modal that restates half of one is a second
     version of the document to keep right. */
  const open = (mn: string) =>
    navigate({ to: '/payslips/$personId', params: { personId: me.id }, search: { m: mn } })
  return (
    <>
      <PageHead title="My payslips" sub={`${me.n} · ${me.dep.join(', ') || 'No department'}`} />

      <Kpis>
        <Kpi
          title="Monthly gross"
          value={<span className="mono">{inr(st.gross)}</span>}
          detail="before deductions"
        />
        <Kpi
          title="Net this month"
          value={<span className="mono ok">{inr(payslipOf(me, latest).net)}</span>}
          detail={latest}
        />
        <Kpi
          title="Paid year to date"
          value={<span className="mono">{inr(year.net)}</span>}
          detail={`tax ${inr(year.tds)}`}
        />
        <Kpi
          title="Paid leave left"
          value={<span className="mono">{bal.pl.left}</span>}
          detail={`of ${bal.pl.annual} a year`}
        />
      </Kpis>

      <SectionHead>Every payslip</SectionHead>
      <Card>
        <CardHead title={`${PAYMONTHS.length} months`} />
        <Rows>
          {[...PAYMONTHS].reverse().map((mn) => {
            const s = payslipOf(me, mn)
            const run = PAYRUNS[mn]
            return (
              <button
                key={mn}
                type="button"
                className="rw"
                style={{ width: '100%' }}
                onClick={() => open(mn)}
              >
                <span className="gr">▤</span>
                <span>
                  <b>{mn}</b>
                  <div className="sd">
                    gross {inr(s.gross)} · deductions {inr(s.totalDed)}
                  </div>
                </span>
                <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span className="mono">{inr(s.net)}</span>
                  <Chip kind={run?.published ? 'v' : 'n'}>{run?.published ? 'Published' : 'Pending'}</Chip>
                </span>
              </button>
            )
          })}
        </Rows>
      </Card>
    </>
  )
}
