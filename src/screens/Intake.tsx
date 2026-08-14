import { useMemo, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Banner, Btn, Card, CardHead, Field, Form, PageHead, ReadOnly } from '@/components/ui'
import { RequireCap } from '@/components/RequireCap'
import { useUi } from '@/state/ui'
import { CLIENTS, COUNTIES, PRODUCTS } from '@/data/catalog'
import { ALLSTATES, countiesIn, stateName } from '@/lib/coverage'
import { NOW, TZ, fmtDT, money } from '@/lib/format'

/**
 * New order entry. The due date is computed from the product's SLA, and the
 * county is validated against coverage — we cannot promise work in a county we
 * do not cover.
 */
function Intake() {
  const { toast } = useUi()
  const navigate = useNavigate()

  const [client, setClient] = useState(CLIENTS[0].n)
  const [product, setProduct] = useState(PRODUCTS[0].id)
  const [state, setState] = useState(ALLSTATES()[0])
  const [county, setCounty] = useState(countiesIn(ALLSTATES()[0])[0] ?? '')
  const [address, setAddress] = useState('')
  const [notes, setNotes] = useState('')
  const [paste, setPaste] = useState('')

  const prod = PRODUCTS.find((p) => p.id === product) ?? PRODUCTS[0]
  const due = useMemo(() => new Date(NOW.getTime() + prod.h * 3600000), [prod.h])
  const covered = COUNTIES.some((c) => c.n === county && c.st === state)

  const submit = () => {
    if (!address.trim()) {
      toast('The property address is needed')
      return
    }
    if (!covered) {
      toast(`${county}, ${state} is not on the coverage register`)
      return
    }
    toast(`Order taken — ${prod.id} in ${county}, ${state}, due ${fmtDT(due)}`)
    navigate({ to: '/orders' })
  }

  /* A pasted email is parsed for the fields it obviously contains; anything it
     does not carry stays as it was, rather than being blanked. */
  const parse = () => {
    const text = paste
    const addr = /(?:property|address)\s*[:-]\s*(.+)/i.exec(text)?.[1]?.trim()
    const co = /county\s*[:-]\s*([A-Za-z .'-]+)/i.exec(text)?.[1]?.trim()
    const stMatch = /\b(?:state\s*[:-]\s*)?([A-Z]{2})\b/.exec(text)?.[1]
    const pr = PRODUCTS.find((p) => new RegExp(`\\b${p.id}\\b`, 'i').test(text))
    if (addr) setAddress(addr)
    if (stMatch && ALLSTATES().includes(stMatch)) {
      setState(stMatch)
      setCounty(countiesIn(stMatch)[0] ?? '')
    }
    if (co && COUNTIES.some((c) => c.n.toLowerCase() === co.toLowerCase())) setCounty(co)
    if (pr) setProduct(pr.id)
    toast(addr || co || pr ? 'Read what it could from the email' : 'Nothing recognisable in that text')
  }

  return (
    <>
      <PageHead
        title="Order intake"
        sub="One order at a time, or paste the client’s email and let it read what it can."
      />

      {!covered ? (
        <Banner kind="d" icon="⚑" title={`${county || 'That county'}, ${state} is not covered`}>
          Add it under County coverage first. Taking an order we cannot search is a promise we cannot keep.
        </Banner>
      ) : null}

      <Card padded>
        <CardHead title="The order" />
        <Form>
          <Field label="Client">
            <select className="inp" value={client} onChange={(e) => setClient(e.target.value)}>
              {CLIENTS.filter((c) => c.active !== false).map((c) => (
                <option key={c.n} value={c.n}>
                  {c.n}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Product" hint={`${prod.h}h SLA · ${money(prod.fee)}`}>
            <select className="inp" value={product} onChange={(e) => setProduct(e.target.value)}>
              {PRODUCTS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.id} — {p.n}
                </option>
              ))}
            </select>
          </Field>

          <Field label="State">
            <select
              className="inp"
              value={state}
              onChange={(e) => {
                setState(e.target.value)
                setCounty(countiesIn(e.target.value)[0] ?? '')
              }}
            >
              {ALLSTATES().map((s) => (
                <option key={s} value={s}>
                  {s} — {stateName(s)}
                </option>
              ))}
            </select>
          </Field>

          <Field label="County" hint="Validated against the coverage register.">
            <select className="inp" value={county} onChange={(e) => setCounty(e.target.value)}>
              {countiesIn(state).map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Due">
            <ReadOnly>
              <span className="mono">
                {fmtDT(due)} {TZ}
              </span>
            </ReadOnly>
          </Field>

          <Field label="Fee">
            <ReadOnly>
              <span className="mono">{money(prod.fee)}</span>
            </ReadOnly>
          </Field>

          <div className="fld" style={{ gridColumn: '1/-1' }}>
            <label htmlFor="in-addr">Property address</label>
            <input
              className="inp"
              id="in-addr"
              value={address}
              placeholder="118 Sara Ln, Johnstown"
              onChange={(e) => setAddress(e.target.value)}
            />
          </div>

          <div className="fld" style={{ gridColumn: '1/-1' }}>
            <label htmlFor="in-notes">Special instructions</label>
            <textarea
              className="inp"
              id="in-notes"
              value={notes}
              placeholder="Anything the searcher needs to know before starting"
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </Form>

        <div style={{ marginTop: 16, display: 'flex', gap: 9 }}>
          <Btn onClick={submit}>Take the order</Btn>
          <Btn
            variant="ghost"
            onClick={() => {
              setAddress('')
              setNotes('')
              toast('Cleared')
            }}
          >
            Clear
          </Btn>
        </div>
      </Card>

      <Card padded style={{ marginTop: 16 }}>
        <CardHead title="Paste an email" />
        <p className="gr" style={{ fontSize: '12.5px', margin: '6px 0 12px' }}>
          Most orders arrive as email. Paste one and the fields above fill in with whatever it can be read
          from — nothing is guessed, and anything it cannot find is left alone.
        </p>
        <textarea
          className="inp"
          value={paste}
          placeholder={'Property: 118 Sara Ln, Johnstown\nCounty: Cambria\nState: PA\nProduct: COS'}
          onChange={(e) => setPaste(e.target.value)}
          style={{ minHeight: 120 }}
        />
        <div style={{ marginTop: 12 }}>
          <Btn variant="ghost" onClick={parse}>
            Read it
          </Btn>
        </div>
      </Card>
    </>
  )
}

export default function IntakeRoute() {
  return (
    <RequireCap cap="all">
      <Intake />
    </RequireCap>
  )
}
