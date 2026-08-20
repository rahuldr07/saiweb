import { useMemo, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Btn, Card, Chip, Form, Label, PageHead } from '@/components/ui'
import { RequireCap } from '@/components/RequireCap'
import { useUi } from '@/state/ui'
import { CLIENTS, COUNTIES, LINKTYPES, PRODUCTS } from '@/data/catalog'
import { ORDERS } from '@/data/production'
import { ASSIGN_STAGES, STAGES, STATUS } from '@/data/org'
import { board, previewAssign } from '@/lib/engine'
import { LSTATE, findCounty } from '@/lib/derived'
import { whoName } from '@/lib/permissions'
import { TIERS, dueFor, isDefaultRule, slaRuleFor, tierOf } from '@/lib/sla'
import { TZ, TZ2, fmtDate, fmtDT, initials, money } from '@/lib/format'
import { now } from '@/lib/clock'
import type { Assignments, CountyLink, Order } from '@/data/types'

/**
 * Taking an order by hand.
 *
 * Everything in the right-hand column is derived from the left as it is typed —
 * the due date from the client's SLA and the tier, the coverage from the county,
 * and the assignment from today's rules and today's load. None of it is a
 * separate decision to be made later, and none of it commits until the order is
 * created, which is what makes the panel worth reading rather than confirming.
 */

const statusLabel = (k: string) => STATUS[k]?.[0] ?? k

/** The operator's zone runs 9h30m ahead of the client's. */
const LOCAL_OFFSET_H = 9.5

const NO_LINK: CountyLink = { u: '', s: 'none' }

interface Draft {
  addr: string
  county: string
  st: string
  parcel: string
  client: string
  product: string
  ref: string
  eff: string
  buyer: string
  seller: string
  instr: string
  tier: string
}

const COUNTY_STATES = [...new Set(COUNTIES.map((c) => c.st))]

const blankDraft = (): Draft => ({
  addr: '',
  county: '',
  st: 'PA',
  parcel: '',
  client: CLIENTS.filter((c) => c.active !== false)[0]?.n ?? '',
  product: 'PRLP',
  ref: '',
  eff: fmtDate(now()),
  buyer: '',
  seller: '',
  instr: '',
  tier: 'standard',
})

/** The sidebar's section headings, which the design spaces out from the panel above. */
function AsideLabel({ children }: { children: string }) {
  return (
    <div className="lb" style={{ marginTop: 20 }}>
      {children}
    </div>
  )
}

function NewOrder() {
  const navigate = useNavigate()
  const { toast } = useUi()
  const [f, setF] = useState<Draft>(blankDraft)
  const [err, setErr] = useState<string | null>(null)

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => {
    setF((d) => ({ ...d, [k]: v }))
    setErr(null)
  }

  const product = PRODUCTS.find((p) => p.id === f.product) ?? PRODUCTS[0]
  const tier = tierOf(f.tier)
  const sla = slaRuleFor(f.client, f.product)
  const due = useMemo(() => dueFor(f.client, f.product, f.tier), [f.client, f.product, f.tier])
  const county = f.county ? findCounty(f.county, f.st) : undefined
  const fee = Math.round((product.fee + tier.up) * 100) / 100

  /* Same client, same address: not refused, but said out loud. A second order on
     one property is ordinary; placing it by accident is not. */
  const dupe = f.addr.trim()
    ? ORDERS.find(
        (o) => o.cl === f.client && o.prop.toLowerCase().trim() === f.addr.toLowerCase().trim(),
      )
    : undefined

  const preview = useMemo(
    () =>
      previewAssign({ pr: f.product, st: f.st, cl: f.client, co: f.county || null }, board().run.load),
    [f.product, f.st, f.client, f.county],
  )
  const unplaced = ASSIGN_STAGES.filter((s) => preview[s]?.err).length

  const openPerson = (id: string) => navigate({ to: '/staff/$personId', params: { personId: id } })

  const create = () => {
    if (!f.addr.trim()) return setErr('A property address is required.')
    if (!f.county.trim())
      return setErr(
        'A county is required — it decides the recording conventions and which links the searcher gets.',
      )
    if (!f.client) return setErr('Choose a client.')

    /* The preview becomes the assignment, and the load it was computed against
       moves with it — otherwise the next order placed in this session would be
       shown a desk that is emptier than it now is. */
    const load = board().run.load
    const a: Assignments = {}
    STAGES.forEach((s) => {
      a[s] = null
    })
    ASSIGN_STAGES.forEach((s) => {
      const who = preview[s]?.who
      if (!who) return
      a[s] = who
      load[who] = (load[who] ?? 0) + 1
    })

    const id = `41934${String(10 + ORDERS.length).padStart(2, '0')}-1`
    const order: Order = {
      id,
      cl: f.client,
      pr: f.product,
      stt: 'search',
      st: f.st,
      co: f.county.trim(),
      prop: f.addr.trim(),
      a,
      due: due.at,
      recv: now(),
      fee,
      age: 'just arrived',
      ref: f.ref,
      buyer: f.buyer,
      seller: f.seller,
      instr: f.instr,
      parcel: f.parcel,
      eff: f.eff,
    }
    ORDERS.unshift(order)
    toast(`${id} taken — due ${fmtDT(due.at)} ${TZ}`)
    navigate({ to: '/orders/$orderId', params: { orderId: id } })
  }

  return (
    <>
      <PageHead
        parent={{ to: '/orders', label: 'Orders' }}
        title="New order"
        sub="Everything on the right updates as you type — the due date, the coverage, and who would pick it up."
      />

      {/* Written out rather than passed through `Banner`, which puts its body in
          the small grey sub-line. The design states these at full size. */}
      {err ? (
        <div className="bnr d">
          <span className="bi">⚑</span>
          <div>
            <div className="bt">{err}</div>
          </div>
        </div>
      ) : null}

      {dupe ? (
        <div className="bnr r">
          <span className="bi">⚑</span>
          <div>
            <div className="bt">{f.client} already has an order on this address</div>
            {dupe.id} — {statusLabel(dupe.stt)}, due {fmtDT(dupe.due)} {TZ}. Placing another may be a
            duplicate.
          </div>
          <div className="ba">
            <Btn
              variant="ghost"
              small
              onClick={() => navigate({ to: '/orders/$orderId', params: { orderId: dupe.id } })}
            >
              Open it
            </Btn>
          </div>
        </div>
      ) : null}

      <div className="two">
        <div>
          <Card padded>
            <Label>Property</Label>
            <Form>
              <div className="fld" style={{ gridColumn: '1/-1' }}>
                <label htmlFor="n-ad">Address</label>
                <input
                  className="inp"
                  id="n-ad"
                  value={f.addr}
                  placeholder="Street, city"
                  onChange={(e) => set('addr', e.target.value)}
                />
              </div>
              <div className="fld">
                <label htmlFor="n-co">County</label>
                <input
                  className="inp"
                  id="n-co"
                  list="n-colist"
                  value={f.county}
                  placeholder="e.g. Cambria"
                  onChange={(e) => set('county', e.target.value)}
                />
                <datalist id="n-colist">
                  {COUNTIES.map((c) => (
                    <option key={`${c.n}-${c.st}`} value={c.n}>
                      {c.n}, {c.st}
                    </option>
                  ))}
                </datalist>
              </div>
              <div className="fld">
                <label htmlFor="n-st">State</label>
                <select
                  className="inp"
                  id="n-st"
                  value={f.st}
                  onChange={(e) => set('st', e.target.value)}
                >
                  {COUNTY_STATES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div className="fld">
                <label htmlFor="n-pi">Parcel ID</label>
                <input
                  className="inp mono"
                  id="n-pi"
                  value={f.parcel}
                  placeholder="optional"
                  onChange={(e) => set('parcel', e.target.value)}
                />
              </div>
            </Form>
          </Card>

          <Card padded style={{ marginTop: 16 }}>
            <Label>Order</Label>
            <Form>
              <div className="fld">
                <label htmlFor="n-cl">Client</label>
                <select
                  className="inp"
                  id="n-cl"
                  value={f.client}
                  onChange={(e) => set('client', e.target.value)}
                >
                  {CLIENTS.filter((c) => c.active !== false).map((c) => (
                    <option key={c.n} value={c.n}>
                      {c.n}
                    </option>
                  ))}
                </select>
              </div>
              <div className="fld">
                <label htmlFor="n-rf">Their file number</label>
                <input
                  className="inp mono"
                  id="n-rf"
                  value={f.ref}
                  placeholder="optional"
                  onChange={(e) => set('ref', e.target.value)}
                />
              </div>
              <div className="fld">
                <label htmlFor="n-pr">Product</label>
                <select
                  className="inp"
                  id="n-pr"
                  value={f.product}
                  onChange={(e) => set('product', e.target.value)}
                >
                  {PRODUCTS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.id} — {p.n}
                    </option>
                  ))}
                </select>
              </div>
              <div className="fld">
                <label htmlFor="n-ef">Effective date</label>
                <input
                  className="inp mono"
                  id="n-ef"
                  value={f.eff}
                  onChange={(e) => set('eff', e.target.value)}
                />
              </div>
              <div className="fld" style={{ gridColumn: '1/-1' }}>
                <label>Turnaround</label>
                <div className="seg">
                  {TIERS.map((x) => (
                    <button
                      key={x.id}
                      type="button"
                      className={f.tier === x.id ? 'on' : ''}
                      aria-pressed={f.tier === x.id}
                      onClick={() => set('tier', x.id)}
                    >
                      {x.n}
                      {x.up ? ` +$${x.up}` : ''}
                    </button>
                  ))}
                </div>
                <div className="hint">
                  Priority halves the SLA, rush quarters it. The due date on the right follows.
                </div>
              </div>
            </Form>
          </Card>

          <Card padded style={{ marginTop: 16 }}>
            <Label>Parties</Label>
            <Form>
              <div className="fld">
                <label htmlFor="n-bu">Buyer / borrower</label>
                <input
                  className="inp"
                  id="n-bu"
                  value={f.buyer}
                  onChange={(e) => set('buyer', e.target.value)}
                />
              </div>
              <div className="fld">
                <label htmlFor="n-se">Seller</label>
                <input
                  className="inp"
                  id="n-se"
                  value={f.seller}
                  onChange={(e) => set('seller', e.target.value)}
                />
              </div>
            </Form>
            <p className="gr" style={{ fontSize: '12.5px', marginTop: 10 }}>
              Each name is indexed separately for the judgment and lien search. Put one name per box.
            </p>
          </Card>

          <Card padded style={{ marginTop: 16 }}>
            <Label>Instructions to the searcher</Label>
            <textarea
              className="inp"
              id="n-in"
              placeholder="Anything the abstractor needs to know — carried through verbatim"
              value={f.instr}
              onChange={(e) => set('instr', e.target.value)}
            />
          </Card>
        </div>

        <aside>
          <Card padded style={{ position: 'sticky', top: 76 }}>
            <Label>Due</Label>
            <div className="mono" style={{ fontSize: '17px', fontWeight: 600 }}>
              {fmtDT(due.at)}{' '}
              <span className="gr" style={{ fontSize: '11.5px' }}>
                {TZ}
              </span>
            </div>
            <div className="gr mono" style={{ fontSize: '11.5px', marginTop: 3 }}>
              {fmtDT(new Date(due.at.getTime() + LOCAL_OFFSET_H * 3600000))} {TZ2}
            </div>
            <p className="gr" style={{ fontSize: '11.5px', marginTop: 8 }}>
              {due.h}h from now —{' '}
              {isDefaultRule(sla)
                ? `the ${due.base}h default for ${product.id}`
                : `${sla.cl} × ${sla.pr} is ${due.base}h`}
              {tier.mult !== 1 ? `, ${tier.n.toLowerCase()} at ×${tier.mult}` : ''}.
            </p>

            <AsideLabel>Coverage</AsideLabel>
            {!f.county ? (
              <p className="gr" style={{ fontSize: '12.5px' }}>
                Enter a county to check.
              </p>
            ) : county ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Chip kind={county.idx ? 'v' : 'r'}>
                    {county.idx ? `Recorder online ${county.idx}` : 'Recorder manual'}
                  </Chip>
                </div>
                {LINKTYPES.map((t) => {
                  const l = county.links[t.k] ?? NO_LINK
                  if (l.s === 'ok') return null
                  return (
                    <p
                      key={t.k}
                      className={l.s === 'none' ? 'warn' : 'bad'}
                      style={{ fontSize: '11.5px', marginTop: 6 }}
                    >
                      {t.n}: {LSTATE[l.s][0].toLowerCase()}
                      {l.err ? ` — ${l.err}` : ''}
                    </p>
                  )
                })}
                {LINKTYPES.every((t) => (county.links[t.k] ?? NO_LINK).s === 'ok') ? (
                  <p className="ok" style={{ fontSize: '11.5px', marginTop: 6 }}>
                    All four links working.
                  </p>
                ) : (
                  <Btn
                    variant="ghost"
                    small
                    style={{ marginTop: 8 }}
                    onClick={() => navigate({ to: '/linkcheck' })}
                  >
                    Link monitor
                  </Btn>
                )}
              </>
            ) : (
              <>
                <div>
                  <Chip kind="d">Not on file</Chip>
                </div>
                <p className="gr" style={{ fontSize: '11.5px', marginTop: 7 }}>
                  {f.county}, {f.st} is not in your county record. You can still place the order — the
                  searcher will be working without the links.
                </p>
                <Btn
                  variant="ghost"
                  small
                  style={{ marginTop: 8 }}
                  onClick={() => navigate({ to: '/counties' })}
                >
                  Add the county
                </Btn>
              </>
            )}

            <AsideLabel>Who would pick it up</AsideLabel>
            {ASSIGN_STAGES.map((s) => {
              const a = preview[s]
              const who = a?.who
              return (
                <div
                  key={s}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '5px 0',
                    fontSize: '12.5px',
                  }}
                >
                  <span className="gr" style={{ width: 82, flex: 'none' }}>
                    {s}
                  </span>
                  {who ? (
                    <>
                      <button
                        type="button"
                        className="ava"
                        style={{ width: 21, height: 21, fontSize: '8.5px' }}
                        title="Open profile"
                        onClick={() => openPerson(who)}
                      >
                        {initials(whoName(who))}
                      </button>
                      <button type="button" className="lnk" onClick={() => openPerson(who)}>
                        {whoName(who)}
                      </button>
                    </>
                  ) : (
                    <span className="bad">— {a?.err}</span>
                  )}
                </div>
              )
            })}
            {unplaced ? (
              <p className="warn" style={{ fontSize: '11.5px', marginTop: 7 }}>
                {unplaced} stage{unplaced === 1 ? '' : 's'} would land in the exception queue.
              </p>
            ) : (
              <p className="gr" style={{ fontSize: '11.5px', marginTop: 7 }}>
                Applying today’s rules and current load. It commits when you create the order.
              </p>
            )}

            <AsideLabel>Price</AsideLabel>
            <dl className="kv" style={{ fontSize: '12.5px' }}>
              <dt>{product.id}</dt>
              <dd className="mono">{money(product.fee)}</dd>
              {tier.up ? (
                <>
                  <dt>{tier.n}</dt>
                  <dd className="mono">+{money(tier.up)}</dd>
                </>
              ) : null}
              <dt style={{ fontWeight: 600 }}>Total</dt>
              <dd className="mono" style={{ fontWeight: 600 }}>
                {money(fee)}
              </dd>
            </dl>

            <Btn style={{ width: '100%', marginTop: 18 }} onClick={create}>
              Create order
            </Btn>
            <Btn
              variant="ghost"
              style={{ width: '100%', marginTop: 8 }}
              onClick={() => navigate({ to: '/orders' })}
            >
              Cancel
            </Btn>
          </Card>
        </aside>
      </div>
    </>
  )
}

export default function NewOrderRoute() {
  return (
    <RequireCap cap="all">
      <NewOrder />
    </RequireCap>
  )
}
