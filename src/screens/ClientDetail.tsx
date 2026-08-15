import { useMemo, useState } from 'react'
import { useNavigate, useParams } from '@tanstack/react-router'
import {
  Btn,
  Card,
  CardBody,
  CardHead,
  Chip,
  Due,
  Empty,
  KeyValues,
  Kpi,
  Kpis,
  NotFoundRecord,
  PageHead,
  Rows,
  Tabs,
} from '@/components/ui'
import { RequireCap } from '@/components/RequireCap'
import { SkeletonValue } from '@/components/async'
import { useUi } from '@/state/ui'
import { CLIENTS } from '@/data/catalog'
import { ORDERS } from '@/data/production'
import { INVOICES } from '@/data/business'
import { STATUS } from '@/data/org'
import { ONTIMETARGET, groupDeliveries } from '@/lib/metrics'
import { useDeliveries } from '@/lib/useDeliveries'
import { SLA, hh, slaHours } from '@/lib/sla'
import { fmtDate, money } from '@/lib/format'
import { csvName, downloadCSV } from '@/lib/csv'

const TABS = ['Orders', 'Invoices', 'Turnaround', 'Contract'] as const
type Tab = (typeof TABS)[number]

const INVST: Record<string, [string, 'v' | 'r' | 'd' | 'n']> = {
  paid: ['Paid', 'v'],
  open: ['Open', 'n'],
  part: ['Part paid', 'r'],
  overdue: ['Overdue', 'd'],
}

/**
 * One client: what they have in production, what they owe, and whether we are
 * keeping the promise we made them.
 *
 * The turnaround tab is the one that matters commercially — an on-time rate
 * below target is the number that shows up in a renewal conversation, so it is
 * stated against the promise rather than as a bare percentage.
 */
function ClientDetail() {
  const { clientCode } = useParams({ from: '/clients/$clientCode' })
  const navigate = useNavigate()
  const { toast } = useUi()
  const [tab, setTab] = useState<Tab>('Orders')

  const client = CLIENTS.find((c) => c.n === clientCode)
  const history = useDeliveries()

  const orders = useMemo(() => ORDERS.filter((o) => o.cl === clientCode), [clientCode])
  const invoices = useMemo(() => INVOICES.filter((i) => i.cl === clientCode), [clientCode])

  const theirs = useMemo(
    () => (history.data ?? []).filter((d) => d.cl === clientCode),
    [history.data, clientCode],
  )

  const byProduct = useMemo(() => groupDeliveries(theirs, (d) => d.pr), [theirs])

  if (!client) {
    return <NotFoundRecord what="client" backTo="/company" backLabel="Company" />
  }

  const open = orders.filter((o) => !o.done)
  const owed = invoices.reduce((a, i) => a + (i.amt - i.paid), 0)
  const late = theirs.filter((d) => d.late).length
  const onTime = theirs.length ? ((theirs.length - late) / theirs.length) * 100 : null

  /* Every rule that mentions this client, plus the default it would otherwise
     fall through to — so the page shows what applies, not just what is special. */
  const rules = SLA.filter((r) => r.cl === clientCode || r.cl.startsWith('—'))

  const exportOrders = () => {
    const out = downloadCSV(csvName(`client-${clientCode}-orders`), [
      ['Order', 'Product', 'Status', 'County', 'State', 'Due', 'Fee'],
      ...orders.map((o) => [o.id, o.pr, STATUS[o.stt]?.[0] ?? o.stt, o.co, o.st, fmtDate(o.due), o.fee]),
    ])
    toast(`${out.name} — ${out.rows.length - 1} rows`)
  }

  return (
    <>
      <PageHead
        parent={{ to: '/company', label: 'Company' }}
        title={client.dn}
        sub={
          <>
            <span className="mono">{client.n}</span> · {client.terms} ·{' '}
            <span className="mono">{client.e}</span> · <span className="mono">{client.p}</span>
          </>
        }
        actions={
          <>
            <Chip kind={client.active ? 'v' : 'n'}>{client.active ? 'Active' : 'Inactive'}</Chip>
            <Btn variant="ghost" onClick={exportOrders}>
              Export orders
            </Btn>
          </>
        }
      />

      <Kpis>
        <Kpi title="In production" value={open.length} detail={`${orders.length} on the register`} />
        <Kpi
          title="Outstanding"
          value={<span className={owed > 0 ? 'warn' : 'ok'}>{money(owed)}</span>}
          detail={`${invoices.length} invoices`}
        />
        <Kpi
          title="On time"
          value={
            history.isPending ? <SkeletonValue /> : onTime === null ? '—' : onTime.toFixed(1) + '%'
          }
          tone={!history.isPending && onTime !== null && onTime < ONTIMETARGET ? 'warn' : undefined}
          detail={`target ${ONTIMETARGET}% · ${late} late of ${theirs.length}`}
        />
        <Kpi title="Delivered" value={client.orders} detail="all time" />
      </Kpis>

      <div style={{ marginTop: 20 }}>
        <Tabs tabs={[...TABS]} value={tab} onChange={setTab} />
      </div>

      {tab === 'Orders' ? (
        <Card>
          <CardHead
            title="On the register"
            actions={<Chip kind="n">{open.length} open</Chip>}
          />
          {orders.length ? (
            <Rows>
              {orders.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  className="rw"
                  style={{ width: '100%' }}
                  onClick={() => navigate({ to: '/orders/$orderId', params: { orderId: o.id } })}
                >
                  <span className="mono">{o.pr}</span>
                  <span>
                    <b className="mono">{o.id}</b>
                    <div className="sd">
                      {o.prop} · {o.co}, {o.st}
                    </div>
                  </span>
                  <span>{o.done ? <Chip kind="v">Delivered</Chip> : <Due at={o.due} />}</span>
                </button>
              ))}
            </Rows>
          ) : (
            <Empty>Nothing on the register for {client.dn}.</Empty>
          )}
        </Card>
      ) : null}

      {tab === 'Invoices' ? (
        <Card>
          <CardHead title="Billing" actions={<Chip kind={owed > 0 ? 'r' : 'v'}>{money(owed)} owing</Chip>} />
          {invoices.length ? (
            <CardBody>
              <div className="tsc">
                <table className="mat">
                  <thead>
                    <tr>
                      <th>Invoice</th>
                      <th>Period</th>
                      <th style={{ textAlign: 'right' }}>Orders</th>
                      <th style={{ textAlign: 'right' }}>Amount</th>
                      <th style={{ textAlign: 'right' }}>Paid</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map((i) => {
                      const [label, kind] = INVST[i.st] ?? [i.st, 'n' as const]
                      return (
                        <tr key={i.id}>
                          <td className="mono">{i.id}</td>
                          <td>{i.m}</td>
                          <td className="mono" style={{ textAlign: 'right' }}>{i.orders}</td>
                          <td className="mono" style={{ textAlign: 'right' }}>{money(i.amt)}</td>
                          <td className="mono" style={{ textAlign: 'right' }}>{money(i.paid)}</td>
                          <td>
                            <Chip kind={kind}>{label}</Chip>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </CardBody>
          ) : (
            <Empty>Nothing has been invoiced to {client.dn} yet.</Empty>
          )}
        </Card>
      ) : null}

      {tab === 'Turnaround' ? (
        <Card>
          <CardHead title="By product" />
          {history.isPending ? (
            <CardBody>
              <p className="gr">Loading the delivery history…</p>
            </CardBody>
          ) : byProduct.length ? (
            <CardBody>
              <div className="tsc">
                <table className="mat">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th style={{ textAlign: 'right' }}>Delivered</th>
                      <th style={{ textAlign: 'right' }}>Late</th>
                      <th style={{ textAlign: 'right' }}>On time</th>
                      <th style={{ textAlign: 'right' }}>Average</th>
                      <th style={{ textAlign: 'right' }}>Promised</th>
                    </tr>
                  </thead>
                  <tbody>
                    {byProduct.map((g) => {
                      const pct = ((g.n - g.late) / g.n) * 100
                      const promised = slaHours({ cl: clientCode, pr: g.key })
                      return (
                        <tr key={g.key}>
                          <td className="mono">{g.key}</td>
                          <td className="mono" style={{ textAlign: 'right' }}>{g.n}</td>
                          <td className="mono" style={{ textAlign: 'right' }}>{g.late}</td>
                          <td
                            className={`mono ${pct < ONTIMETARGET ? 'warn' : 'ok'}`}
                            style={{ textAlign: 'right' }}
                          >
                            {pct.toFixed(1)}%
                          </td>
                          <td className="mono" style={{ textAlign: 'right' }}>{hh(g.hrs / g.n)}</td>
                          <td className="mono gr" style={{ textAlign: 'right' }}>{promised}h</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </CardBody>
          ) : (
            <Empty>Nothing has been delivered to {client.dn} yet.</Empty>
          )}
        </Card>
      ) : null}

      {tab === 'Contract' ? (
        <>
          <Card>
            <CardHead title="Account" />
            <CardBody>
              <KeyValues
                rows={[
                  ['Code', <span className="mono">{client.n}</span>],
                  ['Legal name', client.dn],
                  ['Payment terms', client.terms],
                  ['Orders desk', <span className="mono">{client.e}</span>],
                  ['Telephone', <span className="mono">{client.p}</span>],
                  ['Delivered all time', <span className="mono">{client.orders}</span>],
                  ['Invoiced all time', <span className="mono">{money(client.total)}</span>],
                  ['Received', <span className="mono">{money(client.paid)}</span>],
                ]}
              />
            </CardBody>
          </Card>

          <Card style={{ marginTop: 16 }}>
            <CardHead title="Turnaround promised" />
            <CardBody>
              <div className="tsc">
                <table className="mat">
                  <thead>
                    <tr>
                      <th>Client</th>
                      <th>Product</th>
                      <th style={{ textAlign: 'right' }}>Hours</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rules.map((r, i) => (
                      <tr key={i}>
                        <td className={r.cl.startsWith('—') ? 'gr' : 'mono'}>{r.cl}</td>
                        <td className="mono">{r.pr}</td>
                        <td className="mono" style={{ textAlign: 'right' }}>{r.h}h</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="gr" style={{ fontSize: '12.5px', marginTop: 12 }}>
                The most specific rule wins: client and product first, then the client's own default, then
                the company default. Every order for {client.n} is measured against whichever applies.
              </p>
            </CardBody>
          </Card>
        </>
      ) : null}
    </>
  )
}

export default function Guarded() {
  return (
    <RequireCap cap="pricing">
      <ClientDetail />
    </RequireCap>
  )
}
