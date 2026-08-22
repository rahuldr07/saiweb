import { ORDERS } from '@/data/production'
import { CLIENTS } from '@/data/catalog'
import { STAFF } from '@/data/people'
import { INVOICES } from '@/data/business'
import { LSTATE } from '@/lib/derived'
import { currentCounties, currentLinkTypes } from '@/state/coverage'
import { fmtDate, fmtDT, money } from '@/lib/format'
import { roleName } from '@/lib/permissions'
import { csvName, downloadCSV, type CsvResult } from '@/lib/csv'

/**
 * "Export everything" — five files, not one.
 *
 * A single sheet with orders, clients, staff, invoices and coverage stacked in
 * it is not a backup of anything; each of these has its own columns and its own
 * natural row. Five files is what somebody can actually open.
 */
export function exportEverything(): CsvResult[] {
  const orders = downloadCSV(csvName('orders'), [
    ['Order', 'Client', 'Product', 'State', 'County', 'Status', 'Received', 'Due', 'Fee'],
    ...ORDERS.map((o) => [o.id, o.cl, o.pr, o.st, o.co, o.stt, fmtDT(o.recv), fmtDT(o.due), o.fee]),
  ])

  const clients = downloadCSV(csvName('clients'), [
    ['Client', 'Display name', 'Orders all time', 'Invoiced', 'Total', 'Paid', 'Terms', 'Email'],
    ...CLIENTS.map((c) => [c.n, c.dn, c.orders, c.inv, c.total, c.paid, c.terms, c.e]),
  ])

  const staff = downloadCSV(csvName('staff'), [
    ['Name', 'Role', 'Departments', 'Daily target', 'Availability', 'Active'],
    ...STAFF.map((s) => [
      s.n,
      roleName(s.r),
      s.dep.join(' / '),
      s.cap,
      s.avail,
      s.active === false ? 'no' : 'yes',
    ]),
  ])

  const invoices = downloadCSV(csvName('invoices'), [
    ['Invoice', 'Client', 'Month', 'Issued', 'Status', 'Orders', 'Amount', 'Paid'],
    ...INVOICES.map((i) => [i.id, i.cl, i.m, fmtDate(i.issued), i.st, i.orders, money(i.amt), money(i.paid)]),
  ])

  const types = currentLinkTypes()
  const counties = downloadCSV(csvName('county-coverage'), [
    ['County', 'State', 'Index from', ...types.flatMap((t) => [t.n, `${t.n} status`])],
    ...currentCounties().map((c) => [
      c.n,
      c.st,
      c.idx ?? 'manual',
      ...types.flatMap((t) => {
        const l = c.links[t.k]
        return [l?.u ?? '', l ? LSTATE[l.s][0] : '—']
      }),
    ]),
  ])

  return [orders, clients, staff, invoices, counties]
}
