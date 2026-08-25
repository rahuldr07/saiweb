import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import {
  Banner,
  Btn,
  Card,
  Kpi,
  Kpis,
  Label,
  PageHead,
  Row,
  Rows,
  SectionHead,
  focusSection,
} from '@/components/ui'
import { RangeBar } from '@/components/RangeBar'
import { SkeletonRows } from '@/components/async'
import { useBudgetHelp } from '@/components/budgetHelp'
import { useSession } from '@/state/session'
import { useUi } from '@/state/ui'
import { STAFF } from '@/data/people'
import { QC_FIX, type QcEntry } from '@/data/quality'
import { stageWorkOf } from '@/lib/quality'
import { useQcRules } from '@/state/qcRules'
import { DEFAULT_RANGE, inRange, resolveRange, type RangeState } from '@/lib/range'
import { useDeliveries } from '@/lib/useDeliveries'
import { useQcLog } from '@/lib/useQcLog'
import { fmtDate } from '@/lib/format'

/** The three things a rating is given on, and the field each is stored in. */
const AXES = [
  ['Accuracy', 'acc'],
  ['Completeness', 'comp'],
  ['Formatting', 'fmt'],
] as const

/** `A`, `A and B`, `A, B and C` — the design joins with " and " throughout. */
const listOf = (xs: string[]) =>
  xs.length < 3 ? xs.join(' and ') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`

/** Ratings grouped by the reason written on them, commonest first. */
const byReason = (rows: QcEntry[]): [reason: string, count: number][] =>
  Object.entries(
    rows.reduce<Record<string, number>>((acc, x) => {
      if (x.note) acc[x.note] = (acc[x.note] ?? 0) + 1
      return acc
    }, {}),
  ).sort((a, b) => b[1] - a[1])

/**
 * How I'm doing — a person's own view of their work.
 *
 * It leads with reasons rather than with the score, and that ordering is the
 * whole design. Across the company the averages span about 0.06, so the number
 * ranks nobody; what is actionable is which mistake keeps recurring and the
 * practice that prevents it. So the page is built around `QC_FIX`, and the score
 * appears once, in a card whose job is to say it does not mean much on its own.
 *
 * A repeat and a one-off are separated for the same reason: something raised
 * once is a slip, and only the other kind is worth changing how you work for.
 */
export default function MyPerformance() {
  const { me, can } = useSession()
  const { openModal } = useUi()
  const navigate = useNavigate()
  const budgetHelp = useBudgetHelp()
  const qcLog = useQcLog()
  const history = useDeliveries()
  const [rangeState, setRangeState] = useState<RangeState>(DEFAULT_RANGE)

  const range = resolveRange(rangeState)
  const log = qcLog.data ?? []
  const rows = log.filter((x) => x.onName === me.n && inRange(x.d, range))
  const loading = qcLog.isPending || history.isPending

  /* Ratings are shown to the person rated only where the company has left that
     rule on. It is a setting, not a judgement about them, so the refusal names
     where it lives rather than just declining. */
  const allowed = useQcRules().find((r) => r.k === 'see')?.on ?? false

  if (!allowed) {
    return (
      <>
        <PageHead title="How I’m doing" />
        <Card padded style={{ maxWidth: 620 }}>
          <Banner
            kind="r"
            icon="⚿"
            title="Ratings are not shown to the person rated on this account"
            style={{ margin: 0 }}
          >
            That is a company setting, not something about you. An admin turns it on under{' '}
            <b>Reports → Quality → How scoring works</b>, the rule “Scores are visible to the person
            rated”.
          </Banner>
          <p className="gr" style={{ fontSize: '12.5px', marginTop: 12 }}>
            Measuring someone against something they cannot see is the fastest way to make a quality
            score resented rather than useful — worth saying to whoever owns that setting.
          </p>
        </Card>
      </>
    )
  }

  const below = rows.filter((x) => x.crit)
  const clean = rows.length - below.length
  const ranked = byReason(below)
  const habits = ranked.filter(([, n]) => n > 1)
  const oneOffs = ranked.filter(([, n]) => n === 1)
  const mineAvg = rows.length ? rows.reduce((a, x) => a + x.avg, 0) / rows.length : null

  const stageWork = stageWorkOf((history.data ?? []).filter((x) => inRange(x.d, range)))
  const t = stageWork.people[me.n] ?? null

  /* Is the same reason still happening, or has it stopped? Split the range in
     half rather than counting the whole of it — a habit that ended three weeks
     ago should not read the same as one that is still going. */
  const half = new Date((range.from.getTime() + range.to.getTime()) / 2)
  const recent = below.filter((x) => x.d >= half)
  const older = below.filter((x) => x.d < half)

  const axes = AXES.map(([name, field]) => ({
    name,
    n: below.filter((x) => x.crit === name).length,
    avg: rows.length ? rows.reduce((a, x) => a + x[field], 0) / rows.length : null,
  }))
  /* Only where there was something to raise. With no ratings every axis is
     trivially clean, and congratulating somebody on work nobody looked at is the
     one way this panel could mislead. */
  const strongest = rows.length ? axes.filter((a) => a.n === 0) : []

  /* The spread across everyone, so the reader can see how little their own score
     separates them. Deliberately the whole log rather than the range — the point
     is the shape of the scale, not this month's slice of it. */
  const perPerson = Object.values(
    log.reduce<Record<string, number[]>>((acc, x) => {
      ;(acc[x.onName] ??= []).push(x.avg)
      return acc
    }, {}),
  ).map((l) => l.reduce((a, b) => a + b, 0) / l.length)
  const spread = perPerson.length
    ? { lo: Math.min(...perPerson), hi: Math.max(...perPerson) }
    : null

  /* ── the modals behind the figures ─────────────────────────────────────── */

  const note = (children: React.ReactNode) => (
    <p className="gr" style={{ fontSize: '12.5px', marginTop: 12 }}>
      {children}
    </p>
  )

  const showHabits = () =>
    openModal({
      title: `Came up more than once — ${habits.length}`,
      body: (
        <>
          {habits.length ? (
            <Rows>
              {habits.map(([reason, n]) => (
                <Row
                  key={reason}
                  icon={<span className="bad">⚑</span>}
                  title={reason}
                  detail="the same thing raised on separate pieces of work"
                  right={<span className="mono">{n} times</span>}
                />
              ))}
            </Rows>
          ) : (
            <p className="gr" style={{ fontSize: '13.5px', margin: 0 }}>
              Nothing has come up twice. What was raised was raised once.
            </p>
          )}
          {note(
            'Something raised once is a slip. The same thing raised three times is a habit, and only the second kind is worth changing how you work for.',
          )}
        </>
      ),
    })

  const showChecks = (kind: 'all' | 'clean') => {
    const list = kind === 'clean' ? rows.filter((x) => !x.crit) : rows
    openModal({
      title:
        kind === 'clean'
          ? `Nothing raised — ${list.length}`
          : `Every check — ${list.length} · ${range.label}`,
      body: (
        <>
          {list.length ? (
            <Rows>
              {list.map((x, i) => (
                <Row
                  key={`${x.order}-${i}`}
                  icon={<span className={x.crit ? 'bad' : 'ok'}>{x.crit ? '⚑' : '✓'}</span>}
                  title={`${x.order}${x.crit ? ` · ${x.crit}` : ''}`}
                  detail={`${fmtDate(x.d)} · checked by ${x.byName}${x.note ? ` — ${x.note}` : ''}`}
                  right={<span className="mono">{x.avg.toFixed(2)}</span>}
                />
              ))}
            </Rows>
          ) : (
            <p className="gr" style={{ fontSize: '13.5px', margin: 0 }}>
              No checks in this range.
            </p>
          )}
          {note(
            'A check with nothing raised still counts. A run of clean work is the thing that makes one bad score readable as an exception.',
          )}
        </>
      ),
    })
  }

  /* ── the department roll-up, for whoever runs one ──────────────────────── */

  const dept = me.dep[0]
  const deptTop = dept
    ? byReason(
        log.filter(
          (x) =>
            inRange(x.d, range) &&
            STAFF.some((s) => s.n === x.onName && s.dep.includes(dept)),
        ),
      ).slice(0, 4)
    : []

  return (
    <>
      <PageHead
        title="How I’m doing"
        sub={`${me.dep.join(' · ') || 'no department'} · ${range.label}`}
        actions={
          <Btn
            variant="ghost"
            onClick={() => navigate({ to: '/staff/$personId', params: { personId: me.id } })}
          >
            My profile
          </Btn>
        }
      />

      <RangeBar
        id="mf"
        value={rangeState}
        onChange={setRangeState}
        note="these figures follow it"
      />

      <Kpis>
        <Kpi
          title="Checks on your work"
          value={rows.length}
          detail={range.label}
          hint="Every check in range"
          onClick={() => showChecks('all')}
        />
        <Kpi
          title="Clean"
          value={<span className="ok">{clean}</span>}
          detail={`${rows.length ? Math.round((clean / rows.length) * 100) : 0}% with nothing raised`}
          hint="The ones with nothing raised"
          onClick={() => showChecks('clean')}
        />
        <Kpi
          title="Repeating"
          value={<span className={habits.length ? 'warn' : 'ok'}>{habits.length}</span>}
          tone={habits.length ? 'warn' : undefined}
          detail={habits.length ? 'worth changing a habit for' : 'nothing is recurring'}
          hint="The ones worth changing a habit for"
          onClick={showHabits}
        />
        <Kpi
          title="Inside your budget"
          value={t ? `${t.onBudget}%` : '—'}
          valueTone={t ? (t.vsPeers >= -5 ? 'ok' : 'warn') : undefined}
          tone={t && t.vsPeers < -5 ? 'warn' : undefined}
          detail={t ? `others on the same stages: ${t.expected}%` : 'no timed work in range'}
          hint="How this compares"
          onClick={can('assign') ? () => focusSection('mfDept') : budgetHelp}
        />
      </Kpis>

      {loading ? (
        <Card style={{ marginTop: 16 }}>
          <div className="cb">
            <SkeletonRows rows={4} cols={3} />
          </div>
        </Card>
      ) : (
        <>
          {mineAvg !== null && spread ? (
            <Card padded style={{ marginTop: 16 }}>
              <div
                className="rw"
                style={{ background: 'var(--tint)', borderRadius: 9, padding: '13px 15px' }}
              >
                <span className="gr" style={{ fontSize: '14.5px' }}>
                  =
                </span>
                <span>
                  <b>Your score is {mineAvg.toFixed(2)} — and on its own it does not mean much</b>
                  <div className="sd">
                    Across everyone here the scores run {spread.lo.toFixed(2)} to{' '}
                    {spread.hi.toFixed(2)}. A gap that small is noise, not a ranking — which is why
                    this page leads with reasons rather than with the number.
                  </div>
                </span>
                <span />
              </div>
            </Card>
          ) : null}

          {habits.length ? (
            <>
              <SectionHead id="mfHabits">
                Worth changing — {habits.length} thing{habits.length === 1 ? '' : 's'} that came up
                more than once
              </SectionHead>
              {habits.map(([reason, n]) => {
                const stillHappening = recent.filter((x) => x.note === reason).length
                const usedTo = older.filter((x) => x.note === reason).length
                return (
                  <Card padded key={reason} style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                      <span className="warn" style={{ fontSize: '17px', lineHeight: 1.2 }}>
                        ⚑
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '14.5px', fontWeight: 650 }}>{reason}</div>
                        <div className="gr" style={{ fontSize: '12.5px', marginTop: 2 }}>
                          {n} times in {range.label}
                          {stillHappening === 0 ? (
                            <>
                              {' — '}
                              <b className="ok">none in the more recent half</b>
                            </>
                          ) : usedTo === 0 ? (
                            <>
                              {' — '}
                              <b className="warn">all of them recently</b>
                            </>
                          ) : null}
                        </div>
                        <div
                          className="rw"
                          style={{
                            background: 'var(--brandsoft)',
                            borderRadius: 9,
                            padding: '12px 14px',
                            marginTop: 11,
                          }}
                        >
                          <span className="brand" style={{ fontSize: '14.5px' }}>
                            →
                          </span>
                          <span>
                            <b>What to do differently</b>
                            <div className="sd">
                              {QC_FIX[reason] ?? 'No practice recorded for this one yet.'}
                            </div>
                          </span>
                          <span />
                        </div>
                        <div className="gr" style={{ fontSize: '11.5px', marginTop: 9 }}>
                          On {below.filter((x) => x.note === reason).map((x) => x.order).join(', ')}
                        </div>
                      </div>
                    </div>
                  </Card>
                )
              })}
            </>
          ) : (
            <Card padded style={{ marginTop: 16 }}>
              <p className="gr" style={{ fontSize: '12.5px', margin: 0 }}>
                {below.length
                  ? 'Nothing has come up twice. Everything below is a one-off, and a one-off is not a habit worth changing your method for.'
                  : rows.length
                    ? `Nothing was raised against your work in this range — all ${rows.length} checks came back clean.`
                    : /* No ratings is not the same as clean ratings, and the design's
                         wording claims the second. Widening the range is the fix. */
                      'None of your work was checked in this range. Widen the range, or check whether the work you do gets rated at all.'}
              </p>
            </Card>
          )}

          {oneOffs.length ? (
            <>
              <SectionHead>Happened once — worth knowing, not worth worrying about</SectionHead>
              <Card>
                <div className="rows" style={{ border: 'none', borderRadius: 0 }}>
                  {oneOffs.map(([reason]) => {
                    const x = below.find((y) => y.note === reason)
                    return (
                      <div className="rw" key={reason}>
                        <span className="gr" style={{ fontSize: '14.5px' }}>
                          ·
                        </span>
                        <span>
                          <b style={{ fontSize: '13.5px' }}>{reason}</b>
                          <div className="sd gr">
                            {x?.crit} · {x?.order} · {x?.dk}
                          </div>
                          <div className="sd" style={{ marginTop: 5 }}>
                            {QC_FIX[reason] ?? ''}
                          </div>
                        </span>
                        <span />
                      </div>
                    )
                  })}
                </div>
              </Card>
            </>
          ) : null}

          <div className="two" style={{ marginTop: 18 }}>
            <Card padded>
              <Label>Where your marks come off, and where they never do</Label>
              {axes.map((a) => (
                <div
                  key={a.name}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '118px 1fr 100px',
                    gap: 11,
                    alignItems: 'center',
                    padding: '7px 0',
                    fontSize: '12.5px',
                  }}
                >
                  <span className="gr">{a.name}</span>
                  <span className="bar">
                    <i
                      style={{
                        width: `${below.length ? Math.round((a.n / Math.max(1, below.length)) * 100) : 0}%`,
                        background: a.n ? 'var(--warn)' : 'var(--ok)',
                      }}
                    />
                  </span>
                  <span className="mono" style={{ textAlign: 'right' }}>
                    {/* An average of nothing is not zero — 0.00 reads as the worst
                        possible score rather than as no data. */}
                    {a.avg === null ? <span className="gr">—</span> : a.avg.toFixed(2)}
                    {a.n ? <span className="gr"> · {a.n}</span> : null}
                  </span>
                </div>
              ))}
              {strongest.length ? (
                <div
                  className="rw"
                  style={{
                    background: 'var(--oksoft)',
                    borderRadius: 9,
                    padding: '11px 13px',
                    marginTop: 12,
                  }}
                >
                  <span className="ok" style={{ fontSize: '14.5px' }}>
                    ✓
                  </span>
                  <span>
                    <b>{listOf(strongest.map((c) => c.name))} — nothing raised at all</b>
                    <div className="sd">
                      Across {rows.length} checks. Worth knowing what you are already doing right,
                      not just what you are not.
                    </div>
                  </span>
                  <span />
                </div>
              ) : null}
            </Card>

            <Card padded>
              <Label>Your time against the budget</Label>
              {t ? (
                <>
                  <div
                    style={{ display: 'flex', alignItems: 'baseline', gap: 9, margin: '8px 0 10px' }}
                  >
                    <b className="mono" style={{ fontSize: '26px' }}>
                      {t.ratio.toFixed(2)}×
                    </b>
                    <span className="gr">of the time your stage is allowed, typically</span>
                  </div>
                  <span className="bar" style={{ height: 12 }}>
                    <i
                      style={{
                        width: `${Math.min(100, Math.round(t.ratio * 70))}%`,
                        background: t.ratio > 1 ? 'var(--warn)' : 'var(--ok)',
                      }}
                    />
                  </span>
                  <p className="gr" style={{ fontSize: '12.5px', marginTop: 12 }}>
                    {t.erratic
                      ? `Your typical order is comfortably inside budget. What costs you is the spread — ${t.over} of ${t.c} ran long. Those are worth a look: if the long ones have something in common, that is the thing to raise, not your pace.`
                      : t.vsPeers >= 5
                        ? `You come in ahead of others doing the same stages by ${t.vsPeers} points. Keep an eye on the defect count — time saved by skipping a check is not time saved.`
                        : t.vsPeers <= -10
                          ? `Others on the same stages land inside budget ${t.expected}% of the time against your ${t.onBudget}%. That is a real gap, and it is worth asking whether the budget matches the work you are given before treating it as pace.`
                          : 'You track the budget about as closely as everyone else on the same stages.'}
                  </p>
                  <p className="gr" style={{ fontSize: '12.5px' }}>
                    The budget is your department’s slice of the client’s promise — set under
                    Turnaround &amp; SLA, not by you.
                  </p>
                </>
              ) : (
                <p className="gr" style={{ fontSize: '12.5px', margin: 0 }}>
                  No timed work in this range.
                </p>
              )}
            </Card>
          </div>

          {/* Only for somebody who runs a department. For everyone else their own
              work is the whole of what this page is about. */}
          {can('assign') && dept ? (
            <>
              <SectionHead id="mfDept">Your department</SectionHead>
              <Card padded>
                <Label>What {dept} keeps losing marks on</Label>
                {deptTop.length ? (
                  deptTop.map(([reason, n]) => (
                    <div className="rw" style={{ padding: '9px 0' }} key={reason}>
                      <span className={n > 2 ? 'warn' : 'gr'} style={{ fontSize: '14.5px' }}>
                        {n > 2 ? '⚑' : '·'}
                      </span>
                      <span>
                        <b style={{ fontSize: '13.5px' }}>{reason}</b>
                        <div className="sd gr">{n} across the department</div>
                        <div className="sd" style={{ marginTop: 4 }}>
                          {QC_FIX[reason] ?? ''}
                        </div>
                      </span>
                      <span className="mono gr">{n}</span>
                    </div>
                  ))
                ) : (
                  <p className="gr" style={{ fontSize: '12.5px', margin: 0 }}>
                    Nothing recurring in {dept}.
                  </p>
                )}
                <p className="gr" style={{ fontSize: '12.5px', marginTop: 12 }}>
                  The same mistake made by different people is a process problem, not a person
                  problem — it usually means a step is missing from how the work is set up rather
                  than from how it is done.
                </p>
              </Card>
            </>
          ) : null}
        </>
      )}
    </>
  )
}
