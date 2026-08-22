import { Card, Chip, Label, SectionHead } from '@/components/ui'
import { QC_SCALE } from '@/lib/quality'
import { hh } from '@/lib/sla'
import type { QcEntry } from '@/data/quality'
import type { StageWork } from '@/lib/quality'

/**
 * What one of a person's four figures is actually made of.
 *
 * A number you cannot get behind is a number you have to take on trust, so each
 * tile opens the list it counts. The defect panel leads with what the rater
 * wrote rather than the score — the sentence is the thing worth acting on; the
 * number is only how it was filed.
 */

const scaleWord = (v: number) => QC_SCALE.find((q) => q[0] === v)?.[1] ?? ''

const CRITERIA: [string, keyof Pick<QcEntry, 'acc' | 'comp' | 'fmt'>][] = [
  ['Accuracy', 'acc'],
  ['Completeness', 'comp'],
  ['Formatting', 'fmt'],
]

export function QcDefects({ defects }: { defects: QcEntry[] }) {
  const list = [...defects].sort((a, b) => b.d.getTime() - a.d.getTime())

  /* One rating can lose marks on more than one criterion, so a defect counts
     against each one it failed. */
  const byCrit = list.reduce<Record<string, number>>((acc, x) => {
    const failed = CRITERIA.filter(([, k]) => x[k] <= 3).map(([c]) => c)
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
            const failed = CRITERIA.filter(([, k]) => x[k] <= 3)
            const severe = x.acc <= 2 || x.comp <= 2 || x.fmt <= 2
            return (
              <div
                className="trow"
                key={`${x.order}-${x.stage}-${i}`}
                style={{ gridTemplateColumns: '1fr', padding: '15px 16px' }}
              >
                <div className="cell" style={{ display: 'block' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                    <span className={severe ? 'bad' : 'warn'} style={{ fontSize: '17px', lineHeight: 1.2 }}>
                      ⚑
                    </span>
                    <div style={{ flex: 1, minWidth: 260 }}>
                      <div style={{ fontSize: '13.5px', fontWeight: 650, marginBottom: 3 }}>
                        {x.note || 'No reason was recorded'}
                      </div>
                      <div className="gr" style={{ fontSize: '12.5px' }}>
                        {failed.map(([c, k], j) => (
                          <span key={c}>
                            {j ? ' · ' : ''}
                            <b className={x[k] <= 2 ? 'bad' : 'warn'}>
                              {c} scored {x[k]} — {scaleWord(x[k])}
                            </b>
                          </span>
                        ))}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', minWidth: 210 }}>
                      <div className="mono" style={{ fontSize: '12.5px' }}>
                        {x.order}
                      </div>
                      <div className="gr" style={{ fontSize: '11.5px' }}>
                        {x.cl} · {x.pr} · {x.stage}
                      </div>
                      <div className="gr" style={{ fontSize: '11.5px' }}>
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
                      fontSize: '12.5px',
                    }}
                  >
                    {CRITERIA.map(([c, k]) => (
                      <span className="gr" key={c}>
                        {c}
                        <b
                          className={`mono ${x[k] <= 2 ? 'bad' : x[k] <= 3 ? 'warn' : 'ok'}`}
                          style={{ marginLeft: 5 }}
                        >
                          {x[k]}
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

      <p className="gr" style={{ fontSize: '12.5px', marginTop: 10 }}>
        A defect is any criterion scored 3 or below. The bold line is what the rater wrote — that,
        not the number, is the thing worth acting on.
      </p>
    </>
  )
}

const OVER_COLS = '120px 165px 130px 105px 105px 1fr'

/** The stages that ran over their budget, worst overrun first. */
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
                    <div className="v mono" style={{ fontSize: '12.5px' }}>
                      {x.d.dk}
                    </div>
                  </div>
                  <div className="cell">
                    <div className="v mono" style={{ fontSize: '12.5px' }}>
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
                    <div className="v" style={{ fontSize: '12.5px' }}>
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

      <p className="gr" style={{ fontSize: '12.5px', marginTop: 10 }}>
        Worst first.{' '}
        {lateOnly
          ? 'These are the ones nothing absorbed.'
          : `${onTime} of these still went out on time — the buffer and the other departments absorbed them. That is why this list is longer than the one beside it.`}
      </p>
    </>
  )
}

/**
 * How one person's marks are spread.
 *
 * Counted per criterion rather than per rating, so a single order can contribute
 * a 5 and a 3 — which is the point: an average of 4 hides whether it was three
 * fours or a five and a three.
 */
export function QcMarks({ ratings }: { ratings: QcEntry[] }) {
  const all = ratings.flatMap((x) => [x.acc, x.comp, x.fmt])
  const dist = [5, 4, 3, 2, 1].map((v) => ({ v, n: all.filter((m) => m === v).length }))

  return (
    <Card padded>
      <Label>Spread of individual marks</Label>
      <p className="gr" style={{ fontSize: '12.5px', margin: '6px 0 12px' }}>
        {all.length} criterion marks across {ratings.length} ratings.
      </p>
      {dist.map((d) => {
        const scale = QC_SCALE.find((q) => q[0] === d.v)
        return (
          <div
            key={d.v}
            style={{
              display: 'grid',
              gridTemplateColumns: '118px 1fr 62px',
              gap: 11,
              alignItems: 'center',
              padding: '5px 0',
              fontSize: '12.5px',
            }}
          >
            <span>
              <Chip kind={scale?.[2] ?? 'n'}>
                {d.v} · {scale?.[1] ?? ''}
              </Chip>
            </span>
            <span className="bar">
              <i
                style={{
                  width: `${all.length ? Math.round((d.n / all.length) * 100) : 0}%`,
                  background: d.v >= 4 ? 'var(--ok)' : 'var(--warn)',
                }}
              />
            </span>
            <span className="mono gr" style={{ textAlign: 'right' }}>
              {d.n || '—'}
            </span>
          </div>
        )
      })}
      <p className="gr" style={{ fontSize: '12.5px', marginTop: 12 }}>
        Counted per criterion rather than per rating, so a single order can contribute a 5 and a 3.
      </p>
    </Card>
  )
}
