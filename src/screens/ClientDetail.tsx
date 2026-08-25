import { useState } from 'react'
import { useNavigate, useParams } from '@tanstack/react-router'
import {
  Banner,
  Btn,
  Card,
  CardHead,
  Chip,
  Empty,
  KeyValues,
  Kpi,
  Kpis,
  Label,
  NotFoundRecord,
  PageHead,
  Row,
  Rows,
  Tabs,
} from '@/components/ui'
import { DataTable, type DataRow } from '@/components/DataTable'
import { RequireCap } from '@/components/RequireCap'
import { useNotBuilt } from '@/components/notBuilt'
import { useUi } from '@/state/ui'
import { useClients, useClock, useSla } from '@/state/company'
import { useClientEditor } from './company/forms/useClientEditor'
import { PrefixForm } from './clients/PrefixForm'
import { removePrefix, usePrefixes } from './clients/prefixes'
import { INVOICES, ISTATUS } from '@/data/business'
import { balance, outstandingOf, r2 } from '@/lib/invoices'
import { money } from '@/lib/format'
import type { ChipKind } from '@/data/types'

const TABS = ['Overview', 'Turnaround', 'Invoices', 'Order prefixes'] as const
type Tab = (typeof TABS)[number]

const CLOCK_RUN: Record<string, string> = {
  '247': '24/7 incl. weekends',
  biz: 'Business hours only',
}

/**
 * One client, everything about them.
 *
 * Four tabs, in the order the questions get asked: what the relationship is
 * worth, what has been promised, what has been billed, and which order numbers
 * belong to them.
 *
 * Every figure is derived from the invoice list rather than stored beside it.
 * The design's own note on this tab is the reason: it used to show three
 * invented rows under a pill reading 1,113, and a count on a filter that
 * disagrees with what selecting it shows is worse than no count at all.
 */
function ClientDetail() {
  const { clientCode } = useParams({ from: '/clients/$clientCode' })
  const navigate = useNavigate()
  const { openModal, closeModal, toast } = useUi()
  const notBuilt = useNotBuilt()
  const { editClient } = useClientEditor()
  const clients = useClients()
  const sla = useSla()
  const clock = useClock()
  const prefixMap = usePrefixes()
  const [tab, setTab] = useState<Tab>('Overview')

  const client = clients.find((c) => c.n === clientCode)

  if (!client) {
    return <NotFoundRecord what="client" backTo="/company" backLabel="Clients" />
  }

  const c = client
  const outstanding = r2(c.total - c.paid)
  const collected = c.total ? Math.round((c.paid / c.total) * 100) : 0
  const mine = INVOICES.filter((x) => x.cl === c.n).sort((a, b) => +b.issued - +a.issued)
  const theirSla = sla.filter((s) => s.cl === c.n)
  const prefixes = prefixMap[c.n] ?? []

  /* ── the outstanding modal ─────────────────────────────────────────────── */

  const openOutstanding = () =>
    openModal({
      title: `${c.n} — ${money(outstandingOf(mine))} outstanding`,
      body: (
        <>
          {mine.some((i) => balance(i) > 0) ? (
            <Rows>
              {mine
                .filter((i) => balance(i) > 0)
                .map((i) => (
                  <Row
                    key={i.id}
                    icon={<span className={i.st === 'overdue' ? 'bad' : 'gr'}>·</span>}
                    title={i.m}
                    detail={`invoiced ${money(i.amt)}${
                      i.paid ? `, ${money(i.paid)} received` : ', nothing received'
                    }`}
                    right={
                      <span className={`mono ${i.st === 'overdue' ? 'bad' : 'gr'}`}>
                        {money(balance(i))}
                      </span>
                    }
                  />
                ))}
            </Rows>
          ) : (
            <p className="gr" style={{ fontSize: '13.5px', margin: 0 }}>
              Nothing outstanding — every invoice is settled.
            </p>
          )}
          <p className="gr" style={{ fontSize: '12.5px', marginTop: 12 }}>
            Invoices are raised when an order is delivered, so a gap here is either work that never
            completed or billing that never happened.
          </p>
        </>
      ),
      footer: (
        <>
          <Btn
            variant="ghost"
            onClick={() => {
              closeModal()
              setTab('Invoices')
            }}
          >
            Every invoice
          </Btn>
          <Btn onClick={closeModal}>Close</Btn>
        </>
      ),
    })

  const addPrefixModal = () =>
    openModal({
      title: `Add a prefix for ${c.n}`,
      body: (
        <PrefixForm
          client={c}
          onCancel={closeModal}
          onDone={(m) => {
            closeModal()
            toast(m)
          }}
        />
      ),
    })

  const openSla = () => navigate({ to: '/company', search: { tab: 'Turnaround & SLA', sub: 'Client promise' } })

  /* ── overview ──────────────────────────────────────────────────────────── */

  const overview = (
    <>
      <Kpis>
        <Kpi
          title="Orders"
          value={c.orders.toLocaleString()}
          detail="lifetime"
          hint="How this client is served"
          onClick={() => setTab('Turnaround')}
        />
        <Kpi
          title="Invoiced"
          value={money(c.total)}
          detail="lifetime"
          hint="Every invoice"
          onClick={() => setTab('Invoices')}
        />
        <Kpi
          title="Paid"
          value={<span className="ok">{money(c.paid)}</span>}
          detail={`${collected}% collected`}
          hint="Every invoice"
          onClick={() => setTab('Invoices')}
        />
        <Kpi
          title="Outstanding"
          value={money(outstanding)}
          tone={outstanding > 0 ? 'warn' : undefined}
          detail={outstanding > 0 ? 'still to collect' : 'all settled'}
          hint="What is still owed"
          onClick={openOutstanding}
        />
      </Kpis>

      {c.orders !== c.inv ? (
        <Banner
          kind="r"
          icon="⚑"
          title={`${(c.orders - c.inv).toLocaleString()} orders with no invoice`}
          style={{ marginTop: 16 }}
          actions={
            <Btn
              variant="ghost"
              small
              onClick={() =>
                notBuilt('The reconciliation report', 'your ledger, to compare against')
              }
            >
              Investigate
            </Btn>
          }
        >
          {c.orders.toLocaleString()} orders against {c.inv.toLocaleString()} invoices. Either work
          that never completed, or billing that never happened.
          <div className="bs">Worth reconciling before it becomes a year of drift.</div>
        </Banner>
      ) : null}

      <Card padded style={{ marginTop: 16 }}>
        <Label>Details</Label>
        <KeyValues
          rows={[
            ['Name', c.n],
            ['Code on orders', <span className="mono">{c.dn}</span>],
            [
              'Email',
              c.e ? (
                <a className="br" href={`mailto:${c.e}`}>
                  {c.e}
                </a>
              ) : (
                <span className="gr">not recorded</span>
              ),
            ],
            ['Phone', c.p ? c.p : <span className="gr">not recorded</span>],
            ['Payment terms', c.terms || 'Net 30'],
            [
              'Status',
              c.active === false ? <Chip kind="n">Inactive</Chip> : <Chip kind="v">Active</Chip>,
            ],
          ]}
        />
        <div style={{ display: 'flex', gap: 9, marginTop: 16, flexWrap: 'wrap' }}>
          <Btn onClick={() => editClient(c.n)}>Edit client</Btn>
          <Btn variant="ghost" onClick={() => setTab('Turnaround')}>
            Set turnaround
          </Btn>
        </div>
      </Card>
    </>
  )

  /* ── turnaround ────────────────────────────────────────────────────────── */

  const TCOLS = '1fr 130px 150px 160px'

  const turnaround = (
    <Card>
      <CardHead
        title={`What you’ve promised ${c.n}`}
        actions={
          <Btn small onClick={openSla}>
            ＋ Add product
          </Btn>
        }
      />
      <div className="tsc">
        <div style={{ minWidth: 640 }}>
          <div className="trow h" style={{ gridTemplateColumns: TCOLS }}>
            <span>Product</span>
            <span>Turnaround</span>
            <span>Clock</span>
            <span />
          </div>
          <div className="tb">
            {theirSla.length ? (
              theirSla.map((s, i) => (
                <div className="trow" style={{ gridTemplateColumns: TCOLS }} key={`${s.pr}-${i}`}>
                  <div className="cell">
                    <div className="v">{s.pr}</div>
                  </div>
                  <div className="cell">
                    <div className="v mono">{s.h}h</div>
                  </div>
                  <div className="cell">
                    {/* Read from the workspace's own clock setting rather than
                        stated here, or this line keeps saying "24/7" after
                        somebody switches the clock to business hours. */}
                    <div className="v gr" style={{ fontSize: '12.5px' }}>
                      {CLOCK_RUN[clock.run] ?? clock.run}
                    </div>
                  </div>
                  <div className="cell">
                    <Btn variant="ghost" small onClick={openSla}>
                      Edit
                    </Btn>
                  </div>
                </div>
              ))
            ) : (
              <Empty
                icon="◷"
                action={
                  <Btn small onClick={openSla}>
                    Set turnaround
                  </Btn>
                }
              >
                No SLA set — orders for {c.n} fall back to the 24h default.
              </Empty>
            )}
          </div>
        </div>
      </div>
    </Card>
  )

  /* ── invoices ──────────────────────────────────────────────────────────── */

  const invoiceRows: DataRow[] = mine.map((x) => {
    const bal = balance(x)
    const [label, kind] = (ISTATUS[x.st] ?? [x.st, 'n']) as [string, ChipKind]
    return {
      id: x.id,
      k: [bal > 0 ? 'owing' : 'paid', ...(x.st === 'overdue' ? ['overdue'] : [])],
      search: `${x.id} ${x.m}`,
      c: [
        { v: x.id, mono: true },
        { v: x.m },
        { v: x.orders.toLocaleString(), mono: true },
        { v: money(x.amt), mono: true },
        { v: x.paid ? money(x.paid) : '—', mono: true },
        { v: bal > 0 ? money(bal) : '—', mono: true },
        { v: label, chip: kind },
      ],
    }
  })

  const invoices = (
    <DataTable
      noun="invoices"
      total={mine.length}
      min={880}
      search="Search by invoice or month"
      pills={[
        { key: 'all', label: 'All', count: mine.length },
        {
          key: 'owing',
          label: 'Owing',
          count: mine.filter((x) => balance(x) > 0).length,
          urgent: true,
        },
        {
          key: 'overdue',
          label: 'Overdue',
          count: mine.filter((x) => x.st === 'overdue').length,
          urgent: true,
        },
        { key: 'paid', label: 'Settled', count: mine.filter((x) => balance(x) <= 0).length },
      ]}
      cols={[
        { l: 'Invoice', w: 150 },
        { l: 'Month', w: 110 },
        { l: 'Orders', w: 90 },
        { l: 'Amount', w: 120 },
        { l: 'Received', w: 120 },
        { l: 'Outstanding', w: 120 },
        { l: 'Status', w: 120 },
      ]}
      rows={invoiceRows}
      emptyText={`Nothing has been invoiced to ${c.n} yet.`}
    />
  )

  /* ── order prefixes ────────────────────────────────────────────────────── */

  const prefixTab = (
    <Card>
      <CardHead
        title={`Order number prefixes that belong to ${c.n}`}
        actions={
          <Btn small onClick={addPrefixModal}>
            ＋ Add
          </Btn>
        }
      />
      <div className="rows" style={{ border: 'none', borderRadius: 0 }}>
        {prefixes.length ? (
          prefixes.map((p) => (
            <div className="rw" key={p}>
              <span className="gr">↳</span>
              <span>
                <b className="mono">{p}…</b>
                <div className="sd">Incoming mail carrying this prefix resolves to {c.n}</div>
              </span>
              <span>
                <Btn
                  variant="ghost"
                  small
                  onClick={() => {
                    removePrefix(c.n, p)
                    toast(`${p} removed — mail with that prefix now needs matching by hand`)
                  }}
                >
                  Remove
                </Btn>
              </span>
            </div>
          ))
        ) : (
          <div className="empty" style={{ padding: '26px 10px' }}>
            <Empty icon="↳" action={<Btn small onClick={addPrefixModal}>Add one</Btn>}>
              No prefixes — mail for {c.n} has to be matched by hand.
            </Empty>
          </div>
        )}
      </div>
    </Card>
  )

  return (
    <>
      <PageHead
        parent={{ to: '/company', search: { tab: 'Clients' }, label: 'Clients' }}
        title={c.n}
        sub={`Client code ${c.dn} · ${c.orders.toLocaleString()} orders · ${c.terms || 'Net 30'}`}
        actions={
          <>
            {c.active === false ? <Chip kind="n">Inactive</Chip> : null}
            <Btn variant="ghost" onClick={() => editClient(c.n)}>
              Edit client
            </Btn>
          </>
        }
      />

      <Tabs tabs={[...TABS]} value={tab} onChange={setTab} />

      {tab === 'Overview' ? overview : null}
      {tab === 'Turnaround' ? turnaround : null}
      {tab === 'Invoices' ? invoices : null}
      {tab === 'Order prefixes' ? prefixTab : null}
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
