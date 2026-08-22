import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Avatar, Btn, Card, Chip, Empty, Label, SectionHead } from '@/components/ui'
import { Cell, FlexRow, FlexTable } from '@/components/FlexTable'
import { FocusHead, FocusKpis } from '@/components/FocusKpis'
import { QcDefects, QcMarks, QcOverBudget } from './QcFocus'
import { ASSIGN_STAGES } from '@/data/org'
import { STAFF } from '@/data/people'
import { median } from '@/lib/metrics'
import { standing, type RatedPerson, type StageWorkResult } from '@/lib/quality'
import { hh } from '@/lib/sla'
import type { QcEntry } from '@/data/quality'
import type { Range } from '@/lib/range'

const AXIS = { Accuracy: 'acc', Completeness: 'comp', Formatting: 'fmt' } as const
const markTone = (v: number) => (v < 4 ? 'bad' : v < 5 ? 'warn' : 'ok')

/**
 * Everything about one person's quality, with the clock beside it.
 *
 * The two are shown together because either alone misleads: a clean score held
 * by taking twice the budgeted time is not quality, and a fast worker leaving
 * defects is not speed.
 */
export function QcStaffDetail({
  name,
  rows,
  range,
  teamAvg,
  people,
  tw,
  onBack,
}: {
  name: string
  rows: QcEntry[]
  range: Range
  teamAvg: number
  people: RatedPerson[]
  tw: StageWorkResult
  onBack: () => void
}) {
  /* Which of the four figures is being looked into. */
  const [focus, setFocus] = useState('all')
  const navigate = useNavigate()
  const mine = rows.filter((x) => x.onName === name).sort((a, b) => +b.d - +a.d)
  const me = people.find((p) => p.n === name)
  const staff = STAFF.find((x) => x.n === name)

  const back = (
    <Btn variant="ghost" small style={{ marginBottom: 14 }} onClick={onBack}>
      ← Everyone
    </Btn>
  )

  if (!mine.length || !me) {
    return (
      <>
        {back}
        <Card>
          <Empty icon="★">
            <b>{name}</b> has no ratings in this range. Widen the range, or check whether their work is being
            rated at all.
          </Empty>
        </Card>
      </>
    )
  }

  const defects = mine.filter((x) => x.defect)
  const below = mine.filter((x) => x.crit)
  const crit = (['Accuracy', 'Completeness', 'Formatting'] as const)
    .map((c) => ({
      c,
      n: below.filter((x) => x.crit === c).length,
      avg: mine.reduce((a, x) => a + x[AXIS[c]], 0) / mine.length,
    }))
    .sort((a, b) => b.n - a.n)

  const reasons: Record<string, number> = {}
  below.forEach((x) => {
    if (x.note) reasons[x.note] = (reasons[x.note] ?? 0) + 1
  })
  const topReasons = Object.entries(reasons).sort((a, b) => b[1] - a[1])

  const raters: Record<string, { n: string; c: number; s: number }> = {}
  mine.forEach((x) => {
    raters[x.byName] ??= { n: x.byName, c: 0, s: 0 }
    raters[x.byName].c++
    raters[x.byName].s += x.avg
  })
  const raterRows = Object.values(raters)
    .map((x) => ({ ...x, avg: x.s / x.c }))
    .sort((a, b) => b.c - a.c)

  const gap = me.o - teamAvg
  const thin = mine.length < 20
  const t = tw.people[name] ?? null
  const sd = t ? standing(me.o, t.vsPeers, teamAvg) : null

  const gapBg =
    Math.abs(gap) < 0.05 ? 'var(--tint)' : gap < 0 ? 'var(--warntint)' : 'var(--oktint)'

  return (
    <>
      {back}

      <Card padded>
        <div className="ch" style={{ border: 'none', padding: '0 0 12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Avatar
              name={name}
              style={{ width: 38, height: 38, fontSize: '13.5px' }}
              title={staff ? 'Full profile' : undefined}
              onClick={
                staff ? () => navigate({ to: '/staff/$personId', params: { personId: staff.id } }) : undefined
              }
            />
            <div>
              <h2 style={{ margin: 0, fontSize: '17px' }}>{name}</h2>
              <div className="gr" style={{ fontSize: '12.5px' }}>
                {staff ? staff.dep.join(', ') : 'no longer on staff'} · {mine.length} ratings · {range.label}
              </div>
            </div>
          </div>
          {staff ? (
            <div className="r">
              <Btn small onClick={() => navigate({ to: '/staff/$personId', params: { personId: staff.id } })}>
                Full profile
              </Btn>
            </div>
          ) : null}
        </div>

        {sd && t ? (
          <div
            className="rw"
            style={{
              background:
                sd[1] === 'v' ? 'var(--oktint)' : sd[1] === 'd' ? 'var(--badtint)' : 'var(--warntint)',
              borderRadius: 9,
              padding: '12px 14px',
              marginBottom: 10,
            }}
          >
            <span>
              <Chip kind={sd[1]}>{sd[0]}</Chip>
            </span>
            <span>
              <b>{sd[2]}</b>
              <div className="sd">
                Quality {me.o.toFixed(2)} against a team {teamAvg.toFixed(2)}, and inside budget on{' '}
                {t.onBudget}% of {t.c} stages — a median {t.ratio.toFixed(2)}× the time allowed.
              </div>
            </span>
            <span />
          </div>
        ) : null}

        <div className="rw" style={{ background: gapBg, borderRadius: 9, padding: '12px 14px' }}>
          <span
            className={Math.abs(gap) < 0.05 ? 'gr' : gap < 0 ? 'warn' : 'ok'}
            style={{ fontSize: '14.5px' }}
          >
            {Math.abs(gap) < 0.05 ? '=' : gap < 0 ? '▾' : '▴'}
          </span>
          <span>
            <b>
              {Math.abs(gap) < 0.05
                ? 'Indistinguishable from everyone else'
                : gap < 0
                  ? `${Math.abs(gap).toFixed(2)} below the team average`
                  : `${gap.toFixed(2)} above the team average`}
            </b>
            <div className="sd">
              {me.o.toFixed(2)} against {teamAvg.toFixed(2)} across everyone.{' '}
              {Math.abs(gap) < 0.15
                ? 'On a scale where almost every mark is a 5, a gap this small is noise — read the reasons below, not the number.'
                : gap < 0
                  ? 'Large enough to be worth a conversation, if the reasons below show a pattern.'
                  : 'Consistently clean work in this range.'}
              {thin ? ` Only ${mine.length} ratings, so treat all of this as indicative.` : ''}
            </div>
          </span>
          <span />
        </div>
      </Card>

      {/* Each tile opens the list it counts — a number you cannot get behind is
          a number you have to take on trust. */}
      <FocusKpis
        focus={focus}
        onFocus={setFocus}
        cards={[
          {
            key: 'all',
            title: 'Quality',
            value: me.o.toFixed(2),
            detail: `${mine.length} ratings`,
            count: mine.length,
          },
          {
            key: 'defects',
            title: 'Defects',
            value: <span className={defects.length ? 'bad' : 'ok'}>{defects.length}</span>,
            tone: defects.length ? 'alert' : undefined,
            detail: 'a 3 or below',
            count: defects.length,
          },
          {
            key: 'over',
            title: 'Inside budget',
            value: t ? <span className={t.onBudget >= 70 ? 'ok' : 'warn'}>{t.onBudget}%</span> : '—',
            tone: t && t.onBudget < 70 ? 'warn' : undefined,
            detail: t ? `${t.c - t.over} of ${t.c} stages` : 'no stage work in range',
            count: t ? t.over : 0,
          },
          {
            key: 'late',
            title: 'Late deliveries they overran on',
            value: t ? <span className={t.causedLate ? 'bad' : 'ok'}>{t.causedLate}</span> : '—',
            tone: t && t.causedLate ? 'alert' : undefined,
            detail: t ? 'their stage went over on a late order' : '',
            count: t ? t.causedLate : 0,
          },
        ]}
      />

      {focus !== 'all' ? (
        <>
          <FocusHead
            title={
              focus === 'defects'
                ? `Showing the ${defects.length} rating${defects.length === 1 ? '' : 's'} that logged a defect`
                : focus === 'over'
                  ? `Showing the ${t?.over ?? 0} stage${t?.over === 1 ? '' : 's'} that went over budget`
                  : `Showing the ${t?.causedLate ?? 0} late deliver${t?.causedLate === 1 ? 'y' : 'ies'} their stage overran on`
            }
            onBack={() => setFocus('all')}
          >
            Everything above is unchanged — only the list below is filtered.
          </FocusHead>

          {focus === 'defects' ? <QcDefects defects={defects} /> : null}
          {focus === 'over' && t ? <QcOverBudget work={t} lateOnly={false} /> : null}
          {focus === 'late' && t ? <QcOverBudget work={t} lateOnly /> : null}
        </>
      ) : (
        <>
      <div className="two" style={{ marginTop: 16 }}>
        <Card padded>
          <Label>Where the marks come off</Label>
          <p className="gr" style={{ fontSize: '12.5px', margin: '6px 0 12px' }}>
            {below.length
              ? `${below.length} rating${below.length === 1 ? '' : 's'} dropped below 5. This is which criterion caused it.`
              : 'Every rating in this range was a straight 5 on all three criteria.'}
          </p>
          {crit.map((c) => (
            <div
              key={c.c}
              style={{
                display: 'grid',
                gridTemplateColumns: '118px 1fr 92px',
                gap: 11,
                alignItems: 'center',
                padding: '6px 0',
                fontSize: '12.5px',
              }}
            >
              <span className="gr">{c.c}</span>
              <span className="bar">
                <i
                  style={{
                    width: `${below.length ? Math.round((c.n / Math.max(1, below.length)) * 100) : 0}%`,
                    background: c.n && c.c === crit[0].c ? 'var(--warn)' : 'var(--brand2)',
                  }}
                />
              </span>
              <span className="mono" style={{ textAlign: 'right' }}>
                {c.avg.toFixed(2)} {c.n ? <span className="gr">· {c.n}</span> : null}
              </span>
            </div>
          ))}
          {below.length && crit[0].n >= 2 ? (
            <p className="gr" style={{ fontSize: '12.5px', marginTop: 12 }}>
              <b>{crit[0].c}</b> accounts for {Math.round((crit[0].n / below.length) * 100)}% of the marks
              lost — that is the thing to coach, not the average.
            </p>
          ) : null}
        </Card>

        <QcMarks ratings={mine} />

      </div>

      <Card padded>
        <Label>Who did the rating</Label>
        {raterRows.map((x) => (
          <div
            key={x.n}
            style={{
              display: 'grid',
              gridTemplateColumns: '190px 1fr 110px',
              gap: 12,
              alignItems: 'center',
              padding: '6px 0',
              fontSize: '12.5px',
            }}
          >
            <span>
              <b>{x.n}</b>
            </span>
            <span className="bar">
              <i style={{ width: `${Math.round((x.c / mine.length) * 100)}%`, background: 'var(--brand2)' }} />
            </span>
            <span className="mono" style={{ textAlign: 'right' }}>
              {x.c} · avg {x.avg.toFixed(2)}
            </span>
          </div>
        ))}
        <p className="gr" style={{ fontSize: '12.5px', marginTop: 12 }}>
          {raterRows.length > 1 &&
          Math.max(...raterRows.map((x) => x.avg)) - Math.min(...raterRows.map((x) => x.avg)) > 0.2
            ? `Worth noticing: their raters do not agree with each other — ${raterRows[0].n} averages ${raterRows[0].avg.toFixed(2)} while another averages ${Math.min(...raterRows.map((x) => x.avg)).toFixed(2)}. On a flat scale, who checks the work can matter more than who did it.`
            : 'Their raters are broadly consistent with one another, so the score is more likely about the work than about who checked it.'}
        </p>
      </Card>

      {topReasons.length ? (
        <>
          <SectionHead>Why the marks came off — most common first</SectionHead>
          <Card>
            <div className="rows" style={{ border: 'none', borderRadius: 0 }}>
              {topReasons.map(([why, n]) => (
                <div className="rw" key={why}>
                  <span className={n > 1 ? 'warn' : 'gr'} style={{ fontSize: '14.5px' }}>
                    {n > 1 ? '⚑' : '·'}
                  </span>
                  <span>
                    <b>{why}</b>
                    {n > 1 ? (
                      <div className="sd warn">happened {n} times in this range — a habit, not a slip</div>
                    ) : (
                      <div className="sd gr">once</div>
                    )}
                  </span>
                  <span className="mono gr">{n}</span>
                </div>
              ))}
            </div>
          </Card>
          <p className="gr" style={{ fontSize: '12.5px', marginTop: 10 }}>
            A repeated reason is worth a five-minute conversation; a one-off usually is not. That distinction
            is the difference between coaching and nagging.
          </p>
        </>
      ) : null}

      {t ? (
        <>
          <SectionHead>Time against the budget, department by department</SectionHead>
          <Card padded>
            <p className="gr" style={{ fontSize: '12.5px', margin: '0 0 14px' }}>
              Their own stages only. The budget is whatever Stage budgets allows that department on that
              product, so a 40-year search is judged against a 40-year search budget.
            </p>
            {ASSIGN_STAGES.filter((st) => t.stages[st]?.length).map((st) => {
              const list = t.stages[st]
              const m = median(list.map((x) => x.ratio))
              const ov = list.filter((x) => x.over).length
              return (
                <div
                  key={st}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '118px 1fr 190px',
                    gap: 12,
                    alignItems: 'center',
                    padding: '7px 0',
                    fontSize: '12.5px',
                  }}
                >
                  <span className="gr">{st}</span>
                  <span style={{ position: 'relative', height: 16 }}>
                    <span className="bar" style={{ position: 'absolute', inset: 0, height: 16 }}>
                      <i style={{ width: '50%', background: 'var(--brandsoft)' }} />
                    </span>
                    <span
                      className="bar"
                      style={{ position: 'absolute', inset: '4px 0', height: 8, background: 'transparent' }}
                    >
                      <i
                        style={{
                          width: `${Math.min(100, Math.round(m * 50))}%`,
                          background: m > 1 ? 'var(--warn)' : 'var(--brand2)',
                        }}
                      />
                    </span>
                  </span>
                  <span className="mono" style={{ textAlign: 'right', fontSize: '12.5px' }}>
                    {m.toFixed(2)}× budget
                    <span className={ov / list.length > 0.3 ? 'warn' : 'gr'}>
                      {' '}
                      · over on {ov} of {list.length}
                    </span>
                  </span>
                </div>
              )
            })}
            <p className="gr" style={{ fontSize: '12.5px', marginTop: 12 }}>
              The pale bar is the budget, the solid bar is their median.{' '}
              {t.erratic
                ? `Their typical order is fine — a median of ${t.ratio.toFixed(2)}× — but they only land inside budget ${t.onBudget}% of the time against ${t.expected}% for their peers. That is a spread problem, not a speed problem: most orders are quick and a few run long. Worth finding out what the long ones have in common before treating it as pace.`
                : t.ratio > 1.05
                  ? `They run at ${t.ratio.toFixed(2)}× the time allowed, and land inside budget ${t.onBudget}% of the time against ${t.expected}% for peers doing the same stages — so this is not explained by the work they happen to get.`
                  : t.vsPeers >= 5
                    ? `They beat their peers by ${t.vsPeers} points on the same stages. Worth checking the defect count before calling that a good thing — speed bought with skipped checks is not speed.`
                    : `They track the budget closely, and sit within ${Math.abs(t.vsPeers)} point${Math.abs(t.vsPeers) === 1 ? '' : 's'} of what peers on the same stages manage.`}
            </p>
          </Card>

          {t.causedLate ? (
            <>
              <SectionHead>Late deliveries where their stage overran</SectionHead>
              <FlexTable
                cols="120px 140px 130px 130px 1fr"
                min={760}
                head={['Delivered', 'Order', 'Stage', 'Took', 'Against a budget of']}
              >
                {t.items
                  .filter((x) => x.over && x.d.late)
                  .slice(0, 10)
                  .map((x, i) => (
                    <FlexRow cols="120px 140px 130px 130px 1fr" key={`${x.d.id}-${x.st}-${i}`}>
                      <Cell v={x.d.dk} mono />
                      <Cell v={x.d.id} mono s={`${x.d.cl} · ${x.d.pr}`} />
                      <Cell v={x.st} />
                      <Cell v={hh(x.h)} mono tone="warn" />
                      <Cell>
                        <div className="v mono" style={{ fontSize: '12.5px' }}>
                          {hh(x.budget)}{' '}
                          <span className={x.ratio > 2 ? 'bad' : 'warn'}>· {x.ratio.toFixed(1)}×</span>
                        </div>
                      </Cell>
                    </FlexRow>
                  ))}
              </FlexTable>
              <p className="gr" style={{ fontSize: '12.5px', marginTop: 10 }}>
                An order can be late without this list growing — a stage that stayed inside its budget is not
                the reason the order missed.
              </p>
            </>
          ) : null}
        </>
      ) : null}

      <SectionHead>Every rating in range</SectionHead>
      <FlexTable
        cols="110px 140px 130px 120px 1fr 150px"
        min={960}
        head={['Date', 'Order', 'Stage', 'Marks', 'What the rater said', 'Rated by']}
      >
        {mine.map((x, i) => (
          <FlexRow cols="110px 140px 130px 120px 1fr 150px" key={`${x.order}-${i}`}>
            <Cell v={x.dk} mono />
            <Cell v={x.order} mono s={`${x.cl} · ${x.pr}`} />
            <Cell v={x.stage} />
            <Cell>
              <div className="v mono" style={{ fontSize: '12.5px' }}>
                <span className={markTone(x.acc)}>{x.acc}</span> ·{' '}
                <span className={markTone(x.comp)}>{x.comp}</span> ·{' '}
                <span className={markTone(x.fmt)}>{x.fmt}</span>
              </div>
              <div className="s">acc · comp · fmt</div>
            </Cell>
            <Cell
              v={x.note ?? <span className="gr">clean — nothing raised</span>}
              tone={x.defect ? 'bad' : undefined}
              s={x.crit ?? undefined}
            />
            <Cell v={x.byName} />
          </FlexRow>
        ))}
      </FlexTable>
        </>
      )}
    </>
  )
}