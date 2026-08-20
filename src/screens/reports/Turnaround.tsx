import { useMemo, useState } from 'react'
import { Btn, Card, Chip, Empty, Label, SectionHead } from '@/components/ui'
import { Cell, FlexRow, FlexTable } from '@/components/FlexTable'
import { FocusHead, FocusKpis } from '@/components/FocusKpis'
import { RangeBar } from '@/components/RangeBar'
import { DEFAULT_RANGE, inRange, resolveRange, type RangeState } from '@/lib/range'
import { ONTIMETARGET, median } from '@/lib/metrics'
import { checkpoints, hh } from '@/lib/sla'
import { ASSIGN_STAGES } from '@/data/org'
import { fmtDate } from '@/lib/format'
import type { Delivery } from '@/data/deliveries'

const DEL_COLS = '105px 150px 130px 110px 105px 110px 1fr'

/** The budget a stage was given on one delivery. */
const budgetFor = (x: Delivery, stage: string) =>
  checkpoints(x.slaH, x.pr).find((y) => y.stage === stage)?.hours ?? 0

/** Measured against the promise, not against a feeling. */
export function Turnaround({ deliveries }: { deliveries: Delivery[] }) {
  const [range, setRange] = useState<RangeState>(DEFAULT_RANGE)
  const [focus, setFocus] = useState('all')

  const r = resolveRange(range)
  const d = useMemo(() => deliveries.filter((x) => inRange(x.d, r)), [deliveries, r])

  const stages = useMemo(
    () =>
      ASSIGN_STAGES.map((st) => {
        const times = d.map((x) => x.st[st]).filter((v) => typeof v === 'number')
        const over = d.filter((x) => {
          const c = budgetFor(x, st)
          return c && x.st[st] > c
        })
        return {
          st,
          med: median(times),
          over: over.length,
          overPct: d.length ? Math.round((over.length / d.length) * 100) : 0,
          budget: median(d.map((x) => budgetFor(x, st))),
          share: 0,
        }
      }),
    [d],
  )

  if (!d.length) {
    return (
      <>
        <RangeBar id="t" value={range} onChange={setRange} />
        <Card>
          <Empty
            icon="◷"
            action={
              <Btn small onClick={() => setRange({ preset: '30' })}>
                Back to the last 30 days
              </Btn>
            }
          >
            Nothing was delivered in this range.
          </Empty>
        </Card>
      </>
    )
  }

  const late = d.filter((x) => x.late)
  const onTime = d.length - late.length
  const pct = Math.round((onTime / d.length) * 1000) / 10
  const avg = d.reduce((a, x) => a + x.hrs, 0) / d.length
  const med = median(d.map((x) => x.hrs))
  const totMed = stages.reduce((a, x) => a + x.med, 0) || 1
  stages.forEach((x) => (x.share = Math.round((x.med / totMed) * 100)))
  const worst = [...stages].sort((a, b) => b.overPct - a.overPct)[0]

  /* Week by week, so a bad fortnight is visible as a fortnight. */
  const weeks: { from: Date; to: Date; n: number; pct: number | null }[] = []
  for (let end = new Date(r.to); end >= r.from; end = new Date(end.getFullYear(), end.getMonth(), end.getDate() - 7)) {
    const st0 = new Date(end.getFullYear(), end.getMonth(), end.getDate() - 6)
    const wk = { from: st0 < r.from ? r.from : st0, to: end }
    const m = deliveries.filter((x) => inRange(x.d, { ...wk, label: '', preset: '' }))
    weeks.unshift({
      ...wk,
      n: m.length,
      pct: m.length ? Math.round(((m.length - m.filter((x) => x.late).length) / m.length) * 100) : null,
    })
    if (weeks.length > 14) break
  }

  const delRows = (list: Delivery[]) => (
    <FlexTable
      cols={DEL_COLS}
      min={940}
      head={['Delivered', 'Order', 'Client', 'Promise', 'Took', 'Outcome', 'Where the time went']}
    >
      {list.map((x) => {
        const over = ASSIGN_STAGES.map((st) => ({ st, h: x.st[st], c: budgetFor(x, st) }))
          .filter((y) => y.h > y.c)
          .sort((a, b) => b.h - b.c - (a.h - a.c))
        return (
          <FlexRow cols={DEL_COLS} key={x.id}>
            <Cell v={x.dk} mono />
            <Cell v={x.id} mono s={x.pr} />
            <Cell v={x.cl} />
            <Cell v={`${x.slaH}h`} mono />
            <Cell v={hh(x.hrs)} mono tone={x.late ? 'bad' : 'ok'} />
            <Cell>
              {x.late ? (
                <Chip kind="d">+{hh(x.hrs - x.slaH)}</Chip>
              ) : (
                <Chip kind="v">{hh(x.slaH - x.hrs)} spare</Chip>
              )}
            </Cell>
            <Cell>
              {over.length ? (
                <div className="v" style={{ fontSize: '12.5px' }}>
                  <b>{over[0].st}</b> {hh(over[0].h)} against {hh(over[0].c)}
                  {over.length > 1 ? <span className="gr"> +{over.length - 1} more over</span> : null}
                </div>
              ) : (
                <div className="v gr" style={{ fontSize: '12.5px' }}>
                  every department inside its budget
                </div>
              )}
            </Cell>
          </FlexRow>
        )
      })}
    </FlexTable>
  )

  const group = (key: 'cl' | 'pr', label: string) => {
    const keys = [...new Set(d.map((x) => x[key]))].sort()
    return (
      <Card>
        <div className="ch">
          <h2>By {label}</h2>
        </div>
        <div className="tsc">
          <table className="mat" style={{ minWidth: 620 }}>
            <thead>
              <tr>
                <th>{label[0].toUpperCase() + label.slice(1)}</th>
                <th style={{ textAlign: 'right' }}>Delivered</th>
                <th style={{ textAlign: 'right' }}>On time</th>
                <th style={{ textAlign: 'right' }}>Late</th>
                <th style={{ textAlign: 'right' }}>Median</th>
                <th style={{ textAlign: 'right' }}>Promise</th>
              </tr>
            </thead>
            <tbody>
              {keys.map((k) => {
                const m = d.filter((x) => x[key] === k)
                const l = m.filter((x) => x.late).length
                const p = Math.round(((m.length - l) / m.length) * 100)
                return (
                  <tr key={k}>
                    <td>
                      <b>{k}</b>
                    </td>
                    <td className="n">{m.length}</td>
                    <td className={`n ${p >= 95 ? 'ok' : p >= 85 ? 'warn' : 'bad'}`}>{p}%</td>
                    <td className={`n ${l ? 'warn' : 'gr'}`}>{l || '—'}</td>
                    <td className="n">{hh(median(m.map((x) => x.hrs)))}</td>
                    <td className="n gr">{median(m.map((x) => x.slaH))}h</td>
                  </tr>
                )
              })}
              <tr>
                <td style={{ fontWeight: 700 }}>All</td>
                <td className="tot">{d.length}</td>
                <td className="tot">{pct}%</td>
                <td className="tot">{late.length}</td>
                <td className="tot">{hh(med)}</td>
                <td className="tot">—</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>
    )
  }

  return (
    <>
      <RangeBar id="t" value={range} onChange={setRange} />

      <FocusKpis
        focus={focus}
        onFocus={setFocus}
        cards={[
          {
            key: 'ontime',
            title: 'On time',
            value: <span className={pct >= ONTIMETARGET ? 'ok' : 'warn'}>{pct}%</span>,
            tone: pct < ONTIMETARGET ? 'warn' : undefined,
            detail: `target ${ONTIMETARGET}%`,
            count: onTime,
          },
          {
            key: 'late',
            title: 'Late',
            value: <span className={late.length ? 'bad' : 'ok'}>{late.length}</span>,
            tone: late.length ? 'alert' : undefined,
            detail: `of ${d.length} delivered`,
            count: late.length,
          },
          {
            key: 'spread',
            title: 'Median turnaround',
            value: <span className="mono">{hh(med)}</span>,
            detail: `mean ${hh(avg)}`,
            count: d.length,
          },
          {
            key: 'worst',
            title: 'Worst stage',
            value: worst.st,
            detail: <span className="warn">over budget on {worst.overPct}%</span>,
            count: worst.over,
          },
        ]}
      />

      {focus === 'ontime' || focus === 'late' ? (
        (() => {
          const list = (focus === 'late' ? late : d.filter((x) => !x.late))
            .slice()
            .sort((a, b) =>
              focus === 'late' ? b.hrs - b.slaH - (a.hrs - a.slaH) : a.slaH - a.hrs - (b.slaH - b.hrs),
            )
          const tight = list.filter((x) => x.slaH - x.hrs < x.slaH * 0.1).length
          return (
            <>
              <FocusHead
                title={
                  focus === 'late'
                    ? `All ${list.length} late deliveries`
                    : `The ${list.length} that met the promise`
                }
                onBack={() => setFocus('all')}
              >
                {focus === 'late'
                  ? 'Worst overrun first, each attributed to the department that actually went over.'
                  : 'Tightest first — the ones at the top cleared by the smallest margin and are the ones to watch.'}
              </FocusHead>
              <SectionHead>{focus === 'late' ? 'Late' : 'On time'}</SectionHead>
              {delRows(list)}
              <p className="gr" style={{ fontSize: '12.5px', marginTop: 10 }}>
                {focus === 'late'
                  ? 'Attribution is by budget, not by who was holding it at the deadline.'
                  : `${tight} of these cleared with less than 10% of the promise to spare. They are late deliveries that happened not to be.`}
              </p>
            </>
          )
        })()
      ) : null}

      {focus === 'worst' ? (
        (() => {
          const items = d
            .filter((x) => budgetFor(x, worst.st) && x.st[worst.st] > budgetFor(x, worst.st))
            .map((x) => ({ x, h: x.st[worst.st], c: budgetFor(x, worst.st), ratio: x.st[worst.st] / budgetFor(x, worst.st) }))
            .sort((a, b) => b.ratio - a.ratio)
          const whoBy: Record<string, number> = {}
          items.forEach((i) => {
            const n = i.x.byName?.[worst.st]
            if (n) whoBy[n] = (whoBy[n] ?? 0) + 1
          })
          const peak = Math.max(1, ...Object.values(whoBy))
          return (
            <>
              <FocusHead
                title={`${worst.st} went over budget on ${items.length} of ${d.length} deliveries`}
                onBack={() => setFocus('all')}
              >
                That is {worst.overPct}% — far enough above the other departments that it is worth asking
                whether the budget is right before asking anything of the people.
              </FocusHead>
              <Card padded style={{ marginTop: 14 }}>
                <Label>Who was on those stages</Label>
                {Object.entries(whoBy)
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 10)
                  .map(([n, c]) => (
                    <div
                      key={n}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '190px 1fr 70px',
                        gap: 12,
                        alignItems: 'center',
                        padding: '5px 0',
                        fontSize: '12.5px',
                      }}
                    >
                      <span>{n}</span>
                      <span className="bar">
                        <i style={{ width: `${Math.round((c / peak) * 100)}%`, background: 'var(--warn)' }} />
                      </span>
                      <span className="mono gr" style={{ textAlign: 'right' }}>
                        {c}
                      </span>
                    </div>
                  ))}
                <p className="gr" style={{ fontSize: '12.5px', marginTop: 12 }}>
                  Spread across the whole department, which is the signature of a budget that is too tight
                  rather than a person who is too slow.
                </p>
              </Card>
              <SectionHead>Every {worst.st} overrun, worst first</SectionHead>
              <FlexTable
                cols="105px 150px 130px 105px 105px 130px 1fr"
                min={880}
                head={['Delivered', 'Order', 'Client', 'Took', 'Budget', 'Over by', 'Outcome']}
              >
                {items.map((i) => (
                  <FlexRow cols="105px 150px 130px 105px 105px 130px 1fr" key={i.x.id}>
                    <Cell v={i.x.dk} mono />
                    <Cell v={i.x.id} mono s={i.x.pr} />
                    <Cell v={i.x.cl} />
                    <Cell v={hh(i.h)} mono tone="warn" />
                    <Cell v={hh(i.c)} mono tone="gr" />
                    <Cell v={`${i.ratio.toFixed(2)}×`} mono tone={i.ratio > 2 ? 'bad' : 'warn'} />
                    <Cell>
                      {i.x.late ? <Chip kind="d">Delivered late</Chip> : <Chip kind="v">Absorbed</Chip>}
                    </Cell>
                  </FlexRow>
                ))}
              </FlexTable>
              <p className="gr" style={{ fontSize: '12.5px', marginTop: 10 }}>
                {items.filter((i) => !i.x.late).length} of these were absorbed by the buffer and the other
                departments. Overrunning is not the same as being late — but it spends the slack that covers
                everything else.
              </p>
            </>
          )
        })()
      ) : null}

      {focus === 'spread' ? (
        (() => {
          const buckets: [number, number][] = [
            [0, 0.5],
            [0.5, 0.75],
            [0.75, 0.9],
            [0.9, 1],
            [1, 1.25],
            [1.25, Infinity],
          ]
          const lab = [
            'under half the promise',
            '50–75%',
            '75–90%',
            '90–100%',
            'up to 25% over',
            'more than 25% over',
          ]
          return (
            <>
              <FocusHead title={`How the ${d.length} turnarounds are spread`} onBack={() => setFocus('all')}>
                A median of {hh(med)} against a mean of {hh(avg)}. When the mean sits above the median, a
                small number of very slow orders is pulling it — those are the ones worth reading.
              </FocusHead>
              <Card padded style={{ marginTop: 14 }}>
                <Label>Turnaround as a share of the promise</Label>
                {buckets.map((b, i) => {
                  const n = d.filter((x) => x.hrs / x.slaH >= b[0] && x.hrs / x.slaH < b[1]).length
                  return (
                    <div
                      key={lab[i]}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '190px 1fr 110px',
                        gap: 12,
                        alignItems: 'center',
                        padding: '6px 0',
                        fontSize: '12.5px',
                      }}
                    >
                      <span className="gr">{lab[i]}</span>
                      <span className="bar">
                        <i
                          style={{
                            width: `${Math.round((n / d.length) * 100)}%`,
                            background: b[0] >= 1 ? 'var(--warn)' : 'var(--ok)',
                          }}
                        />
                      </span>
                      <span className="mono" style={{ textAlign: 'right' }}>
                        {n} · {Math.round((n / d.length) * 100)}%
                      </span>
                    </div>
                  )
                })}
                <p className="gr" style={{ fontSize: '12.5px', marginTop: 12 }}>
                  Measured against each order's own promise, so a 48-hour full search and a 4-hour rush can
                  sit in the same bar.
                </p>
              </Card>
              <SectionHead>Slowest first</SectionHead>
              {delRows(d.slice().sort((a, b) => b.hrs / b.slaH - a.hrs / a.slaH).slice(0, 40))}
              <p className="gr" style={{ fontSize: '12.5px', marginTop: 10 }}>
                Top 40 by share of the promise used.
              </p>
            </>
          )
        })()
      ) : null}

      {focus === 'all' ? (
        <>
          <Card padded style={{ marginTop: 18 }}>
            <Label>Where the time goes — median hours per department, against the budget it was given</Label>
            <p className="gr" style={{ fontSize: '12.5px', margin: '6px 0 14px' }}>
              The pale bar is the budget from Company → Stage budgets; the solid bar is what actually
              happened.
            </p>
            {stages.map((x) => (
              <div
                key={x.st}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '118px 1fr 150px',
                  gap: 12,
                  alignItems: 'center',
                  padding: '7px 0',
                  fontSize: '12.5px',
                }}
              >
                <span className="gr">{x.st}</span>
                <span style={{ position: 'relative', height: 16 }}>
                  <span className="bar" style={{ position: 'absolute', inset: 0, height: 16 }}>
                    <i
                      style={{
                        width: `${Math.round((x.budget / Math.max(totMed, 1)) * 100)}%`,
                        background: 'var(--brandsoft)',
                      }}
                    />
                  </span>
                  <span
                    className="bar"
                    style={{ position: 'absolute', inset: '4px 0', height: 8, background: 'transparent' }}
                  >
                    <i
                      style={{
                        width: `${Math.round((x.med / Math.max(totMed, 1)) * 100)}%`,
                        background: x.overPct > 25 ? 'var(--warn)' : 'var(--brand2)',
                      }}
                    />
                  </span>
                </span>
                <span className="mono" style={{ textAlign: 'right', fontSize: '12.5px' }}>
                  {hh(x.med)} <span className="gr">of {hh(x.budget)}</span>
                  <span className={x.overPct > 25 ? 'warn' : 'gr'}> · over on {x.overPct}%</span>
                </span>
              </div>
            ))}
            <p className="gr" style={{ fontSize: '12.5px', marginTop: 12 }}>
              <b>{worst.st}</b> misses its checkpoint on {worst.overPct}% of orders —{' '}
              {worst.overPct > 25
                ? 'either the budget is wrong or the department is under-resourced, and the two need telling apart before anything is fixed.'
                : 'which is within tolerance. No stage is systematically starved.'}
            </p>
          </Card>

          <Card padded style={{ marginTop: 18 }}>
            <Label>On time, week by week</Label>
            <div style={{ display: 'flex', gap: 5, alignItems: 'flex-end', height: 120, margin: '14px 0 4px' }}>
              {weeks.map((wk) => (
                <div
                  key={wk.to.toISOString()}
                  style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'flex-end',
                    height: '100%',
                    gap: 5,
                  }}
                  title={`${fmtDate(wk.from)} – ${fmtDate(wk.to)}: ${wk.pct === null ? 'nothing delivered' : `${wk.pct}% on time from ${wk.n} orders`}`}
                >
                  <span className="mono gr" style={{ fontSize: '10.5px', textAlign: 'center' }}>
                    {wk.pct === null ? '—' : `${wk.pct}%`}
                  </span>
                  <span
                    style={{
                      background:
                        wk.pct === null
                          ? 'var(--hair)'
                          : wk.pct >= ONTIMETARGET
                            ? 'var(--ok)'
                            : wk.pct >= 90
                              ? 'var(--brand2)'
                              : 'var(--warn)',
                      borderRadius: '5px 5px 0 0',
                      height: `${wk.pct === null ? 3 : Math.max(3, wk.pct)}%`,
                    }}
                  />
                  <span className="mono gr" style={{ fontSize: '9.5px', textAlign: 'center' }}>
                    {String(wk.to.getMonth() + 1).padStart(2, '0')}/{String(wk.to.getDate()).padStart(2, '0')}
                  </span>
                </div>
              ))}
            </div>
            <p className="gr" style={{ fontSize: '12.5px', marginTop: 10 }}>
              Green clears the {ONTIMETARGET}% target, amber is under 90%. A single late order in a thin week
              swings this a long way — read the bar heights with the order counts in the tooltip.
            </p>
          </Card>

          <div className="two" style={{ marginTop: 18 }}>
            {group('cl', 'client')}
            {group('pr', 'product')}
          </div>

          {late.length ? (
            <>
              <SectionHead>The {Math.min(late.length, 12)} worst overruns</SectionHead>
              <FlexTable
                cols="130px 130px 110px 120px 130px 1fr"
                min={820}
                head={['Delivered', 'Order', 'Promise', 'Took', 'Over by', 'Where it went']}
              >
                {[...late]
                  .sort((a, b) => b.hrs - b.slaH - (a.hrs - a.slaH))
                  .slice(0, 12)
                  .map((x) => {
                    const bad = ASSIGN_STAGES.map((st) => ({ st, h: x.st[st], c: budgetFor(x, st) }))
                      .filter((y) => y.h > y.c)
                      .sort((a, b) => b.h - b.c - (a.h - a.c))
                    return (
                      <FlexRow cols="130px 130px 110px 120px 130px 1fr" key={x.id}>
                        <Cell v={x.dk} mono />
                        <Cell v={x.id} mono s={`${x.cl} · ${x.pr}`} />
                        <Cell v={`${x.slaH}h`} mono />
                        <Cell v={hh(x.hrs)} mono tone="bad" />
                        <Cell v={`+${hh(x.hrs - x.slaH)}`} mono tone="warn" />
                        <Cell>
                          <div className="v" style={{ fontSize: '12.5px' }}>
                            {bad.length ? (
                              <>
                                <b>{bad[0].st}</b> took {hh(bad[0].h)} against {hh(bad[0].c)}
                                {bad.length > 1 ? (
                                  <span className="gr"> +{bad.length - 1} more over</span>
                                ) : null}
                              </>
                            ) : (
                              <span className="gr">no single stage — a doc request held it</span>
                            )}
                          </div>
                        </Cell>
                      </FlexRow>
                    )
                  })}
              </FlexTable>
              <p className="gr" style={{ fontSize: '12.5px', marginTop: 10 }}>
                Every late delivery is attributed to the stage that actually overran, not to whoever happened
                to be holding it at the deadline.
              </p>
            </>
          ) : (
            <Card padded style={{ marginTop: 18 }}>
              <p className="gr" style={{ fontSize: '12.5px', margin: 0 }}>
                Nothing was late in this range.
              </p>
            </Card>
          )}
        </>
      ) : null}
    </>
  )
}
