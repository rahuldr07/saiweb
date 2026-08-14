import { useMemo, useState } from 'react'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { Avatar, Banner, Btn, Due, PageHead } from '@/components/ui'
import { DataTable, type DataRow } from '@/components/DataTable'
import { useSession } from '@/state/session'
import { useUi } from '@/state/ui'
import { ORDERS } from '@/data/production'
import { STAGES, STATUS } from '@/data/org'
import { STAFF } from '@/data/people'
import { NOW, TZ, money } from '@/lib/format'
import { whoName } from '@/lib/permissions'
import { hh, orderAtRisk, orderPlan } from '@/lib/sla'
import { csvName, downloadCSV } from '@/lib/csv'

const st = (k: string) => STATUS[k]?.[0] ?? k

const uniq = (xs: string[]) => [...new Set(xs)].sort()

export default function Orders() {
  const { me, tenant, can } = useSession()
  const { toast } = useUi()
  const navigate = useNavigate()

  /* The dashboard tiles deep-link into a filter, so the pill lives in the URL. */
  const { pill: pillParam } = useSearch({ from: '/orders' })
  const [pill, setPill] = useState(pillParam ?? 'all')
  const [product, setProduct] = useState('all')
  const [client, setClient] = useState('all')
  const [dept, setDept] = useState('all')
  const [staff, setStaff] = useState('all')

  /* Someone without "see every order" gets only the orders they are on. That is
     the permission doing its job, not the screen falling short — so the subtitle
     says so rather than showing an empty register. */
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

  const rows: DataRow[] = base.map((o) => {
    const plan = orderPlan(o)
    return {
      id: o.id,
      k: o.done ? 'done' : o.due < NOW ? 'late' : (o.due.getTime() - NOW.getTime()) / 3600000 < 4 ? 'soon' : 'open',
      onClick: () => navigate({ to: '/orders/$orderId', params: { orderId: o.id } }),
      search: `${o.id} ${o.prop} ${o.cl} ${o.co} ${o.st} ${o.pr}`,
      c: [
        { v: o.id, mono: true, s: o.cl },
        { v: o.pr },
        { v: o.prop, s: `${o.co}, ${o.st}` },
        { v: st(o.stt), chip: o.done ? 'v' : o.due < NOW ? 'd' : 'b' },
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
                /* A red ring means the same person is set to both type and QC this
                   order — self-review. Assignment blocks it; this surfaces it. */
                const conflict = !!person?.conflict && (s === 'Typing' || s === 'Typing QC')
                return (
                  <Avatar
                    key={s}
                    name={a ? whoName(a) : null}
                    self={conflict}
                    title={a ? `${s}: ${whoName(a)} — open their profile` : `${s}: unassigned`}
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
    dept !== 'all' ? `in ${dept}` : null,
    staffName ? `with ${staffName}` : null,
    product !== 'all' ? `for ${product}` : null,
    client !== 'all' ? `from ${client}` : null,
  ].filter(Boolean)

  const exportOrders = () => {
    const out = downloadCSV(csvName('orders'), [
      ['Order', 'Client', 'Product', 'State', 'County', 'Property', 'Status', 'Due', 'Fee', ...STAGES],
      ...base.map((o) => [
        o.id,
        o.cl,
        o.pr,
        o.st,
        o.co,
        o.prop,
        st(o.stt),
        o.due.toISOString(),
        money(o.fee),
        ...STAGES.map((s) => (o.a[s] ? whoName(o.a[s]!) : '')),
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
            <Btn onClick={() => navigate({ to: '/intake' })}>＋ New order</Btn>
          </>
        }
      />

      {active.length ? (
        <Banner
          icon="◔"
          title={`Showing orders ${active.join(' and ')}`}
          actions={
            <Btn
              variant="ghost"
              onClick={() => {
                setStaff('all')
                setDept('all')
                setProduct('all')
                setClient('all')
              }}
            >
              Clear
            </Btn>
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
          {
            key: 'late',
            label: 'Past due',
            count: base.filter((o) => !o.done && o.due < NOW).length,
            urgent: true,
          },
          {
            key: 'soon',
            label: 'Due < 4h',
            count: base.filter(
              (o) => !o.done && o.due >= NOW && (o.due.getTime() - NOW.getTime()) / 3600000 < 4,
            ).length,
            urgent: true,
          },
          {
            key: 'open',
            label: 'On track',
            count: base.filter((o) => !o.done && (o.due.getTime() - NOW.getTime()) / 3600000 >= 4).length,
          },
          { key: 'done', label: 'Delivered', count: base.filter((o) => o.done).length },
        ]}
        filters={[
          {
            label: 'Product',
            value: product,
            onChange: setProduct,
            options: [['all', 'All products'], ...uniq(ORDERS.map((o) => o.pr)).map((x) => [x, x] as [string, string])],
          },
          {
            label: 'Client',
            value: client,
            onChange: setClient,
            options: [['all', 'All clients'], ...uniq(ORDERS.map((o) => o.cl)).map((x) => [x, x] as [string, string])],
          },
          {
            label: 'Department',
            value: dept,
            onChange: setDept,
            options: [['all', 'All departments'], ...STAGES.map((d) => [d, d] as [string, string])],
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
        emptyText="No orders match this filter."
      />

      <p className="gr" style={{ fontSize: '12.5px', marginTop: 12 }}>
        A red ring on an avatar means the same person is set to both type and QC that order —{' '}
        <b>self-review</b>. Assignment blocks it.
      </p>
    </>
  )
}
