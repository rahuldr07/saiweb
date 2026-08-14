import { useState } from 'react'
import { Btn, Chip, Kpi, Kpis, PageHead, Rows, SectionHead } from '@/components/ui'
import { RequireCap } from '@/components/RequireCap'
import { DataTable, type DataRow } from '@/components/DataTable'
import { useUi } from '@/state/ui'
import { INVOICES, ISTATUS } from '@/data/business'
import { CLIENTS } from '@/data/catalog'
import { PAYMONTHS } from '@/data/hrms'
import { fmtDate, money } from '@/lib/format'
import { csvName, downloadCSV } from '@/lib/csv'

/** Client money is USD. A month's invoice per client, drawn from delivered orders. */
function Invoicing() {
  const { toast, openModal } = useUi()
  const [client, setClient] = useState('all')
  const [month, setMonth] = useState('all')
  const [pill, setPill] = useState('all')

  const base = INVOICES.filter(
    (i) => (client === 'all' || i.cl === client) && (month === 'all' || i.m === month),
  )

  const outstanding = base.filter((i) => i.st !== 'paid').reduce((a, i) => a + (i.amt - i.paid), 0)
  const overdue = base.filter((i) => i.st === 'overdue').reduce((a, i) => a + (i.amt - i.paid), 0)
  const collected = base.reduce((a, i) => a + i.paid, 0)

  const open = (id: string) => {
    const i = base.find((x) => x.id === id)
    if (!i) return
    openModal({
      title: i.id,
      body: (
        <Rows>
          <div className="rw">
            <span className="gr">·</span>
            <span>
              <b>{i.cl}</b>
              <div className="sd">{i.m} · issued {fmtDate(i.issued)}</div>
            </span>
            <span>
              <Chip kind={ISTATUS[i.st][1]}>{ISTATUS[i.st][0]}</Chip>
            </span>
          </div>
          <div className="rw">
            <span className="gr">☰</span>
            <span>
              <b>{i.orders} orders</b>
              <div className="sd">billed at the client’s rate card</div>
            </span>
            <span className="mono">{money(i.amt)}</span>
          </div>
          <div className="rw">
            <span className="ok">✓</span>
            <span>
              <b>Paid</b>
            </span>
            <span className="mono ok">{money(i.paid)}</span>
          </div>
          <div className="rw">
            <span className={i.amt - i.paid ? 'bad' : 'gr'}>·</span>
            <span>
              <b>Outstanding</b>
            </span>
            <span className={`mono${i.amt - i.paid ? ' bad' : ''}`}>{money(i.amt - i.paid)}</span>
          </div>
        </Rows>
      ),
    })
  }

  const rows: DataRow[] = base.map((i) => ({
    id: i.id,
    k: i.st === 'paid' ? 'paid' : i.st === 'overdue' ? ['owing', 'overdue'] : 'owing',
    onClick: () => open(i.id),
    search: `${i.id} ${i.cl} ${i.m}`,
    c: [
      { v: i.id, mono: true, s: i.m },
      { v: i.cl },
      { v: String(i.orders), mono: true },
      { v: money(i.amt), mono: true },
      { v: money(i.amt - i.paid), mono: true, bad: i.st === 'overdue', s: i.paid ? `${money(i.paid)} paid` : undefined },
      { v: ISTATUS[i.st][0], chip: ISTATUS[i.st][1] },
      { v: fmtDate(i.issued), mono: true },
    ],
  }))

  const exportInvoices = () => {
    const out = downloadCSV(csvName('invoices'), [
      ['Invoice', 'Client', 'Month', 'Orders', 'Amount', 'Paid', 'Outstanding', 'Status', 'Issued'],
      ...base.map((i) => [
        i.id,
        i.cl,
        i.m,
        i.orders,
        i.amt,
        i.paid,
        i.amt - i.paid,
        ISTATUS[i.st][0],
        fmtDate(i.issued),
      ]),
    ])
    toast(`${out.name} — ${out.rows.length - 1} rows`)
  }

  return (
    <>
      <PageHead
        title="Invoicing"
        sub="One invoice per client per month, drawn from delivered orders at that client’s rate card."
        actions={
          <>
            <Btn variant="ghost" onClick={exportInvoices}>
              Export CSV
            </Btn>
            <Btn onClick={() => toast('Generating this month’s invoices')}>＋ Generate month</Btn>
          </>
        }
      />

      <SectionHead>Money owed and collected</SectionHead>
      <Kpis>
        <Kpi title="Outstanding" value={<span className="mono">{money(outstanding)}</span>} detail="not yet paid" />
        <Kpi
          title="Overdue"
          value={<span className="mono bad">{money(overdue)}</span>}
          tone={overdue ? 'alert' : undefined}
          detail="past the terms"
        />
        <Kpi title="Collected" value={<span className="mono ok">{money(collected)}</span>} detail="against these invoices" />
        <Kpi title="Invoices" value={base.length} detail={`across ${new Set(base.map((i) => i.cl)).size} clients`} />
      </Kpis>

      <div style={{ marginTop: 20 }}>
        <DataTable
          noun="invoices"
          min={1000}
          search="Search invoice # or client"
          activePill={pill}
          onPill={setPill}
          filters={[
            {
              label: 'Client',
              value: client,
              onChange: setClient,
              options: [['all', 'All clients'], ...CLIENTS.map((c) => [c.n, c.n] as [string, string])],
            },
            {
              label: 'Month',
              value: month,
              onChange: setMonth,
              options: [['all', 'All months'], ...PAYMONTHS.map((m) => [m, m] as [string, string])],
            },
          ]}
          pills={[
            { key: 'all', label: 'All', count: base.length },
            { key: 'owing', label: 'Owing', count: base.filter((i) => i.st !== 'paid').length },
            {
              key: 'overdue',
              label: 'Overdue',
              count: base.filter((i) => i.st === 'overdue').length,
              urgent: true,
            },
            { key: 'paid', label: 'Paid', count: base.filter((i) => i.st === 'paid').length },
          ]}
          cols={[
            { l: 'Invoice', w: 150 },
            { l: 'Client', w: 120 },
            { l: 'Orders', w: 90 },
            { l: 'Amount', w: 120 },
            { l: 'Outstanding', w: 140 },
            { l: 'Status', w: 130 },
            { l: 'Issued', w: 110 },
          ]}
          rows={rows}
          emptyText="No invoices match this filter."
        />
      </div>
    </>
  )
}

export default function InvoicingRoute() {
  return (
    <RequireCap cap="pricing">
      <Invoicing />
    </RequireCap>
  )
}
