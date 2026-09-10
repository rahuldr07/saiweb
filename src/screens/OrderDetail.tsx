import { useState } from 'react'
import { useParams } from '@tanstack/react-router'
import { useGo } from '@/lib/nav'
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
import { useNotBuilt } from '@/components/notBuilt'
import { useSession } from '@/state/session'
import { useUi } from '@/state/ui'
import { useQcRules } from '@/state/qcRules'
import { useRules } from '@/state/rules'
import { CostForm } from './orders/CostForm'
import { DefectForm } from './orders/DefectForm'
import {
  addCost,
  addDoc,
  addNote,
  docsOf,
  markRated,
  orderAsEdited,
  setAssignee,
  setAssignments,
  setDoc,
  setOrderField,
  useOrderState,
  workingOn,
  type OrderEdits,
} from './orders/store'
import { ORDERS } from '@/data/production'
import { PRODUCTS, COUNTIES, LINKTYPES, LINKCHECK, BADSTATES } from '@/data/catalog'
import { ASSIGN_STAGES, PAIRS, STAGES, STATUS } from '@/data/org'
import { AVAIL, STAFF } from '@/data/people'
import { BUDGET } from '@/data/budget'
import {
  LOCAL_OFFSET_H,
  TZ,
  TZ2,
  fmtDT,
  fmtDate,
  hrs,
  money,
  orderChipKind,
  orderState,
} from '@/lib/format'
import { now } from '@/lib/clock'
import { whoName } from '@/lib/permissions'
import { LSTATE, days } from '@/lib/derived'
import { QC_CRITERIA, QC_SCALE } from '@/lib/quality'
import { arrivalAsOrder, arrivalById, board, narrowPool } from '@/lib/engine'
import { SLA, hh, orderPlan, slaHours } from '@/lib/sla'
import type { Assignments, OrderStatus } from '@/data/types'

const st = (k: string) => STATUS[k]?.[0] ?? k

/** The pipeline statuses, as a check rather than a cast. */
const isStatus = (v: string): v is OrderStatus => Object.hasOwn(STATUS, v)

/**
 * One order, eight tabs.
 *
 * The tabs are the design's own and each answers a different question: what the
 * order is, who owns each stage of it, how the work was scored, what is in the
 * package, what it cost to run, what has happened to it, what people said about
 * it, and where the searcher goes to research the county.
 *
 * Everything typed here lives in `orders/store` rather than in this component,
 * because a note written on one tab has to still be there from another — and
 * because the seed register is read by six other screens and must not be
 * mutated by the record it opens.
 */
const TABS = [
  'Details',
  'Assignment',
  'Quality',
  'Documents',
  'Costs',
  'History',
  'Notes',
  'County links',
] as const
type Tab = (typeof TABS)[number]

const DOCCOLS = '1.1fr 120px 130px 150px 130px 150px'
const COSTCOLS = '110px 1fr 150px 110px'
const DOC_KINDS = ['Deed', 'Mortgage', 'Assignment', 'Judgment', 'Tax', 'Plat']

export default function OrderDetail() {
  const { orderId } = useParams({ from: '/orders/$orderId' })
  const navigate = useGo()
  const { me, can } = useSession()
  const { toast, openModal, closeModal } = useUi()
  const notBuilt = useNotBuilt()
  const qcRules = useQcRules()
  const { rules } = useRules()
  const [tab, setTab] = useState<Tab>('Details')
  const [note, setNote] = useState('')

  /* Subscribed, so an edit on one tab redraws the others that read it — the
     total on Costs follows the product chosen on Details. */
  useOrderState()

  /* The register first, then today's assignment run. A queue built from the run
     — My work, the workload reports — holds ids the register has never seen, and
     linking those at a screen that only knows the register is what turned a row
     somebody was told to work into "that order is not here". */
  const arrival = arrivalById(orderId)
  const base =
    ORDERS.find((x) => x.id === orderId) ??
    (arrival ? arrivalAsOrder(arrival, slaHours(arrival)) : undefined)

  if (!base) {
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

  const w = workingOn(base.id)
  const o = orderAsEdited(base, w)
  const assign: Assignments = o.a

  /* Somebody without "see every order" gets the orders they are working. Opening
     one they are not on is a permission answer rather than an error, so it says
     which, and where the fix is. */
  if (!can('all') && !Object.values(assign).includes(me.id)) {
    return (
      <>
        <Btn variant="ghost" small style={{ marginBottom: 14 }} onClick={() => navigate({ to: '/mywork' })}>
          ← My work
        </Btn>
        <PageHead title="Not one of yours" sub={`${me.n} is not on any stage of ${o.id}.`} />
        <Card padded style={{ maxWidth: 560 }}>
          <p style={{ fontSize: '13.5px', margin: 0 }}>
            Your account sees the orders you are working. If this one should be yours, whoever runs
            your department can assign it.
          </p>
          <div style={{ marginTop: 14 }}>
            <Btn onClick={() => navigate({ to: '/mywork' })}>Back to my queue</Btn>
          </div>
        </Card>
      </>
    )
  }

  const sla = SLA.find((s) => s.cl === o.cl && s.pr === o.pr) ?? SLA[SLA.length - 1]
  const plan = orderPlan(o)
  const county = COUNTIES.find((c) => c.n === o.co && c.st === o.st)
  const docs = docsOf(o.id)
  const costs = w.costs
  const costTotal = Math.round(costs.reduce((a, c) => a + c.amt, 0) * 100) / 100
  const worked = STAGES.filter((s) => assign[s])
  const rated = w.rated || !!o.done
  const ratingRequired = qcRules.find((r) => r.k === 'mand')?.on ?? false
  const overdueBy = Math.abs(Math.round((o.due.getTime() - now().getTime()) / 3600000))

  /* An order taken at intake has a street address; one still moving through
     today's run does not, so the address reads from the county rather than
     opening on a stray comma. */
  const where = [o.prop, `${o.co} County`, o.st].filter(Boolean).join(', ')

  const field = <K extends keyof OrderEdits>(key: K, value: OrderEdits[K]) =>
    setOrderField(o.id, key, value)

  /* ── assignment ────────────────────────────────────────────────────────── */

  /**
   * QC independence, refused at the point of choosing rather than after.
   *
   * The engine filters the author out and the API re-checks before it writes.
   * This is the third place, and the one that has to explain itself — somebody
   * is about to wonder why the name they picked did not stick.
   */
  const setStage = (stage: string, value: string) => {
    if (!value) return
    if (value === '__clear') {
      setAssignee(o.id, stage, null)
      toast(`${stage} unassigned`)
      return
    }
    const paired = PAIRS[stage]
    if (paired && assign[paired] === value) {
      openModal({
        title: 'That would be self-review',
        body: (
          <>
            <p style={{ fontSize: '13.5px' }}>
              <b>{whoName(value)}</b> did the {paired} on this order. Checking their own work is the
              one thing the QC score cannot survive.
            </p>
            <p className="gr" style={{ fontSize: '12.5px', marginTop: 10 }}>
              Pick someone else, or turn the rule off under Quality → How scoring works if that is
              genuinely how you work.
            </p>
          </>
        ),
        footer: <Btn onClick={closeModal}>Pick someone else</Btn>,
      })
      return
    }
    setAssignee(o.id, stage, value)
    toast(`${stage} → ${whoName(value)}`)
  }

  /**
   * The engine's own narrowing, asked about this order.
   *
   * Assigning by hand and the automatic pass go through this one implementation,
   * so neither can drift into proposing somebody the other excludes: routing and
   * coverage narrow the pool here because they narrow it there, and a rule
   * switched off is off for both. The single difference is the daily target,
   * which `narrowPool` takes as an option — see there for why assigning by hand
   * does not answer to it.
   */
  const pickFor = (stage: string, taken: Assignments) =>
    narrowPool(o, stage, { load: board().run.load, taken, target: false })

  const assignAll = () => {
    const open = ASSIGN_STAGES.filter((g) => !assign[g])
    if (!open.length) return toast('Every stage already has an owner')

    const load = board().run.load
    const taken: Assignments = { ...assign }
    const preview = open.map((stage) => {
      const narrowed = pickFor(stage, taken)
      const person = narrowed.pool[0]
      if (person) taken[stage] = person.id
      return { stage, person, steps: narrowed.steps }
    })

    /* Named from the rules the narrowing actually consulted rather than from a
       list written out here. Everything but membership, self-review and the
       tie-break can be switched off under Assignment → Rules, and a sentence
       claiming a rule that is off is the same lie a second copy of the narrowing
       would have told. Listed in the rules' own order, so the names line up with
       the numbered list on that screen. */
    const consulted = new Set(preview.flatMap((p) => p.steps.map((s) => s.r)))
    const applied = rules.filter((r) => consulted.has(r.id)).map((r) => r.n)

    openModal({
      title: 'Assign the remaining stages',
      body: (
        <>
          <p style={{ fontSize: '13.5px' }}>
            {open.length} stage{open.length === 1 ? '' : 's'} on <b className="mono">{o.id}</b>{' '}
            {open.length === 1 ? 'has' : 'have'} nobody on {open.length === 1 ? 'it' : 'them'}.
          </p>
          <Rows bare>
            {preview.map(({ stage, person }) => (
              <div className="rw" key={stage}>
                <span className="gr">·</span>
                <span>
                  <b>{stage}</b>
                  <div className="sd">
                    {person ? (
                      `${person.n} — emptiest of the eligible at ${load[person.id] ?? 0}/${person.cap}`
                    ) : (
                      <span className="bad">nobody eligible</span>
                    )}
                  </div>
                </span>
                <span />
              </div>
            ))}
          </Rows>
          <p className="gr" style={{ fontSize: '12.5px', marginTop: 12 }}>
            These names come from the rules the automatic pass runs, as those rules stand right now:{' '}
            {applied.join(' · ')}. One switched off under Assignment → Rules is off here too. The
            daily target is the one this screen does not hold you to — the load beside each name is
            today’s automatic deal, and assigning by hand is how you go past it.
          </p>
        </>
      ),
      footer: (
        <>
          <Btn variant="ghost" onClick={closeModal}>
            Cancel
          </Btn>
          <Btn
            onClick={() => {
              const n = preview.filter((p) => p.person).length
              setAssignments(o.id, taken)
              closeModal()
              toast(`${n} stage${n === 1 ? '' : 's'} assigned`)
            }}
          >
            Assign these
          </Btn>
        </>
      ),
    })
  }

  /* ── the other actions ─────────────────────────────────────────────────── */

  const openCost = () =>
    openModal({
      title: 'Add a pass-through cost',
      body: (
        <CostForm
          onCancel={closeModal}
          onSubmit={(what, amt) => {
            addCost(o.id, what, amt, me.n)
            closeModal()
            toast(
              `${money(amt)} added — ${money(Math.round((costTotal + amt) * 100) / 100)} in pass-through costs on this order`,
            )
          }}
        />
      ),
    })

  const openDefect = () =>
    openModal({
      title: 'Log a defect',
      body: (
        <DefectForm
          onCancel={closeModal}
          onSubmit={(criterion, text) => {
            addNote(o.id, `Defect · ${criterion} — ${text}`, me.n, true)
            closeModal()
            toast('Defect logged against the order and the field')
            setTab('Notes')
          }}
        />
      ),
    })

  const postNote = () => {
    const v = note.trim()
    if (!v) return toast('Nothing to add — type the note first')
    addNote(o.id, v, me.n)
    setNote('')
    toast('Note added')
  }

  /* Every field commits as it is changed, so this reports what is held rather
     than pretending to be the thing that persisted it. */
  const save = () => {
    const n = Object.keys(w.edits).length
    toast(
      n
        ? `${n} change${n === 1 ? '' : 's'} held on ${o.id} — this session, until the API accepts writes`
        : 'Nothing has changed on this order',
    )
  }

  return (
    <>
      <Btn variant="ghost" small style={{ marginBottom: 14 }} onClick={() => navigate({ to: '/orders' })}>
        ← Orders
      </Btn>

      <PageHead
        title={o.prop || o.id}
        sub={`${o.id} · ${o.cl} · ${o.pr} · ${o.co} County, ${o.st}`}
        actions={
          <>
            <Chip kind={orderChipKind(o)}>{st(o.stt)}</Chip>
            {orderState(o) === 'late' ? <span className="due late">{overdueBy}h overdue</span> : null}
            <Btn variant="ghost" onClick={() => navigate({ to: '/commitment' })}>
              Open report
            </Btn>
            <Btn onClick={save}>Save</Btn>
          </>
        }
      />

      <Tabs tabs={[...TABS]} value={tab} onChange={setTab} />

      {/* ── details ── */}
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
                <select
                  className="inp"
                  aria-label="Product"
                  value={o.pr}
                  onChange={(e) => field('pr', e.target.value)}
                >
                  {PRODUCTS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.id} — {p.n}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Stage">
                <select
                  className="inp"
                  aria-label="Stage"
                  value={o.stt}
                  /* Narrowed rather than cast: a select can only offer these,
                     but the value arriving is a string either way. */
                  onChange={(e) => {
                    const next = e.target.value
                    if (isStatus(next)) field('stt', next)
                  }}
                >
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
              <Field label="Borrower">
                <input
                  className="inp"
                  aria-label="Borrower"
                  value={w.edits.bw ?? 'Sara Bahorik'}
                  onChange={(e) => field('bw', e.target.value)}
                />
              </Field>
              <Field label="Effective date">
                <input
                  className="inp mono"
                  aria-label="Effective date"
                  value={w.edits.ef ?? fmtDate(hrs(-24 * 17))}
                  onChange={(e) => field('ef', e.target.value)}
                />
              </Field>
              <Field label="Prior effective date" hint="Update searches run forward from here.">
                <input
                  className="inp mono"
                  aria-label="Prior effective date"
                  value={w.edits.oe ?? fmtDate(hrs(-24 * 380))}
                  onChange={(e) => field('oe', e.target.value)}
                />
              </Field>
              <Field label="Parcel ID">
                <input
                  className="inp mono"
                  aria-label="Parcel ID"
                  placeholder="not captured"
                  value={w.edits.pi ?? ''}
                  onChange={(e) => field('pi', e.target.value)}
                />
              </Field>
              {can('pricing') ? (
                <Field label="Loan amount">
                  <input
                    className="inp mono"
                    aria-label="Loan amount"
                    value={w.edits.la ?? '64,804.00'}
                    onChange={(e) => field('la', e.target.value)}
                  />
                </Field>
              ) : null}
              <div className="fld" style={{ gridColumn: '1/-1' }}>
                <label htmlFor="o-ad">Property address</label>
                <input
                  className="inp"
                  id="o-ad"
                  value={w.edits.ad ?? where}
                  onChange={(e) => field('ad', e.target.value)}
                />
              </div>
              <div className="fld" style={{ gridColumn: '1/-1' }}>
                <label htmlFor="o-nr">Names run</label>
                <input
                  className="inp"
                  id="o-nr"
                  placeholder="each name indexed separately for judgment and lien"
                  value={w.edits.nr ?? ''}
                  onChange={(e) => field('nr', e.target.value)}
                />
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
                  <span className="mono" style={{ color: o.due < now() ? 'var(--bad)' : 'var(--ink)' }}>
                    {fmtDT(o.due)} {TZ}
                  </span>
                </ReadOnly>
              </Field>
              <Field label="Local time">
                <ReadOnly>
                  <span className="mono">
                    {fmtDT(new Date(o.due.getTime() + LOCAL_OFFSET_H * 3600000))} {TZ2}
                  </span>
                </ReadOnly>
              </Field>
            </Form>
            {o.flag ? (
              <Banner kind="r" icon="◷" title="Clock paused" style={{ margin: '14px 0 0' }}>
                {o.flag}
                <div className="bs">Time waiting on the client is not counted against the SLA.</div>
              </Banner>
            ) : null}
          </Card>

          <Card padded style={{ marginTop: 16 }}>
            <Label>Stage checkpoints</Label>
            <p className="gr" style={{ fontSize: '12.5px', margin: '6px 0 14px' }}>
              The {plan.slaH}-hour promise divided between the departments. Each row is the latest
              that stage can finish and still leave the rest of the pipeline the time it needs.
            </p>

            {plan.doomed ? (
              <Banner
                kind="r"
                icon="⚑"
                title="This order cannot be delivered on time"
                style={{ margin: '0 0 14px' }}
              >
                The stages still to run need <b>{hh(plan.needs)}</b> of work and only{' '}
                <b>{plan.remaining > 0 ? hh(plan.remaining) : 'no time'}</b> remains — short by{' '}
                <b>{hh(plan.short)}</b>.
                <div className="bs">
                  Tell the client now, or move it to someone who can compress the remaining stages.
                  Waiting does not make this better.
                </div>
              </Banner>
            ) : plan.behind ? (
              <Banner
                kind="r"
                icon="◷"
                title="Behind its internal checkpoint"
                style={{ margin: '0 0 14px' }}
              >
                Still deliverable — {hh(plan.remaining)} left against {hh(plan.needs)} of remaining
                work — but the slack is being spent.
              </Banner>
            ) : null}

            <Rows bare>
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
            </Rows>

            <p className="gr" style={{ fontSize: '12.5px', marginTop: 12 }}>
              Set under{' '}
              <button
                type="button"
                className="lnk"
                onClick={() =>
                  navigate({
                    to: '/company',
                    search: { tab: 'Turnaround & SLA', sub: 'Stage budgets' },
                  })
                }
              >
                Turnaround &amp; SLA → Stage budgets
              </button>
              .
            </p>
          </Card>
        </>
      ) : null}

      {/* ── assignment ── */}
      {tab === 'Assignment' ? (
        <>
          <Card>
            <CardHead
              title="Who owns each stage"
              actions={
                <Btn variant="ghost" small onClick={assignAll}>
                  Assign all
                </Btn>
              }
            />
            <Rows bare>
              {STAGES.map((s) => {
                const a = assign[s]
                const person = a ? STAFF.find((x) => x.id === a) : undefined
                const clash = !!person?.conflict && (s === 'Typing' || s === 'Typing QC')
                return (
                  <div className="rw" key={s}>
                    <span>
                      <Avatar
                        name={a ? whoName(a) : null}
                        self={clash}
                        title={a ? `Open ${whoName(a)}` : 'Unassigned'}
                        onClick={
                          a
                            ? () => navigate({ to: '/staff/$personId', params: { personId: a } })
                            : undefined
                        }
                      />
                    </span>
                    <span>
                      <b>{s}</b>
                      <div className="sd">
                        {a ? (
                          <button
                            type="button"
                            className="lnk"
                            onClick={() =>
                              navigate({ to: '/staff/$personId', params: { personId: a } })
                            }
                          >
                            {whoName(a)}
                          </button>
                        ) : (
                          'Unassigned'
                        )}
                        {clash ? (
                          <>
                            {' · '}
                            <span className="bad">also assigned to the paired QC stage</span>
                          </>
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
                        {STAFF.filter((x) => x.dep.includes(s) && x.id !== a && x.active !== false).map(
                          (x) => (
                            <option key={x.id} value={x.id}>
                              {x.n}
                              {x.avail !== 'ok' ? ` (${AVAIL[x.avail][0].toLowerCase()})` : ''}
                              {PAIRS[s] && assign[PAIRS[s]] === x.id ? ` — did the ${PAIRS[s]}` : ''}
                            </option>
                          ),
                        )}
                        {a ? <option value="__clear">— unassign —</option> : null}
                      </select>
                    </span>
                  </div>
                )
              })}
            </Rows>
          </Card>

          <Banner kind="b" icon="⚑" title="Self-review is blocked" style={{ marginTop: 16 }}>
            A person cannot QC a stage they performed. Ashok S sits in both Typing and Typing QC, so
            he is filtered out of the QC list on any order he typed.
            <div className="bs">Configured under Quality → Segregation of duties.</div>
          </Banner>
        </>
      ) : null}

      {/* ── quality ── */}
      {tab === 'Quality' ? (
        <>
          <Banner
            kind={rated ? 'v' : 'r'}
            icon={rated ? '✓' : '★'}
            title={
              rated
                ? 'Rated — all stages scored before delivery'
                : 'A rating is required before this order can be marked Sent'
            }
          >
            {rated
              ? 'Every person who touched this order was scored on all three criteria.'
              : 'Each completed stage needs a score. Unrated stages block delivery.'}
            <div className="bs">
              Scale: {QC_SCALE.map(([n, label]) => `${n} ${label}`).join(' · ')}.{' '}
              <b>1 is the worst outcome, 5 the best.</b>
            </div>
          </Banner>

          <Card>
            <CardHead
              title="Rate the people on this order"
              actions={
                <span className="gr" style={{ fontSize: '12.5px' }}>
                  {worked.length} stage{worked.length === 1 ? '' : 's'} worked
                </span>
              }
            />
            {worked.length ? (
              <Rows bare>
                {worked.map((s) => (
                  <div className="rw" style={{ gridTemplateColumns: '1fr', gap: 11 }} key={s}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 11, flexWrap: 'wrap' }}>
                      <Avatar name={whoName(assign[s]!)} />
                      <span>
                        <b>{whoName(assign[s]!)}</b>
                        <div className="sd">{s}</div>
                      </span>
                      <span style={{ marginLeft: 'auto' }}>
                        {rated ? <Chip kind="v">5 · Good</Chip> : <Chip kind="r">Not rated</Chip>}
                      </span>
                    </div>
                    {rated ? null : (
                      <Form style={{ gap: 11 }}>
                        {QC_CRITERIA.map(([name, , question]) => (
                          <Field key={name} label={name} hint={question}>
                            <select className="inp" aria-label={`${name} for ${whoName(assign[s]!)}`}>
                              <option>— score —</option>
                              {QC_SCALE.map(([score, label]) => (
                                <option key={score}>
                                  {score} · {label}
                                </option>
                              ))}
                            </select>
                          </Field>
                        ))}
                        <div className="fld" style={{ gridColumn: '1/-1' }}>
                          <label>Comment</label>
                          <input
                            className="inp"
                            aria-label={`Comment for ${whoName(assign[s]!)}`}
                            placeholder="What specifically — field, page, what was wrong"
                          />
                        </div>
                      </Form>
                    )}
                  </div>
                ))}
              </Rows>
            ) : (
              <Empty
                icon="◔"
                action={
                  <Btn variant="ghost" small onClick={() => setTab('Assignment')}>
                    Go to assignment
                  </Btn>
                }
              >
                Nobody is assigned yet, so there is nothing to rate.
              </Empty>
            )}

            {worked.length && !rated ? (
              <div
                className="cb"
                style={{ borderTop: '1px solid var(--hair)', display: 'flex', gap: 9, flexWrap: 'wrap' }}
              >
                <Btn
                  disabled={!can('qc')}
                  title={can('qc') ? undefined : 'Your account cannot enter ratings'}
                  onClick={() => {
                    markRated(o.id)
                    toast(
                      ratingRequired
                        ? 'Ratings saved — the order can now be marked Sent'
                        : 'Ratings saved',
                    )
                  }}
                >
                  Save ratings
                </Btn>
                <Btn variant="ghost" onClick={openDefect}>
                  Log a defect instead
                </Btn>
                <span
                  className="gr"
                  style={{ fontSize: '12.5px', marginLeft: 'auto', alignSelf: 'center' }}
                >
                  A defect attaches to the field and page — that is what feeds the rulebook.
                </span>
              </div>
            ) : null}
          </Card>
        </>
      ) : null}

      {/* ── documents ── */}
      {tab === 'Documents' ? (
        <>
          <Card>
            <CardHead
              title="Documents in the package"
              actions={
                <>
                  <Btn
                    variant="ghost"
                    small
                    onClick={() => notBuilt('Upload', 'somewhere to put the file')}
                  >
                    Upload
                  </Btn>
                  <Btn small onClick={() => addDoc(o.id)}>
                    ＋ Add
                  </Btn>
                </>
              }
            />
            <div className="tsc">
              <div style={{ minWidth: 840 }}>
                <div className="trow h" style={{ gridTemplateColumns: DOCCOLS }}>
                  <span>Doc type</span>
                  <span>Recorded</span>
                  <span>Book/Page</span>
                  <span>Instrument no</span>
                  <span>Image</span>
                  <span>Extraction</span>
                </div>
                <div className="tb">
                  {docs.map((d) => (
                    <div className="trow" style={{ gridTemplateColumns: DOCCOLS }} key={d.id}>
                      <div className="cell">
                        {d.kind ? (
                          <div className="v">{d.kind}</div>
                        ) : (
                          <select
                            className="inp"
                            aria-label="Document type"
                            value=""
                            onChange={(e) => setDoc(o.id, d.id, 'kind', e.target.value)}
                          >
                            <option value="">— choose type —</option>
                            {DOC_KINDS.map((k) => (
                              <option key={k} value={k}>
                                {k}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                      <div className="cell">
                        {d.kind ? (
                          <div className="v mono">{d.recorded || '—'}</div>
                        ) : (
                          <input
                            className="inp mono"
                            aria-label="Recording date"
                            placeholder="MM/DD/YYYY"
                            value={d.recorded}
                            onChange={(e) => setDoc(o.id, d.id, 'recorded', e.target.value)}
                          />
                        )}
                      </div>
                      <div className="cell">
                        {d.kind ? (
                          <div className="v mono">{d.bookPage || '—'}</div>
                        ) : (
                          <input
                            className="inp mono"
                            aria-label="Book and page"
                            value={d.bookPage}
                            onChange={(e) => setDoc(o.id, d.id, 'bookPage', e.target.value)}
                          />
                        )}
                      </div>
                      <div className="cell">
                        {d.kind ? (
                          <div className="v mono">{d.instrument || '—'}</div>
                        ) : (
                          <input
                            className="inp mono"
                            aria-label="Instrument number"
                            value={d.instrument}
                            onChange={(e) => setDoc(o.id, d.id, 'instrument', e.target.value)}
                          />
                        )}
                      </div>
                      <div className="cell">
                        {d.image ? (
                          <Btn
                            variant="ghost"
                            small
                            onClick={() =>
                              notBuilt('Opening the scan', 'the original document files')
                            }
                          >
                            View
                          </Btn>
                        ) : (
                          <span className="gr" style={{ fontSize: '12.5px' }}>
                            no image
                          </span>
                        )}
                      </div>
                      <div className="cell">
                        {d.extraction === 'verified' ? (
                          <Chip kind="v">Verified</Chip>
                        ) : d.extraction === 'review' ? (
                          <Chip kind="r">Needs review</Chip>
                        ) : (
                          <span className="gr" style={{ fontSize: '12.5px' }}>
                            —
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Card>
          <p className="gr" style={{ fontSize: '12.5px', marginTop: 12 }}>
            An empty row shows <b>no</b> extraction status. A document is only “Verified” once a
            person has confirmed the reading against the image.
          </p>
        </>
      ) : null}

      {/* ── costs ── */}
      {tab === 'Costs' ? (
        <Card>
          <CardHead
            title="Pass-through costs"
            actions={
              <Btn small onClick={openCost}>
                ＋ Add cost
              </Btn>
            }
          />
          <div className="tsc">
            <div style={{ minWidth: 520 }}>
              <div className="trow h" style={{ gridTemplateColumns: COSTCOLS }}>
                <span>Date</span>
                <span>Type</span>
                <span>Paid by</span>
                <span>Amount</span>
              </div>
              <div className="tb">
                {costs.length ? (
                  costs.map((c) => (
                    <div className="trow" style={{ gridTemplateColumns: COSTCOLS }} key={c.id}>
                      <div className="cell">
                        <div className="v mono">{fmtDate(c.at)}</div>
                      </div>
                      <div className="cell">
                        <div className="v">{c.what}</div>
                      </div>
                      <div className="cell">
                        <div className="v">{c.by}</div>
                      </div>
                      <div className="cell">
                        <div className="v mono">{money(c.amt)}</div>
                      </div>
                    </div>
                  ))
                ) : (
                  <Empty icon="$">Nothing has been paid out on this order yet.</Empty>
                )}
              </div>
            </div>
          </div>
          <div
            className="cb"
            style={{ borderTop: '1px solid var(--hair)', display: 'flex', gap: 12, flexWrap: 'wrap' }}
          >
            <span className="gr" style={{ fontSize: '12.5px' }}>
              Search fee {money(o.fee)} + costs {money(costTotal)} =
            </span>
            <b className="mono">{money(Math.round((o.fee + costTotal) * 100) / 100)}</b>
            <span className="gr" style={{ fontSize: '12.5px', marginLeft: 'auto' }}>
              Costs are reimbursed at cost — no margin applied.
            </span>
          </div>
        </Card>
      ) : null}

      {/* ── history ── */}
      {tab === 'History' ? (
        <>
          <Card>
            <CardHead title="Activity log" actions={<Chip kind="v">Append-only</Chip>} />
            <Rows bare>
              {(
                [
                  [fmtDT(o.recv), 'Order created from email', 'system', `${o.cl} · Search Order.pdf`],
                  [
                    fmtDT(hrs(-29)),
                    'Due date set',
                    'system',
                    `SLA ${sla.cl} × ${sla.pr} = ${sla.h}h → ${fmtDT(o.due)} ${TZ}`,
                  ],
                  [
                    fmtDT(hrs(-28)),
                    'Assigned · Search',
                    'Harry Whitfield',
                    assign.Search ? whoName(assign.Search) : '—',
                  ],
                  [fmtDT(hrs(-12)), 'Stage changed', 'Uma Sankar', `Search → ${st(o.stt)}`],
                  [fmtDT(hrs(-6)), 'Field edited', 'Uma Sankar', 'Loan amount 64,084.00 → 64,804.00'],
                ] as [string, string, string, string][]
              ).map(([at, what, by, detail], i) => (
                <div className="rw" key={i}>
                  <span className="gr">·</span>
                  <span>
                    <b>{what}</b>
                    <div className="sd">{detail}</div>
                  </span>
                  <span style={{ textAlign: 'right' }}>
                    <div className="mono gr" style={{ fontSize: '11.5px' }}>
                      {at}
                    </div>
                    <div className="sd">{by}</div>
                  </span>
                </div>
              ))}
            </Rows>
          </Card>
          <p className="gr" style={{ fontSize: '12.5px', marginTop: 12 }}>
            Every create, status change, assignment, field edit, QC rating and delivery is recorded
            with who and when. This is the record that answers an insurer.
          </p>
        </>
      ) : null}

      {/* ── notes ── */}
      {tab === 'Notes' ? (
        <Card>
          <CardHead title="Internal notes" />
          <div className="cb">
            <textarea
              className="inp"
              aria-label="Add a note"
              rows={3}
              placeholder="Add a note — visible to your team only"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <div style={{ marginTop: 10 }}>
              <Btn small onClick={postNote}>
                Add note
              </Btn>
            </div>
          </div>
          <Rows bare>
            {w.notes.map((n) => (
              <div className="rw" key={n.id}>
                <span>
                  <Avatar name={n.by} />
                </span>
                <span>
                  <b>{n.by}</b>
                  <div className={`sd${n.defect ? ' bad' : ''}`}>{n.text}</div>
                </span>
                <span className="gr mono" style={{ fontSize: '11.5px' }}>
                  {fmtDT(n.at)}
                </span>
              </div>
            ))}
            <div className="rw">
              <span>
                <Avatar name="Vikki Sankar" />
              </span>
              <span>
                <b>Vikki Sankar</b>
                <div className="sd">
                  Doc req raised — deed referenced in the mortgage isn’t imaged in the package.
                </div>
              </span>
              <span className="gr mono" style={{ fontSize: '11.5px' }}>
                {fmtDT(hrs(-11))}
              </span>
            </div>
          </Rows>
        </Card>
      ) : null}

      {/* ── county links ── */}
      {tab === 'County links' ? (
        <Card padded>
          <Label>
            County research links — {o.co}, {o.st}
          </Label>
          {county ? (
            <>
              <Form>
                {LINKTYPES.map((t) => {
                  const l = county.links[t.k]
                  const status = l?.s ?? 'none'
                  return (
                    <Field
                      key={t.k}
                      label={
                        <>
                          {t.n}{' '}
                          {status === 'ok' ? null : (
                            <Chip kind={LSTATE[status][1]}>{LSTATE[status][0]}</Chip>
                          )}
                        </>
                      }
                      hint={
                        l?.err ? (
                          <span className="bad">
                            {l.err} — {l.since ? `${days(l.since)} days` : 'recently'}
                          </span>
                        ) : undefined
                      }
                    >
                      {l?.u ? (
                        <div
                          className={`ro${BADSTATES.includes(status) ? ' warn' : ''}`}
                          style={{ fontSize: '11.5px', overflowWrap: 'anywhere' }}
                        >
                          {l.u}
                        </div>
                      ) : (
                        <div className="ro warn">Not on file</div>
                      )}
                    </Field>
                  )
                })}
              </Form>

              {LINKTYPES.some((t) => {
                const l = county.links[t.k]
                return !l || BADSTATES.includes(l.s) || l.s === 'none'
              }) ? (
                <Banner
                  kind="r"
                  icon="⚑"
                  title="The searcher is short of at least one link here"
                  style={{ margin: '16px 0 0' }}
                  actions={
                    <Btn variant="ghost" small onClick={() => navigate({ to: '/linkcheck' })}>
                      Link monitor
                    </Btn>
                  }
                >
                  Checked every {LINKCHECK.every} days; last run{' '}
                  {days(LINKCHECK.last) === 0 ? 'today' : `${days(LINKCHECK.last)} days ago`}.
                </Banner>
              ) : (
                <p className="ok" style={{ fontSize: '12.5px', marginTop: 12 }}>
                  All {LINKTYPES.length} links working as of the last check.
                </p>
              )}
            </>
          ) : (
            <Empty
              icon="◈"
              action={
                <Btn variant="ghost" small onClick={() => navigate({ to: '/counties' })}>
                  Add the county
                </Btn>
              }
            >
              {o.co}, {o.st} is not in your county record, so the searcher has no links for it.
            </Empty>
          )}
        </Card>
      ) : null}
    </>
  )
}
