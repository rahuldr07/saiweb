import { useState } from 'react'
import { Banner, Btn } from '@/components/ui'
import { money } from '@/lib/format'
import { removeClient, saveClient, useClients } from '@/state/company'
import type { Client } from '@/data/types'

const TERMS = ['Net 15', 'Net 30', 'Net 45', 'Per order', 'Prepaid']
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

/**
 * A client.
 *
 * The short code is the load-bearing field: it is what appears on order numbers,
 * so it has to be unique and it cannot be quietly changed for past orders. Both
 * of those are said on the form rather than discovered later.
 */
export function ClientForm({
  name,
  onCancel,
  onDone,
  onRemove,
}: {
  name?: string
  onCancel: () => void
  onDone: (message: string) => void
  onRemove: (name: string) => void
}) {
  const clients = useClients()
  const c = clients.find((x) => x.n === name)

  const [n, setN] = useState(c?.n ?? '')
  const [dn, setDn] = useState(c?.dn ?? '')
  const [email, setEmail] = useState(c?.e ?? '')
  const [phone, setPhone] = useState(c?.p ?? '')
  const [terms, setTerms] = useState(c?.terms ?? 'Net 30')
  const [active, setActive] = useState(c?.active !== false)
  const [error, setError] = useState<string | null>(null)

  const submit = () => {
    const client = n.trim()
    const code = dn.trim().toUpperCase()
    if (!client) return setError('A client name is required.')
    if (!code) return setError('A short code is required — it is what appears on orders.')
    if (!/^[A-Z0-9]{2,6}$/.test(code))
      return setError('The code should be 2–6 letters or numbers, no spaces.')
    if (clients.some((x) => x.n !== name && x.n.toLowerCase() === client.toLowerCase()))
      return setError(`There is already a client called ${client}.`)
    const clash = clients.find((x) => x.n !== name && x.dn === code)
    if (clash) return setError(`${code} is already used by ${clash.n}.`)
    if (email && !EMAIL.test(email)) return setError('That email does not look right.')

    const next: Client = {
      ...(c ?? { orders: 0, inv: 0, total: 0, paid: 0 }),
      n: client,
      dn: code,
      e: email.trim(),
      p: phone.trim(),
      terms,
      active,
    } as Client
    saveClient(next, name)
    onDone(name ? `${client} saved` : `${client} added`)
  }

  const change =
    <T,>(set: (v: T) => void) =>
    (v: T) => {
      set(v)
      setError(null)
    }

  return (
    <>
      {error ? (
        <Banner kind="d" icon="⚑" style={{ marginBottom: 14 }}>
          {error}
        </Banner>
      ) : null}

      <div className="frm">
        <div className="fld">
          <label htmlFor="c-n">Client name</label>
          <input
            className="inp"
            id="c-n"
            placeholder="e.g. Ridgeline Title"
            autoComplete="off"
            value={n}
            onChange={(e) => change(setN)(e.target.value)}
          />
        </div>
        <div className="fld">
          <label htmlFor="c-dn">Code on orders</label>
          <input
            className="inp mono"
            id="c-dn"
            maxLength={6}
            placeholder="RDG"
            autoComplete="off"
            value={dn}
            onChange={(e) => change(setDn)(e.target.value)}
          />
          <div className="hint">
            Short code shown instead of the full name on internal screens and order numbers.
          </div>
        </div>
        <div className="fld">
          <label htmlFor="c-e">Email</label>
          <input
            className="inp"
            id="c-e"
            type="email"
            placeholder="orders@client.com"
            autoComplete="off"
            value={email}
            onChange={(e) => change(setEmail)(e.target.value)}
          />
        </div>
        <div className="fld">
          <label htmlFor="c-p">Phone</label>
          <input
            className="inp"
            id="c-p"
            type="tel"
            autoComplete="off"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </div>
        <div className="fld">
          <label htmlFor="c-t">Payment terms</label>
          <select className="inp" id="c-t" value={terms} onChange={(e) => setTerms(e.target.value)}>
            {TERMS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div className="fld">
          <label htmlFor="c-a">Status</label>
          <select
            className="inp"
            id="c-a"
            value={active ? '1' : '0'}
            onChange={(e) => setActive(e.target.value === '1')}
          >
            <option value="1">Active</option>
            <option value="0">Inactive — no new orders</option>
          </select>
        </div>
      </div>

      {c ? (
        <Banner kind="b" icon="◔" style={{ margin: '16px 0 0' }}>
          <span style={{ fontSize: '12.5px' }}>
            <b>{c.orders.toLocaleString()} orders</b> and <b>{money(c.total)}</b> invoiced to date.
            Changing the code does not rewrite past order numbers.
          </span>
        </Banner>
      ) : (
        <Banner
          kind="b"
          icon="◷"
          title={<span style={{ fontSize: '12.5px' }}>Set their turnaround next</span>}
          style={{ margin: '16px 0 0' }}
        >
          <span style={{ fontSize: '12.5px' }}>
            A new client falls back to the 24h default until you give them their own SLA.
          </span>
        </Banner>
      )}

      <div style={{ display: 'flex', gap: 9, justifyContent: 'flex-end', marginTop: 18 }}>
        <Btn variant="ghost" onClick={onCancel}>
          Cancel
        </Btn>
        {name ? (
          <Btn variant="danger" onClick={() => onRemove(name)}>
            Remove
          </Btn>
        ) : null}
        <Btn onClick={submit}>{name ? 'Save changes' : 'Add client'}</Btn>
      </div>
    </>
  )
}

/** Removing a client, with the history it takes with it stated first. */
export function ClientDelete({
  name,
  onCancel,
  onDone,
}: {
  name: string
  onCancel: () => void
  onDone: (message: string) => void
}) {
  const clients = useClients()
  const c = clients.find((x) => x.n === name)
  if (!c) return null

  return (
    <>
      <p style={{ fontSize: '13.5px' }}>
        {c.orders ? (
          <>
            They have <b>{c.orders.toLocaleString()} orders</b> and <b>{money(c.total)}</b> invoiced.
            Removing them takes that history with them.
          </>
        ) : (
          'They have no orders or invoices.'
        )}
      </p>
      <Banner kind="r" icon="⚑" style={{ marginTop: 14 }}>
        <span style={{ fontSize: '12.5px' }}>
          Marking them inactive stops new orders without losing anything. Removing is only right
          when the record should never have existed.
        </span>
      </Banner>
      <div style={{ display: 'flex', gap: 9, justifyContent: 'flex-end', marginTop: 18 }}>
        <Btn variant="ghost" onClick={onCancel}>
          Cancel
        </Btn>
        <Btn
          variant="danger"
          onClick={() => {
            removeClient(name)
            onDone(`${name} removed`)
          }}
        >
          Remove {name}
        </Btn>
      </div>
    </>
  )
}
