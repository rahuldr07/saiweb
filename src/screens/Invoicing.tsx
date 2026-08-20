import { useMemo, useState } from 'react'
import { Btn, Card, Chip, Empty, Kpi, Kpis, PageHead, Rows, SectionHead } from '@/components/ui'
import { RequireCap } from '@/components/RequireCap'
import { useUi } from '@/state/ui'
import { INVOICES, ISTATUS } from '@/data/business'
import { CLIENTS } from '@/data/catalog'
import { fmtDate, money } from '@/lib/format'
import { csvName, downloadCSV } from '@/lib/csv'
import {
  EMPTY_RANGE,
  INVOICE_MONTHS,
  RANGE_PRESETS,
  balance,
  inRange,
  monthInRange,
  normalise,
  outstandingOf,
  rangeForMonth,
  rangeMonth,
  sameRange,
  sumBy,
  type DateRange,
} from '@/lib/invoices'
import type { Invoice } from '@/data/types'

/**
 * Invoicing.
 *
 * One scope runs the whole screen — client, date range, status — and every
 * figure on it follows that scope, including the matrix totals and the strip at
 * the bottom. A card that quoted a number the table below it did not agree with
 * would be worse than no card, so nothing here computes from anything else.
 */

const COLS = '160px 150px 120px 90px 130px 130px 130px 110px'

/** Money in the matrix drops the symbol — the caption carries the currency. */
const bare = (n: number) => money(n).slice(1)

function Invoicing() {
  const { toast, openModal, closeModal } = useUi()
  const [client, setClient] = useState('all')
  const [range, setRange] = useState<DateRange>(EMPTY_RANGE)
  const [status, setStatus] = useState('all')

  const month = rangeMonth(range)
  const filtered = client !== 'all' || !!range.from || !!range.to || status !== 'all'

  /* Scope without the status pill: the pill counts have to be counted against
     everything else, or filtering to Overdue would report "0 open". */
  const inScope = useMemo(
    () => INVOICES.filter((i) => (client === 'all' || i.cl === client) && inRange(i, range)),
    [client, range],
  )
  const rows = useMemo(
    () => inScope.filter((i) => status === 'all' || i.st === status),
    [inScope, status],
  )

  const invoiced = sumBy(rows, 'amt')
  const paid = sumBy(rows, 'paid')
  const out = outstandingOf(rows)
  const overdue = rows.filter((i) => i.st === 'overdue')

  const rangeLabel =
    month === 'all'
      ? null
      : month === 'custom'
        ? `${range.from ? fmtDate(new Date(range.from)) : 'anything'} to ${range.to ? fmtDate(new Date(range.to)) : 'now'}`
        : month

  const scope =
    [client !== 'all' ? client : null, rangeLabel, status !== 'all' ? ISTATUS[status][0].toLowerCase() : null]
      .filter(Boolean)
      .join(' · ') || 'everything'

  const clear = () => {
    setClient('all')
    setRange(EMPTY_RANGE)
    setStatus('all')
  }

  const setMonth = (m: string) => setRange(rangeForMonth(m))

  const exportInvoices = () => {
    const out = downloadCSV(csvName('invoices'), [
      ['Invoice', 'Client', 'Code', 'Month', 'Orders', 'Amount', 'Paid', 'Outstanding', 'Status', 'Issued'],
      ...rows.map((i) => [
        i.id,
        i.cl,
        i.code,
        i.m,
        i.orders,
        i.amt,
        i.paid,
        balance(i),
        ISTATUS[i.st][0],
        fmtDate(i.issued),
      ]),
    ])
    const n = out.rows.length - 1
    toast(`${out.name} — ${n} invoice${n === 1 ? '' : 's'}`)
  }

  /** Every invoice with a balance, under whatever scope is set above. */
  const showOutstanding = () => {
    const owing = inScope.filter((i) => balance(i) > 0)
    openModal({
      title: `Still to collect — ${money(outstandingOf(owing))}`,
      body: (
        <>
          {owing.length ? (
            <Rows>
              {owing.map((i) => (
                <div className="rw" key={i.id}>
                  <span className={i.st === 'overdue' ? 'bad' : 'gr'}>·</span>
                  <span>
                    <b>
                      {i.cl} · {i.m}
                    </b>
                    <div className="sd">
                      invoiced {money(i.amt)}
                      {i.paid ? `, ${money(i.paid)} received` : ', nothing received'} ·{' '}
                      {ISTATUS[i.st][0].toLowerCase()}
                    </div>
                  </span>
                  <span className={`mono ${i.st === 'overdue' ? 'bad' : 'gr'}`}>
                    {money(balance(i))}
                  </span>
                </div>
              ))}
            </Rows>
          ) : (
            <p className="gr" style={{ fontSize: '13.5px', margin: 0 }}>
              Everything in scope has been settled.
            </p>
          )}
          <p className="gr" style={{ fontSize: '12.5px', marginTop: 12 }}>
            Follows whatever client and date filters are set above, so this total and the card always
            agree.
          </p>
        </>
      ),
      footer: (
        <>
          <Btn
            variant="ghost"
            onClick={() => {
              closeModal()
              setStatus('overdue')
            }}
          >
            Just the overdue ones
          </Btn>
          <Btn onClick={closeModal}>Close</Btn>
        </>
      ),
    })
  }

  /** One cell of the matrix: what a client was invoiced in a month, under scope. */
  const cellFor = (name: string, m: string) => {
    const list = INVOICES.filter(
      (i) => i.cl === name && i.m === m && (status === 'all' || i.st === status) && inRange(i, range),
    )
    return { amt: sumBy(list, 'amt'), n: list.length }
  }

  const monthTotal = (m: string) =>
    sumBy(
      INVOICES.filter((i) => i.m === m && (status === 'all' || i.st === status) && inRange(i, range)),
      'amt',
    )

  const grandTotal = sumBy(
    INVOICES.filter((i) => (status === 'all' || i.st === status) && inRange(i, range)),
    'amt',
  )

  const statusPills: [key: string, label: string, count: number][] = [
    ['all', 'All', inScope.length],
    ...Object.entries(ISTATUS).map(
      ([k, v]) => [k, v[0], inScope.filter((i) => i.st === k).length] as [string, string, number],
    ),
  ]

  return (
    <>
      <PageHead
        title="Invoicing"
        sub="Raised when an order is delivered. Every figure below follows the filters."
        actions={
          <>
            <select
              className="inp"
              style={{ minWidth: 160 }}
              aria-label="Filter by client"
              value={client}
              onChange={(e) => setClient(e.target.value)}
            >
              <option value="all">All clients</option>
              {CLIENTS.map((c) => (
                <option key={c.n} value={c.n}>
                  {c.n}
                </option>
              ))}
            </select>
            <select
              className="inp"
              style={{ minWidth: 150 }}
              aria-label="Filter by month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
            >
              <option value="all">All months</option>
              {INVOICE_MONTHS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
              {month === 'custom' ? <option value="custom">Custom range</option> : null}
            </select>
            <Btn variant="ghost" onClick={exportInvoices}>
              Export
            </Btn>
          </>
        }
      />

      <div className="fbar">
        <label className="gr" style={{ fontSize: '12.5px', fontWeight: 600 }} htmlFor="iv-from">
          Issued
        </label>
        <input
          className="inp mono"
          id="iv-from"
          type="date"
          style={{ width: 158 }}
          value={range.from ?? ''}
          aria-label="Invoices issued from"
          onChange={(e) => setRange((r) => normalise({ ...r, from: e.target.value || null }))}
        />
        <span className="gr" style={{ fontSize: '12.5px' }}>
          to
        </span>
        <input
          className="inp mono"
          id="iv-to"
          type="date"
          style={{ width: 158 }}
          value={range.to ?? ''}
          aria-label="Invoices issued to"
          onChange={(e) => setRange((r) => normalise({ ...r, to: e.target.value || null }))}
        />
        <div className="sp">
          {RANGE_PRESETS.map(([label, preset]) => {
            const on = sameRange(preset, range)
            return (
              <button
                key={label}
                type="button"
                className={`pill ${on ? 'on' : ''}`}
                aria-pressed={on}
                onClick={() => setRange(preset)}
              >
                {label}
              </button>
            )
          })}
        </div>
      </div>

      <div className="fbar">
        {statusPills.map(([key, label, count]) => (
          <button
            key={key}
            type="button"
            className={`pill ${key === 'overdue' && count ? 'urg' : ''} ${status === key ? 'on' : ''}`}
            aria-pressed={status === key}
            onClick={() => setStatus(key)}
          >
            {label}
            <span className="n">{count}</span>
          </button>
        ))}
        {filtered ? (
          <div className="sp">
            <Btn variant="ghost" small onClick={clear}>
              Clear filters
            </Btn>
          </div>
        ) : null}
      </div>

      {month === 'custom' ? (
        <p className="cnt">
          <span>ⓘ</span> Custom range — <b>{rangeLabel}</b>. Choosing a month replaces it.
        </p>
      ) : null}

      <Kpis>
        <Kpi
          title="Invoiced"
          value={money(invoiced)}
          detail={`${rows.length} invoice${rows.length === 1 ? '' : 's'} · ${scope}`}
          onClick={() => setStatus('all')}
        />
        <Kpi
          title="Paid"
          value={<span className="ok">{money(paid)}</span>}
          detail={`${invoiced ? Math.round((paid / invoiced) * 100) : 0}% collected`}
          onClick={() => setStatus('paid')}
        />
        <Kpi
          title="Outstanding"
          value={money(out)}
          tone={out > 0 ? 'warn' : undefined}
          detail={
            <span className={out > 0 ? 'warn' : 'ok'}>{out > 0 ? 'still to collect' : 'all settled'}</span>
          }
          onClick={showOutstanding}
        />
        <Kpi
          title="Overdue"
          value={money(outstandingOf(overdue))}
          tone={overdue.length ? 'alert' : undefined}
          detail={
            <span className={overdue.length ? 'bad' : 'ok'}>
              {overdue.length} invoice{overdue.length === 1 ? '' : 's'}
            </span>
          }
          onClick={() => setStatus('overdue')}
        />
      </Kpis>

      <SectionHead>By client and month — click any figure to filter to it</SectionHead>
      <Card>
        <div className="tsc">
          <table className="mat" style={{ minWidth: 920 }}>
            <thead>
              <tr>
                <th>Client</th>
                {INVOICE_MONTHS.map((m) => {
                  const on = monthInRange(m, range)
                  return (
                    <th
                      key={m}
                      style={{
                        textAlign: 'right',
                        ...(month === m
                          ? { background: 'var(--brandsoft)', color: 'var(--brand)' }
                          : {}),
                        ...(on ? {} : { opacity: 0.35 }),
                      }}
                    >
                      <button
                        type="button"
                        style={{ font: 'inherit', color: 'inherit' }}
                        title={on ? `Filter to ${m}` : 'outside the date range'}
                        onClick={() => setMonth(month === m ? 'all' : m)}
                      >
                        {m}
                      </button>
                    </th>
                  )
                })}
                <th style={{ textAlign: 'right' }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {CLIENTS.map((c) => {
                const total = INVOICE_MONTHS.reduce((a, m) => a + cellFor(c.n, m).amt, 0)
                return (
                  <tr key={c.n} style={client === c.n ? { background: 'var(--brandsoft)' } : undefined}>
                    <td>
                      <button
                        type="button"
                        style={{ font: 'inherit', color: 'inherit', fontWeight: 600 }}
                        onClick={() => setClient(client === c.n ? 'all' : c.n)}
                      >
                        {c.n}
                      </button>
                    </td>
                    {INVOICE_MONTHS.map((m) => {
                      const v = cellFor(c.n, m)
                      const on = monthInRange(m, range)
                      return (
                        <td className="n" key={m} style={on ? undefined : { opacity: 0.35 }}>
                          <button
                            type="button"
                            style={{ font: 'inherit', color: 'inherit', fontFamily: 'var(--mono)' }}
                            title={`${c.n}, ${m} — ${v.n} invoice${v.n === 1 ? '' : 's'}`}
                            onClick={() => {
                              setClient(c.n)
                              setMonth(m)
                            }}
                          >
                            {v.amt ? bare(v.amt) : '—'}
                          </button>
                        </td>
                      )
                    })}
                    <td className="tot">{bare(total)}</td>
                  </tr>
                )
              })}
              <tr>
                <td style={{ fontWeight: 700 }}>All clients</td>
                {INVOICE_MONTHS.map((m) => (
                  <td
                    className="tot"
                    key={m}
                    style={monthInRange(m, range) ? undefined : { opacity: 0.35 }}
                  >
                    {bare(monthTotal(m))}
                  </td>
                ))}
                <td className="tot corner">{bare(grandTotal)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>
      <p className="gr" style={{ fontSize: '12.5px', marginTop: 10 }}>
        Amounts invoiced, in dollars. The bottom row totals each month, the right column totals each
        client, and the corner is everything
        {status === 'all' ? '' : ` marked ${ISTATUS[status][0].toLowerCase()}`}
        {range.from || range.to ? ' inside the date range' : ''}.{' '}
        {range.from || range.to
          ? 'Months outside the range are dimmed and excluded from every total.'
          : ''}
      </p>

      <SectionHead>{filtered ? `Invoices — ${scope}` : 'All invoices'}</SectionHead>
      <p className="cnt">
        <span>ⓘ</span> Showing <b>{rows.length}</b> of <b>{INVOICES.length}</b> invoices
      </p>
      <Card>
        <div className="tsc">
          <div style={{ minWidth: 980 }}>
            <div className="trow h" style={{ gridTemplateColumns: COLS }}>
              <span>Invoice</span>
              <span>Client</span>
              <span>Month</span>
              <span>Orders</span>
              <span>Amount</span>
              <span>Paid</span>
              <span>Outstanding</span>
              <span>Status</span>
            </div>
            <div className="tb">
              {rows.length ? (
                rows.map((i: Invoice) => (
                  <div className="trow" style={{ gridTemplateColumns: COLS }} key={i.id}>
                    <div className="cell">
                      <div className="v mono">{i.id}</div>
                      <div className="s">issued {fmtDate(i.issued)}</div>
                    </div>
                    <div className="cell">
                      <div className="v">{i.cl}</div>
                      <div className="s">{i.code}</div>
                    </div>
                    <div className="cell">
                      <div className="v">{i.m}</div>
                    </div>
                    <div className="cell">
                      <div className="v mono">{i.orders.toLocaleString()}</div>
                    </div>
                    <div className="cell">
                      <div className="v mono">{money(i.amt)}</div>
                    </div>
                    <div className="cell">
                      <div className={`v mono ${i.paid ? 'ok' : 'gr'}`}>
                        {i.paid ? money(i.paid) : '—'}
                      </div>
                    </div>
                    <div className="cell">
                      <div className={`v mono ${balance(i) > 0 ? 'warn' : 'gr'}`}>
                        {balance(i) > 0 ? money(balance(i)) : '—'}
                      </div>
                    </div>
                    <div className="cell">
                      <Chip kind={ISTATUS[i.st][1]}>{ISTATUS[i.st][0]}</Chip>
                    </div>
                  </div>
                ))
              ) : (
                <Empty
                  icon="$"
                  action={
                    <Btn small variant="ghost" onClick={clear}>
                      Clear filters
                    </Btn>
                  }
                >
                  No invoices match {scope}.
                </Empty>
              )}
            </div>
          </div>
        </div>
      </Card>

      {rows.length ? (
        <Card
          padded
          style={{ marginTop: 14, display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}
        >
          <span className="gr" style={{ fontSize: '12.5px' }}>
            Total for {scope}
          </span>
          <b className="mono" style={{ fontSize: '17px' }}>
            {money(invoiced)}
          </b>
          <span className="gr">·</span>
          <span className="ok mono">{money(paid)} paid</span>
          <span className="gr">·</span>
          <span className={`${out > 0 ? 'warn' : 'gr'} mono`}>{money(out)} outstanding</span>
          <Btn variant="ghost" small style={{ marginLeft: 'auto' }} onClick={exportInvoices}>
            Export selection
          </Btn>
        </Card>
      ) : null}
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
