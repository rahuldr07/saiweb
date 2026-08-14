import { useState } from 'react'
import { Banner, Btn, Card, Kpi, Kpis, PageHead, Rows, SectionHead, Seg } from '@/components/ui'
import { RequireCap } from '@/components/RequireCap'
import { DataTable, type DataRow } from '@/components/DataTable'
import { useUi } from '@/state/ui'
import { PAYMONTHS, PAYRUNS, RUNSTATE, RUNSTEPS, PAYCFG } from '@/data/hrms'
import type { RunState } from '@/data/types'
import { inr, paidStaff, payslipOf } from '@/lib/payroll'
import { csvName, downloadCSV } from '@/lib/csv'

/** A month moves through draft → locked → approved → paid, and cannot go back without a reason. */
function Payroll() {
  const { toast } = useUi()
  const [month, setMonth] = useState(PAYMONTHS[PAYMONTHS.length - 1])
  const run = PAYRUNS[month]
  const ORDER: RunState[] = ['draft', 'locked', 'approved', 'paid']
  const [state, setState] = useState<RunState>(run?.state ?? 'draft')
  const next = ORDER[ORDER.indexOf(state) + 1]

  const people = paidStaff()
  const slips = people.map((p) => payslipOf(p, month))
  const gross = slips.reduce((a, s) => a + s.gross, 0)
  const ded = slips.reduce((a, s) => a + s.totalDed, 0)
  const net = slips.reduce((a, s) => a + s.net, 0)

  const [label, kind, note] = RUNSTATE[state] ?? RUNSTATE.draft

  const rows: DataRow[] = slips.map((s) => ({
    id: s.p.id,
    search: `${s.p.n} ${s.p.dep.join(' ')}`,
    c: [
      { v: s.p.n, s: s.p.dep.join(', ') || 'No department' },
      { v: inr(s.st.gross), mono: true, s: 'monthly gross' },
      { v: s.unpaid ? `${s.unpaid} unpaid` : 'full month', s: `${s.st.basic ? 'basic ' + inr(s.st.basic) : ''}` },
      { v: inr(s.totalDed), mono: true, s: `PF ${inr(s.epf)} · TDS ${inr(s.tds)}` },
      { v: inr(s.net), mono: true },
    ],
  }))

  const advance = () => {
    if (!next) return
    setState(next)
    toast(`${month} — ${RUNSTATE[next][0].toLowerCase()}`)
  }

  const exportRun = () => {
    const out = downloadCSV(csvName(`payroll-${month.replace(' ', '-')}`), [
      ['Person', 'Departments', 'Gross', 'Deductions', 'PF', 'TDS', 'Net'],
      ...slips.map((s) => [s.p.n, s.p.dep.join(' / '), s.gross, s.totalDed, s.epf, s.tds, s.net]),
    ])
    toast(`${out.name} — ${out.rows.length - 1} rows`)
  }

  return (
    <>
      <PageHead
        title="Payroll"
        sub={`${people.length} people on payroll. Figures derive from each person's CTC, this month's attendance, and the statutory settings — nothing is typed twice.`}
        actions={
          <>
            <Seg
              options={PAYMONTHS.map((m) => [m, m] as [string, string])}
              value={month}
              onChange={(m) => {
                setMonth(m)
                setState(PAYRUNS[m]?.state ?? 'draft')
              }}
            />
            <Btn variant="ghost" onClick={exportRun}>
              Export
            </Btn>
          </>
        }
      />

      <Banner
        kind={kind === 'v' ? 'v' : kind === 'r' ? 'r' : 'b'}
        icon="₹"
        title={`${month} — ${label}`}
        actions={next ? <Btn onClick={advance}>Move to {RUNSTATE[next][0].toLowerCase()}</Btn> : undefined}
      >
        {note}
      </Banner>

      <Kpis>
        <Kpi title="People" value={people.length} detail="on payroll this month" />
        <Kpi title="Gross" value={<span className="mono">{inr(gross)}</span>} detail="before deductions" />
        <Kpi title="Deductions" value={<span className="mono">{inr(ded)}</span>} detail="PF, ESI, PT and TDS" />
        <Kpi title="Net payable" value={<span className="mono ok">{inr(net)}</span>} detail={`credited on the ${PAYCFG.payDay}${PAYCFG.payDay === 1 ? 'st' : 'th'}`} />
      </Kpis>

      <SectionHead>What the run does</SectionHead>
      <Card>
        <Rows>
          {RUNSTEPS.map(([title, detail], i) => (
            <div className="rw" key={title}>
              <span className="stepn">
                <span className="sn">{i + 1}</span>
              </span>
              <span>
                <b>{title}</b>
                <div className="sd">{detail}</div>
              </span>
              <span />
            </div>
          ))}
        </Rows>
      </Card>

      <SectionHead>{month}</SectionHead>
      <DataTable
        noun="people"
        min={900}
        search="Search a person"
        cols={[
          { l: 'Person', w: 190, f: 1.3 },
          { l: 'Monthly gross', w: 130 },
          { l: 'Attendance', w: 140 },
          { l: 'Deductions', w: 150 },
          { l: 'Net pay', w: 130 },
        ]}
        rows={rows}
        emptyText="Nobody on payroll matches this search."
      />
    </>
  )
}

export default function PayrollRoute() {
  return (
    <RequireCap cap="pricing">
      <Payroll />
    </RequireCap>
  )
}
