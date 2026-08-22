import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Assumption, Banner, Btn, Card, CardHead, Label, SecHead, Seg } from '@/components/ui'
import { useUi } from '@/state/ui'
import { ASSIGN_STAGES } from '@/data/org'
import { CLIENTS, PRODUCTS } from '@/data/catalog'
import { ORDERS } from '@/data/production'
import { budgetOK, curStageOf, hh, isDefaultRule, orderPlan, shareTotal } from '@/lib/sla'
import { Due } from '@/components/ui'
import {
  addOverride,
  addSla,
  removeOverride,
  removeSla,
  setBuffer,
  setClock,
  setPause,
  setShare,
  setSlaHours,
  useBudget,
  useClock,
  useSla,
} from '@/state/company'

/**
 * Where due dates come from.
 *
 * Three questions, kept apart because they are answered by different people: what
 * we promised the client, how that promise is divided between departments, and
 * how the clock behaves while it runs.
 */

const SUBS = ['Client promise', 'Stage budgets', 'How the clock runs'] as const
type Sub = (typeof SUBS)[number]

const r2 = (n: number) => Math.round(n * 100) / 100

export function SlaTab({ initialSub }: { initialSub?: string }) {
  const [sub, setSub] = useState<Sub>(
    SUBS.includes(initialSub as Sub) ? (initialSub as Sub) : 'Client promise',
  )

  return (
    <>
      <div className="seg" style={{ marginBottom: 18 }}>
        {SUBS.map((x) => (
          <button
            key={x}
            type="button"
            className={sub === x ? 'on' : ''}
            aria-pressed={sub === x}
            onClick={() => setSub(x)}
          >
            {x}
          </button>
        ))}
      </div>
      {sub === 'Client promise' ? <ClientPromise /> : null}
      {sub === 'Stage budgets' ? <StageBudgets /> : null}
      {sub === 'How the clock runs' ? <ClockRuns /> : null}
    </>
  )
}

/* ── what we promised ───────────────────────────────────────────────────── */

function ClientPromise() {
  const sla = useSla()
  const { openModal, closeModal, toast } = useUi()

  const fb = sla.find(isDefaultRule) ?? { cl: '—', pr: 'Any', h: 24 }
  /* A product with no rule inherits the fallback. If the fallback is shorter than
     the work takes, the due date is wrong from the moment the order arrives. */
  const under = PRODUCTS.filter((p) => !sla.some((x) => x.pr === p.id) && p.h > fb.h)

  const addRule = () =>
    openModal({
      title: 'Add a turnaround rule',
      body: <AddSla onCancel={closeModal} onDone={(m) => { closeModal(); toast(m) }} />,
    })

  const confirmRemove = (i: number) => {
    const r = sla[i]
    openModal({
      title: 'Remove this rule?',
      body: (
        <>
          <p style={{ fontSize: '13.5px' }}>
            <b>
              {r.cl} · {r.pr}
            </b>{' '}
            is promised in {r.h}h. Without it, those orders fall back to {fb.h}h.
          </p>
          <div style={{ display: 'flex', gap: 9, justifyContent: 'flex-end', marginTop: 18 }}>
            <Btn variant="ghost" onClick={closeModal}>
              Keep it
            </Btn>
            <Btn
              variant="danger"
              onClick={() => {
                removeSla(i)
                closeModal()
                toast(`${r.cl} · ${r.pr} removed`)
              }}
            >
              Remove
            </Btn>
          </div>
        </>
      ),
    })
  }

  const COLS = '170px 150px 150px 1fr 110px'

  return (
    <>
      <SecHead
        sub="Where due dates come from. Change a number here and every new order moves with it."
        actions={<Btn onClick={addRule}>＋ Add rule</Btn>}
      />

      {under.length ? (
        <Banner
          kind="d"
          icon="⚠"
          title={`${under.length} product${under.length === 1 ? ' is' : 's are'} promised faster than ${
            under.length === 1 ? 'it takes' : 'they take'
          }`}
          actions={
            <Btn variant="ghost" small onClick={addRule}>
              Add a rule
            </Btn>
          }
        >
          {under.map((p) => `${p.id} (${p.n}) needs about ${p.h}h`).join(', ')} — but{' '}
          {under.length === 1 ? 'it has' : 'they have'} no rule, so{' '}
          {under.length === 1 ? 'it inherits' : 'they inherit'} the {fb.h}h fallback.
          <div className="bs">
            Either add a rule for {under.length === 1 ? 'it' : 'them'} or accept that the due date
            will be wrong from the moment the order arrives.
          </div>
        </Banner>
      ) : null}

      <Assumption title="These hours are placeholders">
        I don’t have your real commitments, so every row below is a guess.{' '}
        <b>Replace them with what you’ve actually promised each client</b> — the whole due-date
        system is only as honest as this table.
      </Assumption>

      <Card>
        <CardHead
          title="Turnaround by client and product"
          actions={
            <span className="gr" style={{ fontSize: '12.5px' }}>
              most specific rule wins
            </span>
          }
        />
        <div className="tsc">
          <div style={{ minWidth: 800 }}>
            <div className="trow h" style={{ gridTemplateColumns: COLS }}>
              <span>Client</span>
              <span>Product</span>
              <span>Turnaround</span>
              <span>Applies to</span>
              <span />
            </div>
            <div className="tb">
              {sla.map((s, i) => (
                <div className="trow" key={`${s.cl}-${s.pr}-${i}`} style={{ gridTemplateColumns: COLS }}>
                  <div className="cell">
                    <div className={`v ${isDefaultRule(s) ? 'gr' : ''}`}>{s.cl}</div>
                  </div>
                  <div className="cell">
                    <div className="v">{s.pr}</div>
                  </div>
                  <div className="cell">
                    <input
                      className="inp mono"
                      type="number"
                      min={1}
                      max={336}
                      style={{ width: 82 }}
                      aria-label={`Turnaround hours for ${s.cl} ${s.pr}`}
                      defaultValue={s.h}
                      key={`h-${i}-${s.h}`}
                      onBlur={(e) => setSlaHours(i, e.target.value)}
                    />{' '}
                    <span className="gr" style={{ fontSize: '11.5px' }}>
                      hours
                    </span>
                  </div>
                  <div className="cell">
                    <div className="v gr" style={{ fontSize: '12.5px' }}>
                      {isDefaultRule(s)
                        ? 'anything without a specific rule'
                        : `${s.cl} orders for ${s.pr}`}
                    </div>
                  </div>
                  <div className="cell">
                    {isDefaultRule(s) ? (
                      <span className="gr" style={{ fontSize: '11.5px' }}>
                        the fallback
                      </span>
                    ) : (
                      <Btn variant="ghost" small onClick={() => confirmRemove(i)}>
                        Remove
                      </Btn>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Card>

      <p className="gr" style={{ fontSize: '12.5px', marginTop: 10 }}>
        The last row is the fallback and cannot be removed — every order needs a turnaround, even
        one from a client you have no rule for.
      </p>
    </>
  )
}

function AddSla({ onCancel, onDone }: { onCancel: () => void; onDone: (m: string) => void }) {
  const sla = useSla()
  const [cl, setCl] = useState(CLIENTS[0]?.n ?? '')
  const [pr, setPr] = useState('Any')
  const [h, setH] = useState('24')
  const [error, setError] = useState<string | null>(null)

  const submit = () => {
    const hours = parseInt(h, 10)
    if (!(hours > 0) || hours > 336) return setError('A turnaround between 1 and 336 hours.')
    if (sla.some((x) => x.cl === cl && x.pr === pr))
      return setError(
        `${cl} · ${pr} already has a rule. Edit its hours in the table instead of adding a second one — two rules for the same pair is how a due date becomes unpredictable.`,
      )
    addSla({ cl, pr, h: hours })
    onDone(`${cl} · ${pr} — ${hours}h`)
  }

  return (
    <>
      {error ? (
        <Banner kind="r" icon="⚠" style={{ marginBottom: 14 }}>
          {error}
        </Banner>
      ) : null}
      <div className="frm">
        <div className="fld">
          <label htmlFor="sla-cl">Client</label>
          <select className="inp" id="sla-cl" value={cl} onChange={(e) => { setCl(e.target.value); setError(null) }}>
            {CLIENTS.map((c) => (
              <option key={c.n} value={c.n}>
                {c.n}
              </option>
            ))}
          </select>
        </div>
        <div className="fld">
          <label htmlFor="sla-pr">Product</label>
          <select className="inp" id="sla-pr" value={pr} onChange={(e) => { setPr(e.target.value); setError(null) }}>
            <option value="Any">Any product — covers everything for this client</option>
            {PRODUCTS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.id} — {p.n}
              </option>
            ))}
          </select>
        </div>
        <div className="fld">
          <label htmlFor="sla-h">Turnaround</label>
          <input
            className="inp mono"
            id="sla-h"
            type="number"
            min={1}
            max={336}
            style={{ width: 90 }}
            value={h}
            onChange={(e) => { setH(e.target.value); setError(null) }}
          />
          <div className="hint">
            A client × product rule beats a client × Any rule, which beats the fallback.
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 9, justifyContent: 'flex-end', marginTop: 18 }}>
        <Btn variant="ghost" onClick={onCancel}>
          Cancel
        </Btn>
        <Btn onClick={submit}>Add rule</Btn>
      </div>
    </>
  )
}

/* ── how it is divided ──────────────────────────────────────────────────── */

function StageBudgets() {
  const budget = useBudget()
  const { toast } = useUi()
  const navigate = useNavigate()
  const [pr, setPr] = useState('base')

  const ov = pr === 'base' ? null : budget.over.find((x) => x.pr === pr)
  const sh = ov ? ov.shares : budget.base
  const tot = shareTotal(sh)
  const ok = budgetOK(sh)
  const diff = r2(100 - tot)
  const win = 24 * (1 - budget.buffer / 100)

  /* Cumulative, built with a reduce so nothing is reassigned across a render. */
  const cps = ASSIGN_STAGES.reduce<{ st: string; h: number; c: number }[]>((acc, st) => {
    const h = (win * (sh[st] ?? 0)) / 100
    acc.push({ st, h, c: (acc[acc.length - 1]?.c ?? 0) + h })
    return acc
  }, [])

  const spare = PRODUCTS.map((p) => p.id).filter((id) => !budget.over.some((o) => o.pr === id))

  const risky = ORDERS.filter((o) => !o.done)
    .map((o) => ({ o, p: orderPlan(o) }))
    .filter((x) => x.p.behind || x.p.doomed)

  const RCOLS = '150px 130px 150px 1fr 150px'

  return (
    <>
      <SecHead sub="Where due dates come from. Change a number here and every new order moves with it." />

      <Assumption title="The 50/11/25/10/4 split is my guess, not your data">
        I picked these shares from how the work reads, not from timings.{' '}
        <b>Take a week of finished orders and measure how long each department actually held them</b>{' '}
        — the median is your split. Until then every checkpoint below is directionally right and
        numerically invented.
      </Assumption>

      <Banner
        kind="b"
        icon="◷"
        title="A client promise of 24 hours is not a Search department promise of 24 hours"
      >
        If Search finishes in the 23rd hour, Search QC, Typing, Typing QC and RTS have one hour
        between them — which is not a schedule, it’s a hope. Splitting the clock gives each
        department its own checkpoint, and lets the system say an order is unrecoverable at hour 11
        instead of hour 23.
      </Banner>

      <div className="two" style={{ marginTop: 18 }}>
        <Card padded>
          <Label>Share of the clock</Label>
          <div style={{ margin: '10px 0 14px' }}>
            <select
              className="inp"
              style={{ minWidth: 290 }}
              aria-label="Which products this split applies to"
              value={pr}
              onChange={(e) => setPr(e.target.value)}
            >
              <option value="base">Default — every product without its own split</option>
              {budget.over.map((o) => (
                <option key={o.pr} value={o.pr}>
                  {o.pr} — its own split
                </option>
              ))}
            </select>
          </div>

          {ASSIGN_STAGES.map((st) => (
            <div
              key={st}
              style={{
                display: 'grid',
                gridTemplateColumns: '110px 1fr 92px 78px',
                gap: 11,
                alignItems: 'center',
                padding: '7px 0',
              }}
            >
              <span style={{ fontSize: '12.5px', fontWeight: 600 }}>{st}</span>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                aria-label={`${st} share of the clock`}
                value={sh[st] ?? 0}
                onChange={(e) => setShare(pr, st, e.target.value)}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <input
                  className="inp mono"
                  type="number"
                  min={0}
                  max={100}
                  style={{ width: 62 }}
                  aria-label={`${st} share as a percentage`}
                  value={sh[st] ?? 0}
                  onChange={(e) => setShare(pr, st, e.target.value)}
                />
                <span className="gr" style={{ fontSize: '11.5px' }}>
                  %
                </span>
              </div>
              <span className="mono gr" style={{ fontSize: '11.5px', textAlign: 'right' }}>
                {hh((win * (sh[st] ?? 0)) / 100)}
              </span>
            </div>
          ))}

          <div
            className="rw"
            style={{
              marginTop: 12,
              background: ok ? 'var(--oktint)' : 'var(--warntint)',
              borderRadius: 9,
              padding: '11px 13px',
            }}
          >
            <span className={ok ? 'ok' : 'warn'} style={{ fontSize: '14.5px' }}>
              {ok ? '✓' : '⚠'}
            </span>
            <span>
              <b>
                {ok
                  ? 'The split accounts for the whole clock'
                  : diff > 0
                    ? `${diff}% unallocated`
                    : `${Math.abs(diff)}% over`}
              </b>
              <div className="sd">
                {ok
                  ? 'Every hour of the working window belongs to a department.'
                  : diff > 0
                    ? 'Unallocated time is time nobody owns — the checkpoints will be looser than they look.'
                    : 'The stages promise more time than the clock has. Checkpoints past the deadline are meaningless.'}
              </div>
            </span>
            <span className={`mono ${ok ? 'ok' : 'warn'}`} style={{ fontWeight: 700 }}>
              {r2(tot)}%
            </span>
          </div>

          <div className="fld" style={{ marginTop: 16 }}>
            <label htmlFor="bufin">Buffer held back at the end</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <input
                id="bufin"
                className="inp mono"
                type="number"
                min={0}
                max={50}
                style={{ width: 80 }}
                defaultValue={budget.buffer}
                key={`buf-${budget.buffer}`}
                onBlur={(e) => setBuffer(e.target.value)}
              />
              <span className="gr" style={{ fontSize: '12.5px' }}>
                % · on a 24h order that is {hh((24 * budget.buffer) / 100)} of slack before the
                client is let down
              </span>
            </div>
            <div className="hint">
              The stages divide the remaining {100 - budget.buffer}%. Without a buffer the last
              upload lands on the deadline itself, and any hiccup is a breach.
            </div>
          </div>

          {pr === 'base' ? (
            <Btn
              variant="ghost"
              small
              style={{ marginTop: 14 }}
              disabled={!spare.length}
              onClick={() => {
                if (!spare.length) return
                addOverride(spare[0])
                setPr(spare[0])
                toast(`${spare[0]} now has its own split`)
              }}
            >
              ＋ Give a product its own split
            </Btn>
          ) : (
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <Btn
                variant="ghost"
                small
                onClick={() => {
                  removeOverride(pr)
                  setPr('base')
                  toast(`${pr} falls back to the default split`)
                }}
              >
                Remove this override
              </Btn>
              <span className="gr" style={{ fontSize: '11.5px', alignSelf: 'center' }}>
                {pr} orders would fall back to the default split
              </span>
            </div>
          )}
        </Card>

        <Card padded>
          <Label>What each department must hit</Label>
          <p className="gr" style={{ fontSize: '12.5px', margin: '6px 0 12px' }}>
            Cumulative, measured from when the order arrived. Shown for a 24-hour promise
            {pr === 'base' ? '' : ` on a ${pr}`}.
          </p>
          <div className="tsc">
            <table className="mat" style={{ minWidth: 340 }}>
              <thead>
                <tr>
                  <th>Department</th>
                  <th style={{ textAlign: 'right' }}>Its slice</th>
                  <th style={{ textAlign: 'right' }}>Done by</th>
                </tr>
              </thead>
              <tbody>
                {cps.map((c) => (
                  <tr key={c.st}>
                    <td>
                      <b>{c.st}</b>
                    </td>
                    <td className="n mono">{hh(c.h)}</td>
                    <td className="tot">{hh(c.c)}</td>
                  </tr>
                ))}
                <tr>
                  <td className="gr">Buffer</td>
                  <td className="n mono gr">{hh((24 * budget.buffer) / 100)}</td>
                  <td className="tot corner">24h</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: 20 }}>
            <Label>The same split on other promises</Label>
          </div>
          <div className="tsc">
            <table className="mat" style={{ minWidth: 340 }}>
              <thead>
                <tr>
                  <th>Promise</th>
                  {ASSIGN_STAGES.map((st) => (
                    <th key={st} style={{ textAlign: 'right' }}>
                      {st}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[4, 24, 48, 72].map((H) => {
                  const w = H * (1 - budget.buffer / 100)
                  const run = ASSIGN_STAGES.reduce<number[]>((acc, st) => {
                    acc.push((acc[acc.length - 1] ?? 0) + (w * (sh[st] ?? 0)) / 100)
                    return acc
                  }, [])
                  return (
                    <tr key={H}>
                      <td>
                        <b>{H}h</b>
                        {H === 4 ? (
                          <span className="gr" style={{ fontSize: '10.5px' }}>
                            {' '}
                            rush
                          </span>
                        ) : null}
                      </td>
                      {ASSIGN_STAGES.map((st, i) => (
                        <td key={st} className="n mono">
                          {hh(run[i])}
                        </td>
                      ))}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <p className="gr" style={{ fontSize: '12.5px', marginTop: 10 }}>
            Because the split is a percentage, a 4-hour rush is governed by the same setting as a
            72-hour full search. Watch the rush row: {ASSIGN_STAGES[1]} gets{' '}
            {hh((4 * (1 - budget.buffer / 100) * (sh[ASSIGN_STAGES[1]] ?? 0)) / 100)}. If that is
            unrealistic, a rush needs its own split rather than a smaller slice of the same one.
          </p>
        </Card>
      </div>

      <h2 className="sec">What this catches right now</h2>
      {risky.length ? (
        <>
          <Card>
            <div className="tsc">
              <div style={{ minWidth: 820 }}>
                <div className="trow h" style={{ gridTemplateColumns: RCOLS }}>
                  <span>Order</span>
                  <span>Client</span>
                  <span>Stage</span>
                  <span>Why it is flagged</span>
                  <span>Deadline</span>
                </div>
                <div className="tb">
                  {risky.map(({ o, p }) => (
                    <div
                      className="trow"
                      key={o.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => navigate({ to: '/orders/$orderId', params: { orderId: o.id } })}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          navigate({ to: '/orders/$orderId', params: { orderId: o.id } })
                        }
                      }}
                      style={{ gridTemplateColumns: RCOLS }}
                    >
                      <div className="cell">
                        <div className="v mono">{o.id}</div>
                      </div>
                      <div className="cell">
                        <div className="v">{o.cl}</div>
                        <div className="s">{o.pr}</div>
                      </div>
                      <div className="cell">
                        <div className="v">{curStageOf(o) ?? '—'}</div>
                      </div>
                      <div className="cell">
                        <div className={`v ${p.doomed ? 'bad' : 'warn'}`} style={{ fontSize: '12.5px' }}>
                          {p.doomed
                            ? `The stages still to run need ${hh(p.needs)} and only ${
                                p.remaining > 0 ? hh(p.remaining) : '0h'
                              } remains — short by ${hh(p.short)}`
                            : `Past its ${p.rows.find((r) => r.behind)?.stage ?? ''} checkpoint`}
                        </div>
                      </div>
                      <div className="cell">
                        <Due at={o.due} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Card>
          <p className="gr" style={{ fontSize: '12.5px', marginTop: 10 }}>
            Every one of these was knowable hours ago. Without stage budgets none of them is visible
            until the client deadline itself passes.
          </p>
        </>
      ) : (
        <Card padded>
          <p className="gr" style={{ fontSize: '12.5px', margin: 0 }}>
            No open order has missed a departmental checkpoint. Raise a share above and this list
            will fill — it is computed, not stored.
          </p>
        </Card>
      )}
    </>
  )
}

/* ── how the clock behaves ──────────────────────────────────────────────── */

function ClockRuns() {
  const clock = useClock()
  const paused = Object.values(clock.pause).filter(Boolean).length

  const field = (
    key: 'start' | 'run' | 'tz',
    label: string,
    opts: [string, string][],
    hint: string,
  ) => (
    <div className="fld">
      <label>{label}</label>
      <Seg
        options={opts}
        value={clock[key]}
        onChange={(v) => setClock(key, v)}
      />
      <div className="hint">{hint}</div>
    </div>
  )

  return (
    <>
      <SecHead sub="Where due dates come from. Change a number here and every new order moves with it." />

      <div className="two">
        <Card padded>
          <Label>How the clock runs</Label>
          <div style={{ display: 'grid', gap: 14 }}>
            {field(
              'start',
              'Clock starts',
              [
                ['email', 'When the email arrives'],
                ['created', 'When the order is created'],
              ],
              clock.start === 'email'
                ? 'Starting at arrival is stricter and matches what the client experienced.'
                : 'Starting at creation forgives the gap between the email landing and someone opening it — and hides it from your own reporting.',
            )}
            {field(
              'run',
              'Runs',
              [
                ['247', '24/7 including weekends'],
                ['biz', 'Business hours only'],
              ],
              clock.run === '247'
                ? 'You advertise weekend work, so the clock should not stop on Saturday.'
                : 'A Friday 4pm order would now be due Monday. Check that is what you sell before leaving it here.',
            )}
            {field(
              'tz',
              'Deadline stated in',
              [
                ['ET', 'Eastern (client)'],
                ['IST', 'IST (team)'],
              ],
              clock.tz === 'ET'
                ? 'Both are shown everywhere; this picks which one is the promise.'
                : 'The team reads its own clock, but the client’s breach is judged in theirs. Stating it in IST invites an argument you will lose.',
            )}
          </div>
        </Card>

        <Card padded>
          <Label>Pause the clock while waiting on the client</Label>
          <div style={{ display: 'grid', gap: 8 }}>
            {Object.entries(clock.pause).map(([k, v]) => (
              <label
                key={k}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  fontSize: '13.5px',
                  padding: '9px 12px',
                  border: '1px solid var(--hair)',
                  borderRadius: 9,
                  background: v ? 'var(--tint)' : 'var(--card)',
                }}
              >
                <input type="checkbox" checked={v} onChange={(e) => setPause(k, e.target.checked)} />{' '}
                <b>{k}</b>
                <span className="gr" style={{ marginLeft: 'auto', fontSize: '11.5px' }}>
                  {v ? 'time here is not counted' : 'counts against the SLA'}
                </span>
              </label>
            ))}
          </div>
          <p className="gr" style={{ fontSize: '12.5px', marginTop: 12 }}>
            A paused order still shows on the board — it just stops burning the promise.{' '}
            {paused === 0 ? (
              <b className="warn">
                Nothing is paused, so time spent waiting on the client counts against you.
              </b>
            ) : null}
          </p>
        </Card>
      </div>

      <Card padded style={{ marginTop: 18 }}>
        <Label>What this produces</Label>
        <div className="rows">
          {[
            [
              'A due date on every order',
              'Computed at creation from client, product and arrival time — never typed by hand',
            ],
            ['Past due and due-within-4h counts', 'On the dashboard and in the sidebar badge'],
            ['Age in stage', 'So an order sitting 11 hours in Doc Req is visible before it is late'],
            ['On-time reporting that means something', 'Measured against a promise, not a feeling'],
          ].map(([t, d]) => (
            <div className="rw" key={t}>
              <span className="ok">✓</span>
              <span>
                <b>{t}</b>
                <div className="sd">{d}</div>
              </span>
              <span />
            </div>
          ))}
        </div>
      </Card>
    </>
  )
}
