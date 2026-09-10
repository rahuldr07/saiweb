import { BarRow, Card, Chip, Label, SectionHead } from '@/components/ui'
import { QC_CRITERIA, QC_SCALE } from '@/lib/quality'
import { hh } from '@/lib/sla'
import type { QcEntry } from '@/data/quality'
import type { StageWork } from '@/lib/quality'

const scaleWord = (v: number) => QC_SCALE.find((q) => q[0] === v)?.[1] ?? ''

export function QcDefects({ defects }: { defects: QcEntry[] }) {
  const list = [...defects].sort((a, b) => b.d.getTime() - a.d.getTime())

  const byCrit = list.reduce<Record<string, number>>((acc, x) => {
    const failed = QC_CRITERIA.filter(([, field]) => x[field] <= 3).map(([name]) => name)
    for (const c of failed.length ? failed : ['Accuracy']) acc[c] = (acc[c] ?? 0) + 1
    return acc
  }, {})

  return (
    <>
      <SectionHead>
        What the {list.length} defect{list.length === 1 ? ' was' : 's were'}
      </SectionHead>

      {Object.keys(byCrit).length ? (
        <Card padded style={{ marginBottom: 14 }}>
          <Label>By criterion</Label>
          <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap', marginTop: 9 }}>
            {Object.entries(byCrit)
              .sort((a, b) => b[1] - a[1])
              .map(([c, n]) => (
                <Chip key={c} kind={n > 1 ? 'd' : 'r'}>
                  {c} · {n}
                </Chip>
              ))}
          </div>
        </Card>
      ) : null}

      <Card>
        <div className="tb">
          {list.map((x, i) => {
            const failed = QC_CRITERIA.filter(([, field]) => x[field] <= 3)
            const severe = x.acc <= 2 || x.comp <= 2 || x.fmt <= 2
            return (
              <div
                className="trow"
                key={`${x.order}-${x.stage}-${i}`}
                style={{ gridTemplateColumns: '1fr', padding: '15px 16px' }}
              >
                <div className="cell" style={{ display: 'block' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                    <span className={severe ? 'bad' : 'warn'} style={{ fontSize: 'var(--t-h3)', lineHeight: 1.2 }}>
                      ⚑
                    </span>
                    <div style={{ flex: 1, minWidth: 260 }}>
                      <div style={{ fontSize: 'var(--t-body)', fontWeight: 650, marginBottom: 3 }}>
                        {x.note || 'No reason was recorded'}
                      </div>
                      <div className="gr" style={{ fontSize: 'var(--t-small)' }}>
                        {failed.map(([name, field], j) => (
                          <span key={name}>
                            {j ? ' · ' : ''}
                            <b className={x[field] <= 2 ? 'bad' : 'warn'}>
                              {name} scored {x[field]} — {scaleWord(x[field])}
                            </b>
                          </span>
                        ))}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', minWidth: 210 }}>
                      <div className="mono" style={{ fontSize: 'var(--t-small)' }}>
                        {x.order}
                      </div>
                      <div className="gr" style={{ fontSize: 'var(--t-label)' }}>
                        {x.cl} · {x.pr} · {x.stage}
                      </div>
                      <div className="gr" style={{ fontSize: 'var(--t-label)' }}>
                        {x.dk} · rated by {x.byName}
                      </div>
                    </div>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      gap: 16,
                      marginTop: 11,
                      paddingTop: 11,
                      borderTop: '1px solid var(--hair)',
                      fontSize: 'var(--t-small)',
                    }}
                  >
                    {QC_CRITERIA.map(([name, field]) => (
                      <span className="gr" key={name}>
                        {name}
                        <b
                          className={`mono ${x[field] <= 2 ? 'bad' : x[field] <= 3 ? 'warn' : 'ok'}`}
                          style={{ marginLeft: 5 }}
                        >
                          {x[field]}
                        </b>
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </Card>

      <p className="gr" style={{ fontSize: 'var(--t-small)', marginTop: 10 }}>
        A defect is any criterion scored 3 or below. The bold line is what the rater wrote — that,
        not the number, is the thing worth acting on.
      </p>
    </>
  )
}

const OVER_COLS = '40px 120px 165px 130px 105px 105px 1fr'

export function QcOverBudget({ work, lateOnly }: { work: StageWork; lateOnly: boolean }) {
  const items = work.items
    .filter((x) => x.over && (!lateOnly || x.d.late))
    .sort((a, b) => b.ratio - a.ratio)
  const onTime = items.filter((x) => !x.d.late).length

  return (
    <>
      <SectionHead>
        {lateOnly
          ? `The ${items.length} late deliver${items.length === 1 ? 'y' : 'ies'} their stage overran on`
          : `The ${items.length} stage${items.length === 1 ? '' : 's'} that went over budget`}
      </SectionHead>

      <Card>
        <div className="tsc">
          <div style={{ minWidth: 860 }}>
            <div className="trow h" style={{ gridTemplateColumns: OVER_COLS }}>
              <span>#</span>
              <span>Delivered</span>
              <span>Order</span>
              <span>Stage</span>
              <span>Took</span>
              <span>Budget</span>
              <span>How far over</span>
            </div>
            <div className="tb">
              {items.map((x, i) => (
                <div
                  className="trow"
                  key={`${x.d.id}-${x.st}-${i}`}
                  style={{ gridTemplateColumns: OVER_COLS }}
                >
                  <div className="cell">
                    <div className="gr mono" style={{ fontSize: 'var(--t-label)' }}>
                      {i + 1}
                    </div>
                  </div>
                  <div className="cell">
                    <div className="v mono" style={{ fontSize: 'var(--t-small)' }}>
                      {x.d.dk}
                    </div>
                  </div>
                  <div className="cell">
                    <div className="v mono" style={{ fontSize: 'var(--t-small)' }}>
                      {x.d.id}
                    </div>
                    <div className="s">
                      {x.d.cl} · {x.d.pr} · {x.d.slaH}h promise
                    </div>
                    {x.d.late ? (
                      <div className="s bad">delivered late</div>
                    ) : (
                      <div className="s ok">still delivered on time</div>
                    )}
                  </div>
                  <div className="cell">
                    <div className="v" style={{ fontSize: 'var(--t-small)' }}>
                      {x.st}
                    </div>
                  </div>
                  <div className="cell">
                    <div className="v mono warn">{hh(x.h)}</div>
                  </div>
                  <div className="cell">
                    <div className="v mono gr">{hh(x.budget)}</div>
                  </div>
                  <div className="cell">
                    <div className={`v mono ${x.ratio > 2 ? 'bad' : 'warn'}`}>
                      {x.ratio.toFixed(2)}× · +{hh(x.h - x.budget)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Card>

      <p className="gr" style={{ fontSize: 'var(--t-small)', marginTop: 10 }}>
        Worst first.{' '}
        {lateOnly
          ? 'These are the ones nothing absorbed.'
          : `${onTime} of these still went out on time — the buffer and the other departments absorbed them. That is why this list is longer than the one beside it.`}
      </p>
    </>
  )
}

const SPREAD = {
  person: { cols: '118px 1fr 62px', gap: 11, pad: '5px 0' },
  team: { cols: '150px 1fr 120px', gap: 12, pad: '6px 0' },
} as const

export function MarkSpread({ marks, mode }: { marks: number[]; mode: keyof typeof SPREAD }) {
  const { cols, gap, pad } = SPREAD[mode]

  return (
    <>
      {[5, 4, 3, 2, 1].map((v) => {
        const n = marks.filter((m) => m === v).length
        const scale = QC_SCALE.find((q) => q[0] === v)
        return (
          <BarRow
            key={v}
            cols={cols}
            gap={gap}
            padding={pad}
            labelClass=""
            label={
              <Chip kind={scale?.[2] ?? 'n'}>
                {v} · {scale?.[1] ?? ''}
              </Chip>
            }
            value={n}
            max={marks.length}
            color={v >= 4 ? 'var(--ok)' : 'var(--warn)'}
            rightClass="mono gr"
            right={
              mode === 'team'
                ? `${n.toLocaleString()} · ${marks.length ? ((n / marks.length) * 100).toFixed(1) : '0.0'}%`
                : n || '—'
            }
          />
        )
      })}
    </>
  )
}

export function QcMarks({ ratings }: { ratings: QcEntry[] }) {
  const all = ratings.flatMap((x) => [x.acc, x.comp, x.fmt])

  return (
    <Card padded>
      <Label>Spread of individual marks</Label>
      <p className="gr" style={{ fontSize: 'var(--t-small)', margin: '6px 0 12px' }}>
        {all.length} criterion marks across {ratings.length} ratings.
      </p>
      <MarkSpread marks={all} mode="person" />
      <p className="gr" style={{ fontSize: 'var(--t-small)', marginTop: 12 }}>
        Counted per criterion rather than per rating, so a single order can contribute a 5 and a 3.
      </p>
    </Card>
  )
}
