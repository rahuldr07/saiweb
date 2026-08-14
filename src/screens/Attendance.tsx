import { useState } from 'react'
import { Btn, Kpi, Kpis, PageHead, SectionHead, Seg } from '@/components/ui'
import { RequireCap } from '@/components/RequireCap'
import { DataTable, type DataRow } from '@/components/DataTable'
import { useUi } from '@/state/ui'
import { ATT, PAYMONTHS } from '@/data/hrms'
import { AVAIL, HOLIDAYS, SHIFTS, STAFF } from '@/data/people'
import { csvName, downloadCSV } from '@/lib/csv'

const shiftOf = (k: string) => SHIFTS.find((s) => s.k === k) ?? SHIFTS[0]

/** Availability today, and the month's roll-up per person. */
function Attendance() {
  const { toast } = useUi()
  const [month, setMonth] = useState(PAYMONTHS[PAYMONTHS.length - 1])

  const roll = ATT[month] ?? {}
  const people = STAFF.filter((s) => s.active !== false)

  const available = people.filter((p) => p.avail === 'ok').length
  const onLeave = people.filter((p) => p.avail === 'leave').length
  const offShift = people.filter((p) => p.avail === 'shift').length
  const holidays = HOLIDAYS.filter((h) => {
    const [m, , y] = h.d.split('/').map(Number)
    const [mon, yr] = month.split(' ')
    return (
      ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m - 1] === mon &&
      String(y) === yr
    )
  })

  const rows: DataRow[] = people.map((p) => {
    const a = roll[p.id]
    return {
      id: p.id,
      k: p.avail,
      search: `${p.n} ${p.dep.join(' ')}`,
      c: [
        { v: p.n, s: p.dep.join(', ') || 'No department' },
        { v: shiftOf(p.shift).n, s: `${shiftOf(p.shift).from}–${shiftOf(p.shift).to}` },
        { v: AVAIL[p.avail][0], chip: AVAIL[p.avail][1] },
        { v: a ? String(a.present) : '—', mono: true, s: a ? `of ${a.working} working days` : undefined },
        { v: a ? String(a.paidLeave) : '—', mono: true },
        { v: a ? String(a.lop) : '—', mono: true, bad: !!a?.lop, s: a?.lop ? 'unpaid' : undefined },
        { v: a ? String(a.payable) : '—', mono: true },
      ],
    }
  })

  const exportRoll = () => {
    const out = downloadCSV(csvName(`attendance-${month.replace(' ', '-')}`), [
      ['Person', 'Departments', 'Shift', 'Available', 'Present', 'Working days', 'Paid leave', 'Unpaid', 'Payable'],
      ...people.map((p) => {
        const a = roll[p.id]
        return [
          p.n,
          p.dep.join(' / '),
          shiftOf(p.shift).n,
          AVAIL[p.avail][0],
          a?.present ?? '',
          a?.working ?? '',
          a?.paidLeave ?? '',
          a?.lop ?? '',
          a?.payable ?? '',
        ]
      }),
    ])
    toast(`${out.name} — ${out.rows.length - 1} rows`)
  }

  return (
    <>
      <PageHead
        title="Attendance"
        sub="Who is available today, and what the month adds up to for payroll."
        actions={
          <>
            <Seg options={PAYMONTHS.map((m) => [m, m] as [string, string])} value={month} onChange={setMonth} />
            <Btn variant="ghost" onClick={exportRoll}>
              Export
            </Btn>
          </>
        }
      />

      <SectionHead>Who is in today</SectionHead>
      <Kpis>
        <Kpi title="Available today" value={<span className="ok">{available}</span>} detail={`of ${people.length} people`} />
        <Kpi title="On leave" value={<span className={onLeave ? 'warn' : 'ok'}>{onLeave}</span>} detail="approved absence" />
        <Kpi title="Off shift" value={offShift} detail="not in their window" />
        <Kpi title="Holidays" value={holidays.length} detail={holidays.map((h) => h.n).join(', ') || 'none this month'} />
      </Kpis>

      <div style={{ marginTop: 20 }}>
        <DataTable
          noun="people"
          min={1060}
          search="Search a person"
          pills={[
            { key: 'all', label: 'Everyone', count: people.length },
            { key: 'ok', label: 'Available', count: available },
            { key: 'leave', label: 'On leave', count: onLeave },
            { key: 'shift', label: 'Off shift', count: offShift },
          ]}
          cols={[
            { l: 'Person', w: 180, f: 1.3 },
            { l: 'Shift', w: 140 },
            { l: 'Today', w: 130 },
            { l: 'Present', w: 120 },
            { l: 'Paid leave', w: 110 },
            { l: 'Unpaid', w: 100 },
            { l: 'Payable days', w: 120 },
          ]}
          rows={rows}
          emptyText="Nobody matches this filter."
        />
      </div>

      <p className="gr" style={{ fontSize: '12.5px', marginTop: 12 }}>
        Payable days feed payroll directly — an unpaid day here becomes a deduction there, without anyone
        re-typing it.
      </p>
    </>
  )
}

export default function AttendanceRoute() {
  return (
    <RequireCap cap="all">
      <Attendance />
    </RequireCap>
  )
}
