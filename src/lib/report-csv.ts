import { ASSIGN_STAGES, STAGES } from '@/data/org'
import { PRODUCTS } from '@/data/catalog'
import { STAFF } from '@/data/people'
import { curStage, type Arrival, type Assignment, type DeptRow, type WorkRow } from '@/lib/engine'
import type { Delivery } from '@/data/deliveries'
import type { QcEntry } from '@/data/quality'
import type { CsvRow } from './csv'
import { r2 } from '@/lib/format'


export interface ReportCsv {
  name: string
  rows: CsvRow[]
}

export function receivedCsv(orders: Arrival[]): ReportCsv {
  const clients = [...new Set(orders.map((o) => o.cl))].sort()
  return {
    name: 'received',
    rows: [
      ['Client', 'Received', ...STAGES, 'Completed', 'WIP'],
      ...clients.map((c) => {
        const mine = orders.filter((o) => o.cl === c)
        const done = mine.filter((o) => !curStage(o)).length
        return [
          c,
          mine.length,
          ...STAGES.map((g) => mine.filter((o) => curStage(o) === g).length),
          done,
          mine.length - done,
        ]
      }),
    ],
  }
}

export function assignedCsv(assigns: Assignment[]): ReportCsv {
  const products = PRODUCTS.map((p) => p.id).filter((id) => assigns.some((a) => a.o.pr === id))
  return {
    name: 'assigned',
    rows: [
      ['Department', 'Staff', ...products, 'Total'],
      ...ASSIGN_STAGES.flatMap((d) =>
        STAFF.filter((x) => x.dep.includes(d)).map((x) => {
          const his = assigns.filter((a) => a.stage === d && a.who === x.id)
          return [d, x.n, ...products.map((p) => his.filter((a) => a.o.pr === p).length), his.length]
        }),
      ),
    ],
  }
}

export function turnaroundCsv(deliveries: Delivery[]): ReportCsv {
  return {
    name: 'on-time',
    rows: [
      [
        'Delivered',
        'Order',
        'Client',
        'Product',
        'Promise hrs',
        'Took hrs',
        'Late',
        ...ASSIGN_STAGES.map((x) => `${x} hrs`),
      ],
      ...deliveries.map((x) => [
        x.dk,
        x.id,
        x.cl,
        x.pr,
        x.slaH,
        r2(x.hrs),
        x.late ? 'yes' : 'no',
        ...ASSIGN_STAGES.map((g) => r2(x.st[g] ?? 0)),
      ]),
    ],
  }
}

export function qualityCsv(log: QcEntry[]): ReportCsv {
  return {
    name: 'quality',
    rows: [
      [
        'Date',
        'Order',
        'Client',
        'Product',
        'Stage',
        'Worked by',
        'Rated by',
        'Accuracy',
        'Completeness',
        'Formatting',
        'Defect',
        'Reason',
      ],
      ...log.map((x) => [
        x.dk,
        x.order,
        x.cl,
        x.pr,
        x.stage,
        x.onName,
        x.byName,
        x.acc,
        x.comp,
        x.fmt,
        x.defect ? 'yes' : 'no',
        x.note ?? '',
      ]),
    ],
  }
}

export function workloadCsv(rows: WorkRow[] | DeptRow[], byDept: boolean): ReportCsv {
  return {
    name: byDept ? 'department-workload' : 'staff-workload',
    rows: [
      [byDept ? 'Department' : 'Staff', 'Completed', 'Pending', 'Total', '% complete'],
      ...rows.map((r) => [
        'd' in r ? r.d : r.s.n,
        r.done,
        r.pend,
        r.tot,
        r.pct,
      ]),
    ],
  }
}
