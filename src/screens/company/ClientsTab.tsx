import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Btn, SecHead } from '@/components/ui'
import { DataTable, type DataRow } from '@/components/DataTable'
import { useUi } from '@/state/ui'
import { useClients } from '@/state/company'
import { ClientForm, ClientDelete } from './forms/ClientForm'
import { money } from '@/lib/format'
import { csvName, downloadCSV } from '@/lib/csv'

/** Two decimals, so a subtraction of two money figures cannot show a long tail. */
const r2 = (n: number) => Math.round(n * 100) / 100

/**
 * The client list.
 *
 * Outstanding is invoiced minus paid, computed on the row — storing it is how a
 * list and a client page come to disagree about the same number.
 */
export function ClientsTab() {
  const navigate = useNavigate()
  const { openModal, closeModal, toast } = useUi()
  const CLIENTS = useClients()
  const [showOff, setShowOff] = useState(false)

  const editClient = (name?: string) =>
    openModal({
      title: name ? `Edit ${name}` : 'Add a client',
      body: (
        <ClientForm
          name={name}
          onCancel={closeModal}
          onDone={(m) => { closeModal(); toast(m) }}
          onRemove={(x) => confirmRemove(x)}
        />
      ),
    })

  const confirmRemove = (name: string) =>
    openModal({
      title: `Remove ${name}?`,
      body: (
        <ClientDelete
          name={name}
          onCancel={() => editClient(name)}
          onDone={(m) => { closeModal(); toast(m) }}
        />
      ),
    })

  const list = CLIENTS.filter((c) => showOff || c.active !== false)
  const off = CLIENTS.filter((c) => c.active === false).length

  const exportClients = () =>
    downloadCSV(csvName('clients'), [
      ['Client', 'Code', 'Email', 'Phone', 'Orders', 'Invoiced', 'Outstanding', 'Status'],
      ...list.map((c) => [
        c.n,
        c.dn,
        c.e ?? '',
        c.p ?? '',
        c.orders,
        c.total,
        r2(c.total - c.paid),
        c.active === false ? 'Inactive' : 'Active',
      ]),
    ])

  const rows: DataRow[] = list.map((c) => ({
    id: c.n,
    onClick: () => navigate({ to: '/clients/$clientCode', params: { clientCode: c.n } }),
    search: `${c.n} ${c.dn} ${c.e ?? ''}`,
    c: [
      { v: c.n },
      { v: c.dn, mono: true },
      { v: c.e || '—', mono: !!c.e, s: c.p || '' },
      { v: c.orders.toLocaleString(), mono: true },
      { v: money(c.total), mono: true },
      { v: money(r2(c.total - c.paid)), mono: true },
      { v: c.active === false ? 'Inactive' : 'Active', chip: c.active === false ? 'n' : 'v' },
    ],
  }))

  return (
    <>
      <SecHead
        sub={`${list.length} ${showOff ? 'total' : 'active'}${
          off && !showOff ? ` · ${off} inactive` : ''
        }. Each keeps its own formats, turnaround and rates.`}
        actions={
          <>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: '12.5px',
                color: 'var(--gr)',
              }}
            >
              <input
                type="checkbox"
                checked={showOff}
                onChange={(e) => setShowOff(e.target.checked)}
              />{' '}
              Show inactive
            </label>
            <Btn
              variant="ghost"
              onClick={() => {
                const out = exportClients()
                toast(`${out.name} — ${out.rows.length - 1} clients`)
              }}
            >
              Export
            </Btn>
            <Btn onClick={() => editClient()}>＋ Add client</Btn>
          </>
        }
      />

      <DataTable
        noun="clients"
        total={list.length}
        min={1020}
        search="Search name, code or email"
        cols={[
          { l: 'Client', w: 170, f: 1.2 },
          { l: 'Code', w: 80 },
          { l: 'Contact', w: 200, f: 1.1 },
          { l: 'Orders', w: 90 },
          { l: 'Invoiced', w: 120 },
          { l: 'Outstanding', w: 120 },
          { l: 'Status', w: 100 },
        ]}
        rows={rows}
        emptyText="No client matches that."
      />

      <p className="gr" style={{ fontSize: '12.5px', marginTop: 12 }}>
        Outstanding is invoiced minus paid, computed — never stored, so the list and the client page
        can’t disagree.
      </p>
    </>
  )
}
