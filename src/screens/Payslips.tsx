import { useState } from 'react'
import { Btn, PageHead, Rows } from '@/components/ui'
import { RequireCap } from '@/components/RequireCap'
import { DataTable, type DataRow } from '@/components/DataTable'
import { useUi } from '@/state/ui'
import { PAYMONTHS, PAYRUNS } from '@/data/hrms'
import { inr, paidStaff, payslipOf } from '@/lib/payroll'
import { csvName, downloadCSV } from '@/lib/csv'

/** Every payslip across people and months — the register, not one person's history. */
function Payslips() {
  const { toast, openModal } = useUi()
  const [month, setMonth] = useState('all')
  const people = paidStaff()

  const all = PAYMONTHS.flatMap((mn) =>
    people.map((p) => ({ mn, p, slip: payslipOf(p, mn), run: PAYRUNS[mn] })),
  ).filter((r) => month === 'all' || r.mn === month)

  const open = (r: (typeof all)[number]) =>
    openModal({
      title: `${r.p.n} — ${r.mn}`,
      body: (
        <Rows>
          {r.slip.earn.map(([k, v]) => (
            <div className="rw" key={k}>
              <span className="gr">+</span>
              <span>
                <b>{k}</b>
              </span>
              <span className="mono">{inr(v)}</span>
            </div>
          ))}
          {r.slip.ded.map(([k, v]) => (
            <div className="rw" key={k}>
              <span className="bad">−</span>
              <span>
                <b>{k}</b>
              </span>
              <span className="mono bad">{inr(v)}</span>
            </div>
          ))}
          <div className="rw">
            <span className="ok">=</span>
            <span>
              <b>Net pay</b>
            </span>
            <span className="mono ok">{inr(r.slip.net)}</span>
          </div>
        </Rows>
      ),
      footer: (
        <Btn variant="ghost" onClick={() => toast(`${r.mn} payslip queued`)}>
          Download
        </Btn>
      ),
    })

  const rows: DataRow[] = all.map((r) => ({
    id: `${r.mn}|${r.p.id}`,
    k: r.run?.published ? 'published' : 'draft',
    onClick: () => open(r),
    search: `${r.p.n} ${r.mn}`,
    c: [
      { v: r.p.n, s: r.p.dep.join(', ') || 'No department' },
      { v: r.mn, mono: true },
      { v: inr(r.slip.gross), mono: true },
      { v: inr(r.slip.totalDed), mono: true },
      { v: inr(r.slip.net), mono: true },
      { v: r.run?.published ? 'Published' : 'Not published', chip: r.run?.published ? 'v' : 'n' },
    ],
  }))

  const exportAll = () => {
    const out = downloadCSV(csvName('payslips'), [
      ['Person', 'Month', 'Gross', 'Deductions', 'Net', 'Published'],
      ...all.map((r) => [
        r.p.n,
        r.mn,
        r.slip.gross,
        r.slip.totalDed,
        r.slip.net,
        r.run?.published ? 'yes' : 'no',
      ]),
    ])
    toast(`${out.name} — ${out.rows.length - 1} rows`)
  }

  return (
    <>
      <PageHead
        title="Payslips"
        sub="Every payslip issued, across people and months."
        actions={
          <Btn variant="ghost" onClick={exportAll}>
            Export
          </Btn>
        }
      />
      <DataTable
        noun="payslips"
        min={980}
        search="Search a person or month"
        filters={[
          {
            label: 'Month',
            value: month,
            onChange: setMonth,
            options: [['all', 'All months'], ...PAYMONTHS.map((m) => [m, m] as [string, string])],
          },
        ]}
        pills={[
          { key: 'all', label: 'All', count: all.length },
          { key: 'published', label: 'Published', count: all.filter((r) => r.run?.published).length },
          { key: 'draft', label: 'Not published', count: all.filter((r) => !r.run?.published).length },
        ]}
        cols={[
          { l: 'Person', w: 180, f: 1.2 },
          { l: 'Month', w: 110 },
          { l: 'Gross', w: 120 },
          { l: 'Deductions', w: 120 },
          { l: 'Net pay', w: 120 },
          { l: 'Status', w: 130 },
        ]}
        rows={rows}
        emptyText="No payslips match this filter."
      />
    </>
  )
}

export default function PayslipsRoute() {
  return (
    <RequireCap cap="pricing">
      <Payslips />
    </RequireCap>
  )
}
