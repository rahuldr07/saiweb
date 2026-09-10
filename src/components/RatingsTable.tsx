import { Cell, FlexRow, FlexTable } from './FlexTable'
import { markTone } from '@/lib/quality'
import type { QcEntry } from '@/data/quality'

/**
 * The register of QC ratings, and the three marks that make up one row.
 *
 * Lives here rather than beside either caller because the same table is read
 * from a person's profile and from two tabs of the Quality report, and
 * `src/components` is the only direction a screen and a report tab can both
 * import from — nothing under `src/screens` reaches into another screen's
 * folder.
 *
 * The column widths are a prop: the profile's Quality tab and the report give
 * the same six columns different room, and those are the design's numbers on
 * each screen rather than a difference worth flattening.
 */

const HEAD = ['Date', 'Order', 'Stage', 'Marks', 'What the rater said', 'Rated by']

/**
 * Accuracy, completeness and formatting on one rating, each coloured by where it
 * sits on the scale.
 *
 * `legend` names the three underneath — three bare numbers do not say which is
 * which — and spaces them to match that caption. Only the tables wide enough to
 * carry it ask for it.
 */
export function RatingMarks({ x, legend }: { x: QcEntry; legend?: boolean | undefined }) {
  const sep = legend ? ' · ' : '·'

  return (
    <Cell>
      <div className="v mono" style={{ fontSize: '12.5px' }}>
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
  /** Reserve colour for defects, so an ordinary note reads in body text. */
  highlightDefectsOnly?: boolean | undefined
}) {
  /* Newest first, sorted here rather than by the caller so the register reads
     the same way wherever it is opened from. */
  const list = [...rows].sort((a, b) => b.d.getTime() - a.d.getTime())

  return (
    <FlexTable cols={cols} min={min} head={HEAD}>
      {list.map((x, i) => (
        <FlexRow cols={cols} key={`${x.order}-${x.stage}-${i}`}>
          <Cell v={x.dk} mono />
          <Cell v={x.order} mono s={`${x.cl} · ${x.pr}`} />
          <Cell v={x.stage} />
          <RatingMarks x={x} legend={legend} />
          {/* A note with no defect behind it still means marks came off, so by
              default the reason is amber to agree with the amber mark a cell to
              the left. The Quality report asks for the other treatment: it
              counts and ranks every note in the sections above this table, so
              amber on each row there repeats a point the screen already makes,
              and colour is left to mean a defect. */}
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
