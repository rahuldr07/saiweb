import { useState } from 'react'
import { useNavigate, useParams } from '@tanstack/react-router'
import {
  Avatar,
  Banner,
  Btn,
  Card,
  CardHead,
  Chip,
  Empty,
  Field,
  Form,
  Label,
  PageHead,
  ReadOnly,
  Rows,
  Tabs,
} from '@/components/ui'
import { useSession } from '@/state/session'
import { useUi } from '@/state/ui'
import { ORDERS } from '@/data/production'
import { PRODUCTS, COUNTIES } from '@/data/catalog'
import { PAIRS, STAGES, STATUS } from '@/data/org'
import { AVAIL, STAFF } from '@/data/people'
import { BUDGET } from '@/data/budget'
import { NOW, TZ, TZ2, fmtDT, fmtDate, hrs, money } from '@/lib/format'
import { whoName } from '@/lib/permissions'
import { LSTATE } from '@/lib/derived'
import { SLA, hh, orderPlan } from '@/lib/sla'

const st = (k: string) => STATUS[k]?.[0] ?? k

const TABS = ['Details', 'Assignment', 'Documents', 'History', 'County links'] as const
type Tab = (typeof TABS)[number]

export default function OrderDetail() {
  const { orderId } = useParams({ from: '/orders/$orderId' })
  const navigate = useNavigate()
  const { me, can } = useSession()
  const { toast } = useUi()
  const [tab, setTab] = useState<Tab>('Details')

  const found = ORDERS.find((x) => x.id === orderId)
  /* Assignments are edited in place on the record the screen is showing, so the
     strip on the register and this screen can never disagree. */
  const [assign, setAssign] = useState<Record<string, string | null>>(() => ({ ...(found?.a ?? {}) }))

  if (!found) {
    return (
      <>
        <Btn variant="ghost" small style={{ marginBottom: 14 }} onClick={() => navigate({ to: '/orders' })}>
          ← Orders
        </Btn>
        <PageHead
          title="That order is not here"
          sub="It may have been removed, or the link may be out of date."
        />
        <Card>
          <Empty
            icon="·"
            action={
              <Btn small onClick={() => navigate({ to: '/orders' })}>
                Back to orders
              </Btn>
            }
          >
            Nothing to show. If you reached this from a link, the order it pointed at no longer exists.
          </Empty>
        </Card>
      </>
    )
  }

  const o = found

  if (!can('all') && !Object.values(assign).includes(me.id)) {
    return (
      <>
        <Btn variant="ghost" small style={{ marginBottom: 14 }} onClick={() => navigate({ to: '/mywork' })}>
          ← My work
        </Btn>
        <PageHead title="Not one of yours" sub={`${me.n} is not on any stage of ${o.id}.`} />
        <Card padded style={{ maxWidth: 560 }}>
          <p style={{ fontSize: '13.5px', margin: 0 }}>
            Your account sees the orders you are working. If this one should be yours, whoever runs your
            department can assign it.
          </p>
          <div style={{ marginTop: 14 }}>
            <Btn onClick={() => navigate({ to: '/mywork' })}>Back to my queue</Btn>
          </div>
        </Card>
      </>
    )
  }

  const sla = SLA.find((s) => s.cl === o.cl && s.pr === o.pr) ?? SLA[SLA.length - 1]
  const plan = orderPlan({ ...o, a: assign })
  const county = COUNTIES.find((c) => c.n === o.co && c.st === o.st)

  /* The write goes to `POST /api/orders/:id/stages/:stageId` once the API is
     running; until then it lives in this screen's state, so nothing here mutates
     the seed data other screens read. */
  const setStage = (stage: string, value: string) => {
    const next = value === '__clear' ? null : value || null
    setAssign((a) => ({ ...a, [stage]: next }))
    toast(next ? `${stage} — ${whoName(next)}` : `${stage} — unassigned`)
  }

  return (
    <>
      <Btn variant="ghost" small style={{ marginBottom: 14 }} onClick={() => navigate({ to: '/orders' })}>
        ← Orders
      </Btn>

      <PageHead
        title={o.id}
        sub={`${o.pr} · ${o.prop}, ${o.co} County, ${o.st} · ${o.cl}`}
        actions={
          <>
            <Chip kind={o.done ? 'v' : o.due < NOW ? 'd' : 'b'}>{st(o.stt)}</Chip>
            {can('pricing') ? <Chip kind="n" plain>{money(o.fee)}</Chip> : null}
          </>
        }
      />

      <Tabs tabs={[...TABS]} value={tab} onChange={setTab} />

      {tab === 'Details' ? (
        <>
          <Card padded>
            <Label>Order</Label>
            <Form>
              <Field label="Order no">
                <ReadOnly>
                  <span className="mono">{o.id}</span>
                </ReadOnly>
              </Field>
              <Field
                label="Product"
                hint="Changing the product re-reads the SLA, so the due date and every stage checkpoint move with it."
              >
                <select className="inp" defaultValue={o.pr} onChange={(e) => toast(`Product → ${e.target.value}`)}>
                  {PRODUCTS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.id} — {p.n}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Stage">
                <select className="inp" defaultValue={o.stt} onChange={(e) => toast(`Stage → ${st(e.target.value)}`)}>
                  {Object.keys(STATUS).map((k) => (
                    <option key={k} value={k}>
                      {st(k)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Client">
                <ReadOnly>{o.cl}</ReadOnly>
              </Field>
              <Field label="Effective date">
                <input className="inp mono" defaultValue={fmtDate(hrs(-24 * 17))} />
              </Field>
              <Field label="Prior effective date" hint="Update searches run forward from here.">
                <input className="inp mono" defaultValue={fmtDate(hrs(-24 * 380))} />
              </Field>
              <Field label="Parcel ID">
                <input className="inp mono" placeholder="not captured" defaultValue="" />
              </Field>
              {can('pricing') ? (
                <Field label="Fee">
                  <ReadOnly>
                    <span className="mono">{money(o.fee)}</span>
                  </ReadOnly>
                </Field>
              ) : null}
              <div className="fld" style={{ gridColumn: '1/-1' }}>
                <label>Property address</label>
                <input className="inp" defaultValue={`${o.prop}, ${o.co} County, ${o.st}`} />
              </div>
            </Form>
          </Card>

          <Card padded style={{ marginTop: 16 }}>
            <Label>Turnaround</Label>
            <Form>
              <Field label="Received">
                <ReadOnly>
                  <span className="mono">
                    {fmtDT(o.recv)} {TZ}
                  </span>
                </ReadOnly>
              </Field>
              <Field label="SLA applied">
                <ReadOnly>
                  {sla.cl} × {sla.pr} — {sla.h}h
                </ReadOnly>
              </Field>
              <Field label="Due">
                <ReadOnly>
                  <span className="mono" style={{ color: o.due < NOW ? 'var(--bad)' : 'var(--ink)' }}>
                    {fmtDT(o.due)} {TZ}
                  </span>
                </ReadOnly>
              </Field>
              <Field label="Local time">
                <ReadOnly>
                  <span className="mono">
                    {fmtDT(new Date(o.due.getTime() + 9.5 * 3600000))} {TZ2}
                  </span>
                </ReadOnly>
              </Field>
            </Form>
            {o.flag ? (
              <div style={{ marginTop: 14 }}>
                <Banner kind="r" icon="◷" title="Clock paused">
                  {o.flag} — time waiting on the client is not counted against the SLA.
                </Banner>
              </div>
            ) : null}
          </Card>

          <Card padded style={{ marginTop: 16 }}>
            <Label>Stage checkpoints</Label>
            <p className="gr" style={{ fontSize: '12.5px', margin: '6px 0 14px' }}>
              The {plan.slaH}-hour promise divided between the departments. Each row is the latest that stage
              can finish and still leave the rest of the pipeline the time it needs.
            </p>

            {plan.doomed ? (
              <Banner kind="r" icon="⚑" title="This order cannot be delivered on time">
                The stages still to run need <b>{hh(plan.needs)}</b> of work and only{' '}
                <b>{plan.remaining > 0 ? hh(plan.remaining) : 'no time'}</b> remains — short by{' '}
                <b>{hh(plan.short)}</b>. Tell the client now, or move it to someone who can compress the
                remaining stages. Waiting does not make this better.
              </Banner>
            ) : plan.behind ? (
              <Banner kind="r" icon="◷" title="Behind its internal checkpoint">
                Still deliverable — {hh(plan.remaining)} left against {hh(plan.needs)} of remaining work — but
                the slack is being spent.
              </Banner>
            ) : null}

            <div className="rows" style={{ border: 'none', borderRadius: 0 }}>
              {plan.rows.map((r) => (
                <div className="rw" key={r.stage}>
                  <span
                    className={r.done ? 'ok' : r.behind ? 'bad' : r.current ? 'warn' : 'gr'}
                    style={{ fontSize: '14.5px' }}
                  >
                    {r.done ? '✓' : r.behind ? '⚑' : r.current ? '◷' : '·'}
                  </span>
                  <span>
                    <b>{r.stage}</b>
                    <div className="sd">
                      {r.done
                        ? 'done'
                        : r.behind
                          ? `overdue — should have finished by ${fmtDT(r.at)} ${TZ}`
                          : r.current
                            ? `in progress — due by ${fmtDT(r.at)} ${TZ}`
                            : `by ${fmtDT(r.at)} ${TZ}`}
                    </div>
                  </span>
                  <span className="mono gr" style={{ fontSize: '11.5px' }}>
                    {r.pct}% · {hh(r.hours)}
                  </span>
                </div>
              ))}
              <div className="rw">
                <span className="gr">·</span>
                <span>
                  <b className="gr">Buffer</b>
                  <div className="sd">
                    {hh((plan.slaH * BUDGET.buffer) / 100)} of slack before the client deadline at{' '}
                    {fmtDT(o.due)} {TZ}
                  </div>
                </span>
                <span className="mono gr" style={{ fontSize: '11.5px' }}>
                  {BUDGET.buffer}%
                </span>
              </div>
            </div>
          </Card>
        </>
      ) : null}

      {tab === 'Assignment' ? (
        <>
          <Card>
            <CardHead title="Who owns each stage" />
            <div className="rows" style={{ border: 'none', borderRadius: 0 }}>
              {STAGES.map((s) => {
                const a = assign[s]
                const person = a ? STAFF.find((x) => x.id === a) : undefined
                const clash = !!person?.conflict && (s === 'Typing' || s === 'Typing QC')
                return (
                  <div className="rw" key={s}>
                    <span>
                      <Avatar name={a ? whoName(a) : null} self={clash} />
                    </span>
                    <span>
                      <b>{s}</b>
                      <div className="sd">
                        {a ? whoName(a) : 'Unassigned'}
                        {clash ? (
                          <> · <span className="bad">also assigned to the paired QC stage</span></>
                        ) : null}
                      </div>
                    </span>
                    <span>
                      <select
                        className="inp"
                        style={{ minWidth: 170 }}
                        aria-label={`Assign ${s}`}
                        value=""
                        onChange={(e) => setStage(s, e.target.value)}
                      >
                        <option value="">{a ? whoName(a) : '— choose —'}</option>
                        {STAFF.filter((x) => x.dep.includes(s) && x.id !== a && x.active !== false).map((x) => (
                          <option key={x.id} value={x.id}>
                            {x.n}
                            {x.avail !== 'ok' ? ` (${AVAIL[x.avail][0].toLowerCase()})` : ''}
                            {PAIRS[s] && assign[PAIRS[s]] === x.id ? ` — did the ${PAIRS[s]}` : ''}
                          </option>
                        ))}
                        {a ? <option value="__clear">— unassign —</option> : null}
                      </select>
                    </span>
                  </div>
                )
              })}
            </div>
          </Card>
          <div style={{ marginTop: 16 }}>
            <Banner icon="⚑" title="Self-review is blocked">
              A person cannot QC a stage they performed. Ashok S sits in both Typing and Typing QC, so he is
              filtered out of the QC list on any order he typed.
            </Banner>
          </div>
        </>
      ) : null}

      {tab === 'Documents' ? (
        <Card>
          <CardHead title="Documents in the package" />
          <Rows>
            {['Search package', 'Vesting deed', 'Open mortgages', 'Judgment and lien report', 'Tax status'].map(
              (d, i) => (
                <div className="rw" key={d}>
                  <span className={i < 3 ? 'ok' : 'gr'} style={{ fontSize: '14.5px' }}>
                    {i < 3 ? '✓' : '·'}
                  </span>
                  <span>
                    <b>{d}</b>
                    <div className="sd">{i < 3 ? 'Attached' : 'Not yet produced'}</div>
                  </span>
                  <span>
                    <Chip kind={i < 3 ? 'v' : 'n'}>{i < 3 ? 'Ready' : 'Pending'}</Chip>
                  </span>
                </div>
              ),
            )}
          </Rows>
        </Card>
      ) : null}

      {tab === 'History' ? (
        <Card>
          <CardHead title="Activity" />
          <Rows>
            <div className="rw">
              <span className="gr">·</span>
              <span>
                <b>Order received</b>
                <div className="sd">
                  {fmtDT(o.recv)} {TZ} · from {o.cl}
                </div>
              </span>
              <span className="mono gr" style={{ fontSize: '11.5px' }}>
                {o.id}
              </span>
            </div>
            {STAGES.filter((s) => assign[s]).map((s) => (
              <div className="rw" key={s}>
                <span className="ok">✓</span>
                <span>
                  <b>{s} assigned</b>
                  <div className="sd">{whoName(assign[s]!)}</div>
                </span>
                <span className="mono gr" style={{ fontSize: '11.5px' }}>
                  {s}
                </span>
              </div>
            ))}
          </Rows>
        </Card>
      ) : null}

      {tab === 'County links' ? (
        <Card>
          <CardHead title={`${o.co}, ${o.st}`} />
          {county ? (
            <Rows>
              {Object.entries(county.links).map(([k, l]) => {
                const [label, kind] = LSTATE[l.s]
                return (
                  <div className="rw" key={k}>
                    <span className="gr" style={{ textTransform: 'capitalize', fontSize: '12.5px' }}>
                      {k}
                    </span>
                    <span>
                      <b className="mono" style={{ fontSize: '12.5px' }}>
                        {l.u || 'no link on file'}
                      </b>
                    </span>
                    <span>
                      <Chip kind={kind}>{label}</Chip>
                    </span>
                  </div>
                )
              })}
            </Rows>
          ) : (
            <Empty icon="◈">
              {o.co}, {o.st} is not on the coverage register yet.
            </Empty>
          )}
        </Card>
      ) : null}
    </>
  )
}
