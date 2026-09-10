import { useMemo, useState } from 'react'
import { useSearch } from '@tanstack/react-router'
import { useGo } from '@/lib/nav'
import { Avatar, Banner, Btn, Due, PageHead } from '@/components/ui'
import { DataTable, type DataRow } from '@/components/DataTable'
import { useSession } from '@/state/session'
import { useUi } from '@/state/ui'
import { ORDERS } from '@/data/production'
import { STAGES, STATUS } from '@/data/org'
import { STAFF } from '@/data/people'
import { SOON_HOURS, TZ, fmtDT, orderChipKind, orderState, type OrderState } from '@/lib/format'
import { whoName } from '@/lib/permissions'
import { hh, orderAtRisk, orderPlan } from '@/lib/sla'
import { csvName, downloadCSV } from '@/lib/csv'

const st = (k: string) => STATUS[k]?.[0] ?? k

const uniq = (xs: string[]) => [...new Set(xs)].sort()

const allFirst = (allLabel: string, values: string[]): [string, string][] => [
  ['all', allLabel],
  ...values.map((v) => [v, v] as [string, string]),
]

export default function Orders() {
  const { me, tenant, can } = useSession()
  const { toast } = useUi()
  const navigate = useGo()

  const { pill: pillParam } = useSearch({ from: '/orders' })
  const [pill, setPill] = useState(pillParam ?? 'all')
  const [product, setProduct] = useState('all')
  const [client, setClient] = useState('all')
  const [dept, setDept] = useState('all')
  const [staff, setStaff] = useState('all')

  const scope = can('all') ? ORDERS : ORDERS.filter((o) => Object.values(o.a).includes(me.id))

  const base = useMemo(
    () =>
      scope.filter(
        (o) =>
          (staff === 'all' || Object.values(o.a).includes(staff)) &&
          (dept === 'all' || !!o.a[dept]) &&
          (product === 'all' || o.pr === product) &&
          (client === 'all' || o.cl === client),
      ),
    [scope, staff, dept, product, client],
  )

  const inState = (k: OrderState) => base.filter((o) => orderState(o) === k).length

  const rows: DataRow[] = base.map((o) => {
    const plan = orderPlan(o)
    return {
      id: o.id,
      k: orderState(o),
      onClick: () => navigate({ to: '/orders/$orderId', params: { orderId: o.id } }),
      search: `${o.id} ${o.prop} ${o.cl} ${o.co} ${o.st} ${o.pr}`,
      c: [
        { v: o.id, mono: true, s: o.cl },
        { v: o.pr },
        { v: o.prop, s: `${o.co}, ${o.st}` },
        { v: st(o.stt), chip: orderChipKind(o) },
        {
          raw: (
            <>
              <Due at={o.due} />
              {orderAtRisk(o) ? (
                <div className="s bad">short {hh(plan.short)} for the stages left</div>
              ) : plan.behind ? (
                <div className="s warn">
                  behind its {plan.rows.find((r) => r.behind)?.stage ?? ''} checkpoint
                </div>
              ) : null}
            </>
          ),
        },
        {
          raw: (
            <div className="asg">
              {STAGES.map((s) => {
                const a = o.a[s]
                const person = a ? STAFF.find((x) => x.id === a) : undefined
                const conflict = !!person?.conflict && (s === 'Typing' || s === 'Typing QC')
                return (
                  <Avatar
                    key={s}
                    name={a ? whoName(a) : null}
                    self={conflict}
                    title={a ? `${s}: ${whoName(a)} — open their profile` : `${s}: unassigned`}
                    onClick={
                      a
                        ? (e) => {
                            e.stopPropagation()
                            navigate({ to: '/staff/$personId', params: { personId: a } })
                          }
                        : undefined
                    }
                  />
                )
              })}
            </div>
          ),
        },
      ],
    }
  })

  const staffName = staff === 'all' ? null : whoName(staff)
  const active = [
    dept !== 'all' ? <>in <b>{dept}</b></> : null,
    staffName ? <>with <b>{staffName}</b></> : null,
    product !== 'all' ? <>for <b>{product}</b></> : null,
    client !== 'all' ? <>from <b>{client}</b></> : null,
  ].filter(Boolean)

  const clearFilters = () => {
    setStaff('all')
    setDept('all')
    setProduct('all')
    setClient('all')
  }

  const openWorkload = () =>
    navigate({
      to: '/reports',
      search: staff !== 'all' ? { tab: 'By staff', sw: staff } : { tab: 'By department', dw: dept },
    })

  const exportOrders = () => {
    const out = downloadCSV(csvName('orders'), [
      ['Order', 'Client', 'Product', 'Property', 'County', 'State', 'Stage', 'Due', 'Received', 'Fee', ...STAGES],
      ...base.map((o) => [
        o.id,
        o.cl,
        o.pr,
        o.prop,
        o.co,
        o.st,
        st(o.stt),
        fmtDT(o.due),
        fmtDT(o.recv),
        o.fee,
        ...STAGES.map((s) => (o.a[s] ? whoName(o.a[s]) : '')),
      ]),
    ])
    toast(`${out.name} — ${out.rows.length - 1} rows`)
  }

  return (
    <>
      <PageHead
        title="Orders"
        sub={
          can('all')
            ? `Every order in ${tenant.name}. One owner per stage — the dashed circles are nobody.`
            : `The ${scope.length} order${scope.length === 1 ? '' : 's'} you are on. Your account cannot see the rest, which is the point of the permission — not a limitation of the screen.`
        }
        actions={
          <>
            <Btn variant="ghost" onClick={exportOrders}>
              Export
            </Btn>
            <Btn onClick={() => navigate({ to: '/orders/new' })}>＋ New order</Btn>
          </>
        }
      />

      {active.length ? (
        <Banner
          icon="◔"
          title={
            <>
              Showing orders{' '}
              {active.map((a, i) => (
                <span key={i}>
                  {i ? ' and ' : ''}
                  {a}
                </span>
              ))}
            </>
          }
          actions={
            <>
              <Btn variant="ghost" onClick={clearFilters}>
                Clear
              </Btn>
              <Btn onClick={openWorkload}>Workload report</Btn>
            </>
          }
        >
          {base.length} of {ORDERS.length}. For the completed-and-pending breakdown across today’s whole
          intake, open the workload report.
        </Banner>
      ) : null}

      <DataTable
        noun="orders"
        min={1080}
        total={base.length}
        search="Search order #, property or client"
        activePill={pill}
        onPill={setPill}
        pills={[
          { key: 'all', label: 'All', count: base.length },
          { key: 'late', label: 'Past due', count: inState('late'), urgent: true },
          { key: 'soon', label: `Due < ${SOON_HOURS}h`, count: inState('soon'), urgent: true },
          { key: 'open', label: 'On track', count: inState('open') },
          { key: 'done', label: 'Delivered', count: inState('done') },
        ]}
        filters={[
          {
            label: 'Product',
            value: product,
            onChange: setProduct,
            options: allFirst('All products', uniq(ORDERS.map((o) => o.pr))),
          },
          {
            label: 'Client',
            value: client,
            onChange: setClient,
            options: allFirst('All clients', uniq(ORDERS.map((o) => o.cl))),
          },
          {
            label: 'Department',
            value: dept,
            onChange: (v) => {
              setDept(v)
              if (v !== 'all' && staff !== 'all' && !STAFF.find((s) => s.id === staff)?.dep.includes(v)) {
                setStaff('all')
              }
            },
            options: allFirst('All departments', [...STAGES]),
          },
          {
            label: 'Staff',
            value: staff,
            onChange: setStaff,
            options: [
              ['all', 'All staff'],
              ...STAFF.filter((s) => s.dep.length && (dept === 'all' || s.dep.includes(dept))).map(
                (s) => [s.id, s.n] as [string, string],
              ),
            ],
          },
        ]}
        cols={[
          { l: 'Order', w: 120 },
          { l: 'Product', w: 95 },
          { l: 'Property', w: 190, f: 1.4 },
          { l: 'Stage', w: 120 },
          { l: `Due (${TZ})`, w: 180 },
          { l: 'Search · SQ · Typ · TQC · Doc · RTS', w: 190 },
        ]}
        rows={rows}
        numbered
        emptyText="No orders match this filter."
        emptyAction={
          active.length ? (
            <Btn small variant="ghost" onClick={clearFilters}>
              Clear filters
            </Btn>
          ) : undefined
        }
      />

      <p className="gr" style={{ fontSize: '12.5px', marginTop: 12 }}>
        A red ring on an avatar means the same person is set to both type and QC that order —{' '}
        <b>self-review</b>. Assignment blocks it; see Quality.
      </p>
    </>
  )
}
