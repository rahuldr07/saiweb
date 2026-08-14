import { useMemo, useState } from 'react'
import { Banner, Btn, Field, Form, Kpi, Kpis, PageHead } from '@/components/ui'
import { RequireCap } from '@/components/RequireCap'
import { DataTable, type DataRow } from '@/components/DataTable'
import { useUi } from '@/state/ui'
import { PETTY, PETTYCFG } from '@/data/hrms'
import type { PettyEntry } from '@/data/types'
import { fmtDate } from '@/lib/format'
import { inr } from '@/lib/payroll'
import { csvName, downloadCSV } from '@/lib/csv'

/** A ledger with a running balance: the float, what left it, and what is left. */
function PettyCash() {
  const { toast, openModal, closeModal } = useUi()
  const [extra, setExtra] = useState<PettyEntry[]>([])

  const ledger = useMemo(
    () =>
      [...PETTY, ...extra]
        .slice()
        .sort((a, b) => a.d.getTime() - b.d.getTime())
        .reduce<(PettyEntry & { after: number })[]>((acc, e) => {
          const after = (acc[acc.length - 1]?.after ?? 0) + (e.kind === 'credit' ? e.amt : -e.amt)
          acc.push({ ...e, after })
          return acc
        }, []),
    [extra],
  )

  const balance = ledger.length ? ledger[ledger.length - 1].after : 0
  const spent = ledger.filter((e) => e.kind === 'debit').reduce((a, e) => a + e.amt, 0)
  const noReceipt = ledger.filter((e) => e.kind === 'debit' && !e.receipt).length

  const add = () => {
    let what = ''
    let amt = ''
    openModal({
      title: 'Record an expense',
      body: (
        <Form>
          <div className="fld" style={{ gridColumn: '1/-1' }}>
            <label htmlFor="pc-what">What was it for</label>
            <input className="inp" id="pc-what" onChange={(e) => (what = e.target.value)} />
          </div>
          <Field
            label="Amount"
            hint={`Anything over ${inr(PETTYCFG.limit)} needs the custodian to approve it.`}
          >
            <input className="inp mono" inputMode="numeric" onChange={(e) => (amt = e.target.value)} />
          </Field>
        </Form>
      ),
      footer: (
        <>
          <Btn variant="ghost" onClick={closeModal}>
            Cancel
          </Btn>
          <Btn
            onClick={() => {
              const n = Number(amt)
              if (!what.trim() || !Number.isFinite(n) || n <= 0) {
                toast('Give it a description and an amount')
                return
              }
              setExtra((x) => [
                ...x,
                {
                  id: `P${100 + x.length}`,
                  d: new Date(),
                  kind: 'debit',
                  what: what.trim(),
                  amt: n,
                  by: PETTYCFG.custodian,
                  ref: 'Entered by hand',
                  receipt: false,
                },
              ])
              closeModal()
              toast(`${what.trim()} — ${inr(n)}`)
            }}
          >
            Record
          </Btn>
        </>
      ),
    })
  }

  const rows: DataRow[] = [...ledger].reverse().map((e) => ({
    id: e.id,
    k: e.kind,
    search: `${e.what} ${e.by} ${e.ref}`,
    c: [
      { v: fmtDate(e.d), mono: true },
      { v: e.what, s: e.ref },
      { v: e.by },
      { v: (e.kind === 'credit' ? '+' : '−') + inr(e.amt), mono: true },
      { v: e.receipt ? 'On file' : 'Missing', chip: e.receipt ? 'v' : 'r' },
      { v: inr(e.after), mono: true },
    ],
  }))

  const exportLedger = () => {
    const out = downloadCSV(csvName('petty-cash'), [
      ['Date', 'What', 'Who', 'Kind', 'Amount', 'Receipt', 'Balance after'],
      ...ledger.map((e) => [
        fmtDate(e.d),
        e.what,
        e.by,
        e.kind,
        e.amt,
        e.receipt ? 'yes' : 'no',
        e.after,
      ]),
    ])
    toast(`${out.name} — ${out.rows.length - 1} rows`)
  }

  return (
    <>
      <PageHead
        title="Petty cash"
        sub={`Held by ${PETTYCFG.custodian}. Counted every ${PETTYCFG.countEvery}.`}
        actions={
          <>
            <Btn variant="ghost" onClick={exportLedger}>
              Export
            </Btn>
            <Btn onClick={add}>＋ Record an expense</Btn>
          </>
        }
      />

      {noReceipt ? (
        <Banner
          kind="r"
          icon="⚑"
          title={`${noReceipt} expense${noReceipt === 1 ? '' : 's'} without a receipt`}
        >
          The month cannot be closed until each one has a receipt attached, or a note explaining why there is
          none.
        </Banner>
      ) : null}

      <Kpis>
        <Kpi title="Float" value={<span className="mono">{inr(PETTYCFG.float)}</span>} detail="opening balance" />
        <Kpi title="Spent" value={<span className="mono">{inr(spent)}</span>} detail="since the float was set" />
        <Kpi title="In hand" value={<span className="mono ok">{inr(balance)}</span>} detail="should match the tin" />
        <Kpi
          title="Single-item limit"
          value={<span className="mono">{inr(PETTYCFG.limit)}</span>}
          detail="above this needs approval"
        />
      </Kpis>

      <div style={{ marginTop: 20 }}>
        <DataTable
          noun="entries"
          min={940}
          search="Search the ledger"
          pills={[
            { key: 'all', label: 'All', count: ledger.length },
            { key: 'debit', label: 'Paid out', count: ledger.filter((e) => e.kind === 'debit').length },
            { key: 'credit', label: 'Paid in', count: ledger.filter((e) => e.kind === 'credit').length },
          ]}
          cols={[
            { l: 'Date', w: 110 },
            { l: 'What', w: 220, f: 1.4 },
            { l: 'Who', w: 150 },
            { l: 'Amount', w: 120 },
            { l: 'Receipt', w: 120 },
            { l: 'Balance', w: 120 },
          ]}
          rows={rows}
          emptyText="Nothing in the ledger matches this filter."
        />
      </div>
    </>
  )
}

export default function PettyCashRoute() {
  return (
    <RequireCap cap="pricing">
      <PettyCash />
    </RequireCap>
  )
}
