import { Cell, FlexRow, FlexTable } from './FlexTable'
import { markTone } from '@/lib/quality'
import type { QcEntry } from '@/data/quality'

const HEAD = ['#', 'Date', 'Order', 'Stage', 'Marks', 'What the rater said', 'Rated by']

export function RatingMarks({ x, legend }: { x: QcEntry; legend?: boolean | undefined }) {
  const sep = legend ? ' · ' : '·'

  return (
    <Cell>
      <div className="v mono" style={{ fontSize: 'var(--t-small)' }}>
        <span className={markTone(x.acc)}>{x.acc}</span>
        {sep}
        <span className={markTone(x.comp)}>{x.comp}</span>
        {sep}
        <span className={markTone(x.fmt)}>{x.fmt}</span>
      </div>
      {legend ? <div className="s">acc · comp · fmt</div> : null}
    </Cell>
  )
}

export function RatingsTable({
  rows,
  cols,
  min,
  legend,
  highlightDefectsOnly,
}: {
  rows: QcEntry[]
  cols: string
  min: number
  legend?: boolean | undefined
  highlightDefectsOnly?: boolean | undefined
}) {
  const list = [...rows].sort((a, b) => b.d.getTime() - a.d.getTime())

  return (
    <FlexTable cols={cols} min={min} head={HEAD}>
      {list.map((x, i) => (
        <FlexRow cols={cols} key={`${x.order}-${x.stage}-${i}`}>
          <Cell v={i + 1} mono tone="gr" />
          <Cell v={x.dk} mono />
          <Cell v={x.order} mono s={`${x.cl} · ${x.pr}`} />
          <Cell v={x.stage} />
          <RatingMarks x={x} legend={legend} />
          {x.note ? (
            <Cell
              v={x.note}
              s={x.crit ?? undefined}
              tone={x.defect ? 'bad' : highlightDefectsOnly ? undefined : 'warn'}
            />
          ) : (
            <Cell v="clean — nothing raised" tone="gr" />
          )}
          <Cell v={x.byName} />
        </FlexRow>
      ))}
    </FlexTable>
  )
}
