import { useMemo, useState } from 'react'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { Avatar, Banner, Btn, Due, PageHead, Select } from '@/components/ui'
import { DataTable, type DataRow } from '@/components/DataTable'
import { useSession } from '@/state/session'
import { useUi } from '@/state/ui'
import { ORDERS } from '@/data/production'
import { STAGES, STATUS } from '@/data/org'
import { STAFF } from '@/data/people'
import { TZ, fmtDT } from '@/lib/format'
import { now } from '@/lib/clock'
import { whoName } from '@/lib/permissions'
import { hh, orderAtRisk, orderPlan } from '@/lib/sla'
import { csvName, downloadCSV } from '@/lib/csv'

const st = (k: string) => STATUS[k]?.[0] ?? k

const uniq = (xs: string[]) => [...new Set(xs)].sort()

/** `[value, label]` pairs for a filter select, with the "everything" option first. */
const allFirst = (allLabel: string, values: string[]): [string, string][] => [
  ['all', allLabel],
  ...values.map((v) => [v, v] as [string, string]),
]

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
      k: o.done ? 'done' : o.due < now() ? 'late' : (o.due.getTime() - now().getTime()) / 3600000 < 4 ? 'soon' : 'open',
      onClick: () => navigate({ to: '/orders/$orderId', params: { orderId: o.id } }),
      search: `${o.id} ${o.prop} ${o.cl} ${o.co} ${o.st} ${o.pr}`,
      c: [
        { v: o.id, mono: true, s: o.cl },
        { v: o.pr },
        { v: o.prop, s: `${o.co}, ${o.st}` },
        { v: st(o.stt), chip: o.done ? 'v' : o.due < now() ? 'd' : 'b' },
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
                    /* A filled slot is a person, so it opens them. The row underneath
                       opens the order, hence the stop. */
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

  /* Whichever of the two workload views answers the filter on screen: a named
     person if there is one, otherwise the department. */
  const openWorkload = () =>
    navigate({
      to: '/reports',
      search: staff !== 'all' ? { tab: 'By staff', sw: staff } : { tab: 'By department', dw: dept },
    })

  /* The file is built from the rows on screen after the filters — exporting
     something other than what you are looking at is worse than not exporting. */
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
            {/* Who and where sit beside the title, not in the filter bar: they
                change what the whole screen is about, which the banner then
                states in words. */}
            <Select
              label="Filter by department"
              value={dept}
              onChange={(v) => {
                setDept(v)
                /* The staff list narrows to that department, so a person who is
                   not in it can no longer be the selected one. */
                if (v !== 'all' && staff !== 'all' && !STAFF.find((s) => s.id === staff)?.dep.includes(v)) {
                  setStaff('all')
                }
              }}
              options={allFirst('All departments', [...STAGES])}
              style={{ minWidth: 165 }}
            />
            <Select
              label="Filter by staff member"
              value={staff}
              onChange={setStaff}
              options={[
                ['all', 'All staff'],
                ...STAFF.filter((s) => s.dep.length && (dept === 'all' || s.dep.includes(dept))).map(
                  (s) => [s.id, s.n] as [string, string],
                ),
              ]}
              style={{ minWidth: 180 }}
            />
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
          {
            key: 'late',
            label: 'Past due',
            count: base.filter((o) => !o.done && o.due < now()).length,
            urgent: true,
          },
          {
            key: 'soon',
            label: 'Due < 4h',
            count: base.filter(
              (o) => !o.done && o.due >= now() && (o.due.getTime() - now().getTime()) / 3600000 < 4,
            ).length,
            urgent: true,
          },
          {
            key: 'open',
            label: 'On track',
            count: base.filter((o) => !o.done && (o.due.getTime() - now().getTime()) / 3600000 >= 4).length,
          },
          { key: 'done', label: 'Delivered', count: base.filter((o) => o.done).length },
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
