import { useState } from 'react'
import { useGo } from '@/lib/nav'
import {
  Banner,
  BarRow,
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
import { QC_CRITERIA } from '@/lib/quality'
import { useQcRules } from '@/state/qcRules'
import { DEFAULT_RANGE, inRange, resolveRange, type RangeState } from '@/lib/range'
import { useDeliveries } from '@/lib/useDeliveries'
import { useQcLog } from '@/lib/useQcLog'
import { useStageWork } from '@/lib/useStageWork'
import { fmtDate } from '@/lib/format'

const listOf = (xs: string[]) =>
  xs.length < 3 ? xs.join(' and ') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`

const byReason = (rows: QcEntry[]): [reason: string, count: number][] =>
  Object.entries(
    rows.reduce<Record<string, number>>((acc, x) => {
      if (x.note) acc[x.note] = (acc[x.note] ?? 0) + 1
      return acc
    }, {}),
  ).sort((a, b) => b[1] - a[1])

export default function MyPerformance() {
  const { me, can } = useSession()
  const { openModal } = useUi()
  const navigate = useGo()
  const budgetHelp = useBudgetHelp()
  const qcLog = useQcLog()
  const history = useDeliveries()
  const [rangeState, setRangeState] = useState<RangeState>(DEFAULT_RANGE)

  const range = resolveRange(rangeState)
  const log = qcLog.data ?? []
  const rows = log.filter((x) => x.onName === me.n && inRange(x.d, range))
  const loading = qcLog.isPending || history.isPending
  const stageWork = useStageWork(range)

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
          <p className="gr" style={{ fontSize: 'var(--t-small)', marginTop: 12 }}>
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

  const t = stageWork.people[me.n] ?? null

  const half = new Date((range.from.getTime() + range.to.getTime()) / 2)
  const recent = below.filter((x) => x.d >= half)
  const older = below.filter((x) => x.d < half)

  const axes = QC_CRITERIA.map(([name, field]) => ({
    name,
    n: below.filter((x) => x.crit === name).length,
    avg: rows.length ? rows.reduce((a, x) => a + x[field], 0) / rows.length : null,
  }))
  const strongest = rows.length ? axes.filter((a) => a.n === 0) : []

  const perPerson = Object.values(
    log.reduce<Record<string, number[]>>((acc, x) => {
      ;(acc[x.onName] ??= []).push(x.avg)
      return acc
    }, {}),
  ).map((l) => l.reduce((a, b) => a + b, 0) / l.length)
  const spread = perPerson.length
    ? { lo: Math.min(...perPerson), hi: Math.max(...perPerson) }
    : null

  const note = (children: React.ReactNode) => (
    <p className="gr" style={{ fontSize: 'var(--t-small)', marginTop: 12 }}>
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
            <p className="gr" style={{ fontSize: 'var(--t-body)', margin: 0 }}>
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
            <p className="gr" style={{ fontSize: 'var(--t-body)', margin: 0 }}>
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
          title="Your score"
          value={mineAvg !== null ? <span className="ok">{mineAvg.toFixed(2)}</span> : '—'}
          detail={
            mineAvg === null || !spread
              ? 'out of 5'
              : mineAvg < spread.lo
                ? 'out of 5 — just below the usual range here'
                : mineAvg > spread.hi
                  ? 'out of 5 — at the top of the range here'
                  : 'out of 5 — in line with everyone here'
          }
          hint={
            spread
              ? `Everyone here averages ${spread.lo.toFixed(2)} to ${spread.hi.toFixed(2)} across the full log`
              : 'The average of every rating in range'
          }
          onClick={() => showChecks('all')}
        />
        <Kpi
          title="Work checked"
          value={rows.length}
          detail="pieces of your work a colleague reviewed"
          hint="Every check in range"
          onClick={() => showChecks('all')}
        />
        <Kpi
          title="No issues found"
          value={<span className="ok">{clean}</span>}
          detail={`${rows.length ? Math.round((clean / rows.length) * 100) : 0}% of the checks`}
          hint="The ones with nothing raised"
          onClick={() => showChecks('clean')}
        />
        <Kpi
          title="Keeps happening"
          value={<span className={habits.length ? 'warn' : 'ok'}>{habits.length}</span>}
          tone={habits.length ? 'warn' : undefined}
          detail={habits.length ? 'the same issue more than once' : 'nothing came up twice'}
          hint="The ones worth changing a habit for"
          onClick={showHabits}
        />
        <Kpi
          title="Finished in time"
          value={t ? `${t.onBudget}%` : '—'}
          valueTone={t ? (t.vsPeers >= -5 ? 'ok' : 'warn') : undefined}
          tone={t && t.vsPeers < -5 ? 'warn' : undefined}
          detail={t ? `of your work — others doing the same: ${t.expected}%` : 'no timed work in range'}
          hint="How often you finish inside the time allowed for the stage"
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
          {habits.length ? (
            <>
              <SectionHead id="mfHabits">
                What to improve — {habits.length} thing{habits.length === 1 ? '' : 's'} that came
                up more than once
              </SectionHead>
              {habits.map(([reason, n]) => {
                const stillHappening = recent.filter((x) => x.note === reason).length
                const usedTo = older.filter((x) => x.note === reason).length
                return (
                  <Card padded key={reason} style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                      <span className="warn" style={{ fontSize: 'var(--t-h3)', lineHeight: 1.2 }}>
                        ⚑
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 'var(--t-lead)', fontWeight: 650 }}>{reason}</div>
                        <div className="gr" style={{ fontSize: 'var(--t-small)', marginTop: 2 }}>
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
                          <span className="brand" style={{ fontSize: 'var(--t-lead)' }}>
                            →
                          </span>
                          <span>
                            <b>What to do next</b>
                            <div className="sd">
                              {QC_FIX[reason] ?? 'No practice recorded for this one yet.'}
                            </div>
                          </span>
                          <span />
                        </div>
                        <div className="gr" style={{ fontSize: 'var(--t-label)', marginTop: 9 }}>
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
              <p className="gr" style={{ fontSize: 'var(--t-small)', margin: 0 }}>
                {below.length
                  ? 'Nothing has come up twice. Everything below is a one-off, and a one-off is not a habit worth changing your method for.'
                  : rows.length
                    ? `Nothing was raised against your work in this range — all ${rows.length} checks came back clean.`
                    :
                      'None of your work was checked in this range. Widen the range, or check whether the work you do gets rated at all.'}
              </p>
            </Card>
          )}

          {oneOffs.length ? (
            <>
              <SectionHead>Worth knowing — these came up once</SectionHead>
              <Card>
                <Rows bare>
                  {oneOffs.map(([reason]) => {
                    const x = below.find((y) => y.note === reason)
                    return (
                      <div className="rw" key={reason}>
                        <span className="gr" style={{ fontSize: 'var(--t-lead)' }}>
                          ·
                        </span>
                        <span>
                          <b style={{ fontSize: 'var(--t-body)' }}>{reason}</b>
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
                </Rows>
              </Card>
            </>
          ) : null}

          <div className="two" style={{ marginTop: 18 }}>
            <Card padded>
              <Label>What you’re doing well, and where marks come off</Label>
              {axes.map((a) => (
                <BarRow
                  key={a.name}
                  cols="118px 1fr 100px"
                  gap={11}
                  padding="7px 0"
                  label={a.name}
                  value={a.n}
                  max={below.length}
                  color={a.n ? 'var(--warn)' : 'var(--ok)'}
                  right={
                    <>
                      {a.avg === null ? <span className="gr">—</span> : a.avg.toFixed(2)}
                      {a.n ? <span className="gr"> · {a.n}</span> : null}
                    </>
                  }
                />
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
                  <span className="ok" style={{ fontSize: 'var(--t-lead)' }}>
                    ✓
                  </span>
                  <span>
                    <b>Doing well: {listOf(strongest.map((c) => c.name))}</b>
                    <div className="sd">Nothing raised across {rows.length} checks.</div>
                  </span>
                  <span />
                </div>
              ) : null}
            </Card>

            <Card padded>
              <Label>How long your work takes</Label>
              {t ? (
                <>
                  <div
                    style={{ display: 'flex', alignItems: 'baseline', gap: 9, margin: '8px 0 10px' }}
                  >
                    <b className="mono" style={{ fontSize: 'var(--t-display)' }}>
                      {t.ratio.toFixed(2)}×
                    </b>
                    <span className="gr">of the time allowed for your stage, typically</span>
                  </div>
                  <span className="bar" style={{ height: 12 }}>
                    <i
                      style={{
                        width: `${Math.min(100, Math.round(t.ratio * 70))}%`,
                        background: t.ratio > 1 ? 'var(--warn)' : 'var(--ok)',
                      }}
                    />
                  </span>
                  <p className="gr" style={{ fontSize: 'var(--t-small)', marginTop: 12 }}>
                    {t.erratic
                      ? `Your typical order is comfortably inside budget. What costs you is the spread — ${t.over} of ${t.c} ran long. Those are worth a look: if the long ones have something in common, that is the thing to raise, not your pace.`
                      : t.vsPeers >= 5
                        ? `You come in ahead of others doing the same stages by ${t.vsPeers} points. Keep an eye on the defect count — time saved by skipping a check is not time saved.`
                        : t.vsPeers <= -10
                          ? `Others on the same stages land inside budget ${t.expected}% of the time against your ${t.onBudget}%. That is a real gap, and it is worth asking whether the budget matches the work you are given before treating it as pace.`
                          : 'You track the budget about as closely as everyone else on the same stages.'}
                  </p>
                  <p className="gr" style={{ fontSize: 'var(--t-small)' }}>
                    The budget is your department’s slice of the client’s promise — set under
                    Turnaround &amp; SLA, not by you.
                  </p>
                </>
              ) : (
                <p className="gr" style={{ fontSize: 'var(--t-small)', margin: 0 }}>
                  No timed work in this range.
                </p>
              )}
            </Card>
          </div>

          {can('assign') && dept ? (
            <>
              <SectionHead id="mfDept">Your department</SectionHead>
              <Card padded>
                <Label>What {dept} keeps losing marks on</Label>
                {deptTop.length ? (
                  deptTop.map(([reason, n]) => (
                    <div className="rw" style={{ padding: '9px 0' }} key={reason}>
                      <span className={n > 2 ? 'warn' : 'gr'} style={{ fontSize: 'var(--t-lead)' }}>
                        {n > 2 ? '⚑' : '·'}
                      </span>
                      <span>
                        <b style={{ fontSize: 'var(--t-body)' }}>{reason}</b>
                        <div className="sd gr">{n} across the department</div>
                        <div className="sd" style={{ marginTop: 4 }}>
                          {QC_FIX[reason] ?? ''}
                        </div>
                      </span>
                      <span className="mono gr">{n}</span>
                    </div>
                  ))
                ) : (
                  <p className="gr" style={{ fontSize: 'var(--t-small)', margin: 0 }}>
                    Nothing recurring in {dept}.
                  </p>
                )}
                <p className="gr" style={{ fontSize: 'var(--t-small)', marginTop: 12 }}>
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
