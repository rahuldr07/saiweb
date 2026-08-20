import { useMemo, useState } from 'react'
import { Banner, Btn, Card, Chip, Empty, Label, SectionHead } from '@/components/ui'
import { FocusKpis } from '@/components/FocusKpis'
import { RangeBar } from '@/components/RangeBar'
import { DEFAULT_RANGE, inRange, resolveRange, type RangeState } from '@/lib/range'
import { median } from '@/lib/metrics'
import { QC_CRITERIA, QC_RULES, QC_SCALE, ratedPeople, stageWorkOf, standing } from '@/lib/quality'
import { STAFF } from '@/data/people'
import { fmtDate } from '@/lib/format'
import type { Delivery } from '@/data/deliveries'
import type { QcEntry } from '@/data/quality'

/** What the scores say, and what a score is allowed to mean. */
export function Quality({ deliveries, log }: { deliveries: Delivery[]; log: QcEntry[] }) {
  const [sub, setSub] = useState<'The scores' | 'How scoring works'>('The scores')

  return (
    <>
      <div className="seg" style={{ marginBottom: 18 }}>
        {(['The scores', 'How scoring works'] as const).map((x) => (
          <button key={x} className={sub === x ? 'on' : ''} aria-pressed={sub === x} onClick={() => setSub(x)}>
            {x}
          </button>
        ))}
      </div>
      {sub === 'How scoring works' ? <ScoringConfig /> : <Scores deliveries={deliveries} log={log} />}
    </>
  )
}

function Scores({ deliveries, log }: { deliveries: Delivery[]; log: QcEntry[] }) {
  const [range, setRange] = useState<RangeState>(DEFAULT_RANGE)
  const [focus, setFocus] = useState('all')

  const r = resolveRange(range)
  const dels = useMemo(() => deliveries.filter((x) => inRange(x.d, r)), [deliveries, r])
  const rows = useMemo(() => log.filter((x) => inRange(x.d, r)), [log, r])

  /* Two QC stages per delivery — Search QC and Typing QC. */
  const opportunities = dels.length * 2
  const cover = opportunities ? Math.round((rows.length / opportunities) * 100) : 0
  const overall = rows.length ? rows.reduce((a, x) => a + x.avg, 0) / rows.length : 0
  const defects = rows.filter((x) => x.defect)
  const spread = [...new Set(rows.map((x) => Math.round(x.avg)))].length

  const tw = useMemo(() => stageWorkOf(dels), [dels])
  const people = useMemo(() => ratedPeople(rows, tw), [rows, tw])
  const twp = Object.values(tw.people)

  const weeks: { from: Date; to: Date; pct: number; n: number }[] = []
  for (let end = new Date(r.to); end >= r.from; end = new Date(end.getFullYear(), end.getMonth(), end.getDate() - 7)) {
    const st = new Date(end.getFullYear(), end.getMonth(), end.getDate() - 6)
    const w = { from: st < r.from ? r.from : st, to: end, label: '', preset: '' }
    const d2 = deliveries.filter((x) => inRange(x.d, w)).length * 2
    const g = log.filter((x) => inRange(x.d, w))
    weeks.unshift({ from: w.from, to: w.to, pct: d2 ? Math.round((g.length / d2) * 100) : 0, n: g.length })
    if (weeks.length > 14) break
  }

  if (!dels.length) {
    return (
      <>
        <RangeBar id="q" value={range} onChange={setRange} />
        <Card>
          <Empty
            icon="★"
            action={
              <Btn small onClick={() => setRange({ preset: '30' })}>
                Back to the last 30 days
              </Btn>
            }
          >
            No deliveries in this range, so there is nothing to score.
          </Empty>
        </Card>
      </>
    )
  }

  const qlo = people.length ? Math.min(...people.map((p) => p.o)) : 0
  const qhi = people.length ? Math.max(...people.map((p) => p.o)) : 0
  const vs = people.filter((p) => p.tw).map((p) => p.tw!.vsPeers)
  const outliers = people.filter((p) => p.tw && p.tw.vsPeers < -5)
  const weak = Object.entries(tw.dept)
    .filter(([, v]) => v.rate < 70)
    .sort((a, b) => a[1].rate - b[1].rate)
  const stageTotal = twp.reduce((a, x) => a + x.c, 0)

  return (
    <>
      <RangeBar id="q" value={range} onChange={setRange} />

      <Banner
        kind="r"
        icon="★"
        title={
          spread <= 2 ? 'These scores are not separating anyone' : 'Coverage is the weak point, not the scale'
        }
      >
        {cover}% of the work in this range was rated at all, and the average is {overall.toFixed(2)} out of 5
        {spread <= 2 ? ' with almost no spread' : ''}. A measure where everyone is near-perfect ranks nobody.
        Making a rating mandatory before delivery, and scoring three criteria instead of one, fixes both.
      </Banner>

      <FocusKpis
        focus={focus}
        onFocus={setFocus}
        cards={[
          {
            key: 'delivered',
            title: 'Delivered',
            value: dels.length.toLocaleString(),
            detail: r.label,
            count: dels.length,
          },
          {
            key: 'unrated',
            title: 'Rated',
            value: <span className={cover < 90 ? 'warn' : 'ok'}>{cover}%</span>,
            tone: cover < 90 ? 'warn' : undefined,
            detail: `${rows.length.toLocaleString()} of ${opportunities.toLocaleString()} checks`,
            count: rows.length,
          },
          {
            key: 'spread',
            title: 'Average score',
            value: <span className={spread <= 2 ? 'warn' : ''}>{overall.toFixed(2)}</span>,
            detail: spread <= 2 ? 'no spread' : `${spread} distinct levels`,
            count: rows.length,
          },
          {
            key: 'defects',
            title: 'Defects logged',
            value: defects.length,
            tone: defects.length ? 'alert' : undefined,
            detail: 'a 3 or below on any criterion',
            count: defects.length,
          },
        ]}
      />

      {focus === 'defects' && defects.length ? (
        <>
          <SectionHead>Every defect in range</SectionHead>
          <Card>
            <div className="tsc">
              <table className="mat" style={{ minWidth: 900 }}>
                <thead>
                  <tr>
                    <th>Rated</th>
                    <th>Order</th>
                    <th>Stage</th>
                    <th>Who did it</th>
                    <th>Rated by</th>
                    <th style={{ textAlign: 'right' }}>Score</th>
                    <th>What came off</th>
                  </tr>
                </thead>
                <tbody>
                  {defects.map((x, i) => (
                    <tr key={`${x.order}-${i}`}>
                      <td className="mono">{x.dk}</td>
                      <td className="mono">{x.order}</td>
                      <td>{x.stage}</td>
                      <td>
                        <b>{x.onName}</b>
                      </td>
                      <td className="gr">{x.byName}</td>
                      <td className="n">{x.avg.toFixed(2)}</td>
                      <td>
                        {x.crit ? (
                          <>
                            <b>{x.crit}</b> — {x.note}
                          </>
                        ) : (
                          <span className="gr">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
          <p className="gr" style={{ fontSize: '12.5px', marginTop: 10 }}>
            A defect is any axis at 3 or below. The reason is recorded with it, because a score without one
            teaches nobody anything.
          </p>
        </>
      ) : null}

      {focus === 'all' ? (
        <>
          <Card padded style={{ marginTop: 18 }}>
            <Label>Coverage week by week — is rating becoming a habit?</Label>
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
                  title={`${fmtDate(wk.from)} – ${fmtDate(wk.to)}: ${wk.pct}% rated, ${wk.n} checks`}
                >
                  <span className="mono gr" style={{ fontSize: '10.5px', textAlign: 'center' }}>
                    {wk.pct}%
                  </span>
                  <span
                    style={{
                      background:
                        wk.pct >= 90 ? 'var(--ok)' : wk.pct >= 70 ? 'var(--brand2)' : 'var(--warn)',
                      borderRadius: '5px 5px 0 0',
                      height: `${Math.max(3, wk.pct)}%`,
                    }}
                  />
                  <span className="mono gr" style={{ fontSize: '9.5px', textAlign: 'center' }}>
                    {String(wk.to.getMonth() + 1).padStart(2, '0')}/{String(wk.to.getDate()).padStart(2, '0')}
                  </span>
                </div>
              ))}
            </div>
            <p className="gr" style={{ fontSize: '12.5px', marginTop: 10 }}>
              Bars are the share of checks actually filled in, week ending. Amber is below 70%. The scores
              themselves barely move — coverage is the variable worth watching.
            </p>
          </Card>

          <Card style={{ marginTop: 18 }}>
            <div className="ch">
              <h2>By person</h2>
              <div className="r gr" style={{ fontSize: '12.5px' }}>
                {people.length} rated in this range
              </div>
            </div>
            <div className="tsc">
              <table className="mat" style={{ minWidth: 860 }}>
                <thead>
                  <tr>
                    <th>Staff</th>
                    <th style={{ textAlign: 'right' }}>Rated</th>
                    <th style={{ textAlign: 'right' }}>Defects</th>
                    <th style={{ textAlign: 'right' }}>Quality</th>
                    <th style={{ textAlign: 'right' }} title="Stages of work they did in this range">
                      Stages
                    </th>
                    <th
                      style={{ textAlign: 'right' }}
                      title="How often they finished inside budget, next to what others doing the same stages manage"
                    >
                      On budget
                    </th>
                    <th style={{ textAlign: 'right' }} title="Median time taken as a multiple of the budget">
                      vs budget
                    </th>
                    <th>Standing</th>
                  </tr>
                </thead>
                <tbody>
                  {people.map((p) => {
                    const t = p.tw
                    const sd = t ? standing(p.o, t.vsPeers, overall) : null
                    return (
                      <tr key={p.n}>
                        <td>
                          <b>{p.n}</b>
                          {STAFF.some((x) => x.n === p.n) ? null : (
                            <>
                              {' '}
                              <Chip kind="n">no longer here</Chip>
                            </>
                          )}
                        </td>
                        <td className="n">{p.c}</td>
                        <td className={`n ${p.def ? 'warn' : 'gr'}`}>{p.def || '—'}</td>
                        <td className="n">{p.o.toFixed(2)}</td>
                        <td className="n gr">{t ? t.c : '—'}</td>
                        <td
                          className={`n ${t ? (t.vsPeers >= -5 ? 'ok' : t.vsPeers >= -15 ? 'warn' : 'bad') : 'gr'}`}
                        >
                          {t ? `${t.onBudget}%` : '—'}
                          {t ? <div className="s gr">peers {t.expected}%</div> : null}
                        </td>
                        <td className={`n ${t ? (t.ratio <= 1 ? 'ok' : 'warn') : 'gr'}`}>
                          {t ? `${t.ratio.toFixed(2)}×` : '—'}
                        </td>
                        <td>{sd ? <Chip kind={sd[1]}>{sd[0]}</Chip> : <span className="gr">—</span>}</td>
                      </tr>
                    )
                  })}
                  <tr>
                    <td style={{ fontWeight: 700 }}>Everyone</td>
                    <td className="tot">{rows.length}</td>
                    <td className="tot">{defects.length}</td>
                    <td className="tot">{overall.toFixed(2)}</td>
                    <td className="tot">{stageTotal}</td>
                    <td className="tot">
                      {stageTotal
                        ? `${Math.round(((stageTotal - twp.reduce((a, x) => a + x.over, 0)) / stageTotal) * 100)}%`
                        : '—'}
                    </td>
                    <td className="tot">{median(twp.map((x) => x.ratio)).toFixed(2)}×</td>
                    <td />
                  </tr>
                </tbody>
              </table>
            </div>
          </Card>

          {people.length ? (
            <Banner kind="r" icon="◷" title="Neither column ranks people on its own" style={{ marginTop: 14 }}>
              Quality runs {qlo.toFixed(2)} to {qhi.toFixed(2)} — a spread of {(qhi - qlo).toFixed(2)}, which
              is noise. Against peers on the same stages, hit rates run {Math.min(...vs)} to +
              {Math.max(...vs)} points, and{' '}
              {outliers.length
                ? `only ${outliers.map((p) => p.n).join(' and ')} sit${outliers.length === 1 ? 's' : ''} meaningfully below.`
                : 'nobody sits meaningfully below.'}{' '}
              Raw on-budget percentages would have been unfair — somebody doing Search is judged against a
              department that misses {100 - (tw.dept['Search']?.rate ?? 100)}% of the time, somebody on RTS
              against one that almost never does. The peers figure corrects for that.
            </Banner>
          ) : null}

          {weak.length ? (
            <Banner
              kind="d"
              icon="⚑"
              title={weak.map(([k, v]) => `${k} is missed by everyone ${100 - v.rate}% of the time`).join(' · ')}
            >
              When a whole department misses its budget this often, it is the budget or the staffing that is
              wrong — not the people in it. No amount of coaching moves a number that everyone shares. Either
              widen {weak[0][0]}'s share of the clock, or put more people in it.
            </Banner>
          ) : null}

          <p className="gr" style={{ fontSize: '12.5px', marginTop: 10 }}>
            Every figure is computed from the {rows.length.toLocaleString()} ratings in range, so the table
            and the four cards above cannot disagree. Somebody who has left the company still appears against
            the work they did — the name is recorded on the rating, not looked up afterwards.
          </p>
        </>
      ) : null}
    </>
  )
}

/** How work is checked, and what a score is allowed to mean. */
function ScoringConfig() {
  const [rules, setRules] = useState(QC_RULES)
  const off = rules.filter((r) => !r.on)

  return (
    <>
      <p className="gr" style={{ fontSize: '12.5px', margin: '0 0 16px' }}>
        How work is checked, and what a score is allowed to mean.
      </p>

      <Card padded>
        <Label>Rating scale</Label>
        <p className="gr" style={{ fontSize: '12.5px', marginBottom: 13 }}>
          Note the direction: <b>1 is the worst outcome and 5 the best</b> — the opposite of what most people
          assume, so the word is shown next to the number everywhere it appears.
        </p>
        <div style={{ display: 'grid', gap: 7 }}>
          {QC_SCALE.map(([score, label, kind]) => (
            <div
              key={score}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '10px 13px',
                border: '1px solid var(--hair)',
                borderRadius: 9,
                background: 'var(--tint)',
              }}
            >
              <Chip kind={kind}>
                {score} · {label}
              </Chip>
              <span className="gr" style={{ fontSize: '12.5px', marginLeft: 'auto' }}>
                {score === 1 ? 'blocks delivery until resolved' : score <= 3 ? 'logged as a defect' : 'passes'}
              </span>
            </div>
          ))}
        </div>
      </Card>

      <Card padded style={{ marginTop: 18 }}>
        <Label>What gets scored</Label>
        <p className="gr" style={{ fontSize: '12.5px', marginBottom: 13 }}>
          One number couldn't say <i>what</i> was wrong. Three can.
        </p>
        <div style={{ display: 'grid', gap: 9 }}>
          {QC_CRITERIA.map(([name, question]) => (
            <div
              key={name}
              style={{
                display: 'flex',
                gap: 12,
                alignItems: 'flex-start',
                padding: '12px 14px',
                border: '1px solid var(--hair)',
                borderRadius: 9,
              }}
            >
              <span className="ok">✓</span>
              <span>
                <b>{name}</b>
                <div className="sd gr" style={{ fontSize: '12.5px' }}>
                  {question}
                </div>
              </span>
            </div>
          ))}
        </div>
      </Card>

      <Card padded style={{ marginTop: 18 }}>
        <Label>Rules</Label>
        <div style={{ display: 'grid', gap: 9 }}>
          {rules.map((r) => (
            <label
              key={r.k}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 11,
                fontSize: '13.5px',
                padding: '12px 14px',
                border: '1px solid var(--hair)',
                borderRadius: 9,
                background: r.on ? 'var(--tint)' : 'var(--card)',
              }}
            >
              <input
                type="checkbox"
                checked={r.on}
                style={{ marginTop: 2 }}
                onChange={(e) =>
                  setRules((prev) => prev.map((x) => (x.k === r.k ? { ...x, on: e.target.checked } : x)))
                }
              />
              <span>
                <b>{r.n}</b>
                <div className="sd gr" style={{ fontSize: '12.5px' }}>
                  {r.d}
                </div>
              </span>
            </label>
          ))}
        </div>
        {off.length ? (
          <Banner
            kind="r"
            icon="⚠"
            title={`${off.length} rule${off.length === 1 ? ' is' : 's are'} off, and each has a cost`}
            style={{ marginTop: 14 }}
          >
            {off.map((r) => r.cost).join(' ')}
          </Banner>
        ) : null}
      </Card>

      <Banner kind="r" icon="★" title="Worth deciding what a rating is for" style={{ marginTop: 18 }}>
        Today it is 67% coverage and almost every score is a 5, which means it isn't separating anyone.
        Coaching, pay, or a filing requirement — the answer changes whether the person rated should see it,
        and whether raters will ever give a 3.
      </Banner>
    </>
  )
}
