import { Banner, Card, Chip, Label, SectionHead } from '@/components/ui'
import { Cell, FlexRow, FlexTable } from '@/components/FlexTable'
import { FocusHead } from '@/components/FocusKpis'
import { QC_SCALE, type RatedPerson } from '@/lib/quality'
import { hh } from '@/lib/sla'
import { fmtDate } from '@/lib/format'
import type { Delivery } from '@/data/deliveries'
import type { QcEntry } from '@/data/quality'
import type { Range } from '@/lib/range'

const markTone = (v: number) => (v < 4 ? 'bad' : v < 5 ? 'warn' : 'ok')

/** What one headline quality figure actually contains. */
export function QcTeamFocus({
  focus,
  dels,
  rows,
  defects,
  range,
  people,
  overall,
  onBack,
  onOpenPerson,
  onOpenRules,
}: {
  focus: string
  dels: Delivery[]
  rows: QcEntry[]
  defects: QcEntry[]
  range: Range
  people: RatedPerson[]
  overall: number
  onBack: () => void
  onOpenPerson: (name: string) => void
  onOpenRules: () => void
}) {
  const cover = dels.length ? Math.round((rows.length / (dels.length * 2)) * 100) : 0

  const head = (
    <FocusHead
      title={
        focus === 'delivered'
          ? `The ${dels.length} deliveries behind that number`
          : focus === 'unrated'
            ? 'The checks that were never filled in'
            : focus === 'spread'
              ? 'Every mark that made up that average'
              : `All ${defects.length} defect${defects.length === 1 ? '' : 's'} in this range`
      }
      onBack={onBack}
    >
      {fmtDate(range.from)} to {fmtDate(range.to)}. The rest of the report is hidden while you are looking at
      this.
    </FocusHead>
  )

  if (focus === 'delivered') {
    const late = dels.filter((x) => x.late)
    return (
      <>
        {head}
        <SectionHead>
          Delivered — {dels.length}, of which {late.length} late
        </SectionHead>
        <FlexTable
          cols="110px 150px 150px 110px 110px 130px 1fr"
          min={900}
          head={['Date', 'Order', 'Client', 'Promise', 'Took', 'Outcome', 'Rated']}
        >
          {dels
            .slice()
            .sort((a, b) => +b.d - +a.d)
            .map((x) => {
              const rated = rows.filter((y) => y.order === x.id)
              return (
                <FlexRow cols="110px 150px 150px 110px 110px 130px 1fr" key={x.id}>
                  <Cell v={x.dk} mono />
                  <Cell v={x.id} mono s={x.pr} />
                  <Cell v={x.cl} />
                  <Cell v={`${x.slaH}h`} mono />
                  <Cell v={hh(x.hrs)} mono tone={x.late ? 'bad' : 'ok'} />
                  <Cell>{x.late ? <Chip kind="d">Late</Chip> : <Chip kind="v">On time</Chip>}</Cell>
                  <Cell>
                    <div className="v" style={{ fontSize: '12.5px' }}>
                      {rated.length === 2 ? (
                        <span className="ok">both checks rated</span>
                      ) : rated.length === 1 ? (
                        <span className="warn">1 of 2 — {rated[0].stage} only</span>
                      ) : (
                        <span className="bad">neither check rated</span>
                      )}
                    </div>
                  </Cell>
                </FlexRow>
              )
            })}
        </FlexTable>
        <p className="gr" style={{ fontSize: '12.5px', marginTop: 10 }}>
          Two checks are expected on every delivery — one on the search, one on the typing. The right-hand
          column is where the {cover}% coverage figure comes from.
        </p>
      </>
    )
  }

  if (focus === 'unrated') {
    const gaps: { d: Delivery; st: string; who: string }[] = []
    dels.forEach((d) =>
      ['Search', 'Typing'].forEach((st) => {
        if (!rows.some((y) => y.order === d.id && y.stage === st))
          gaps.push({ d, st, who: d.byName?.[st] ?? 'unknown' })
      }),
    )
    const byWho: Record<string, number> = {}
    gaps.forEach((g) => (byWho[g.who] = (byWho[g.who] ?? 0) + 1))
    const peak = Math.max(1, ...Object.values(byWho))

    return (
      <>
        {head}
        <SectionHead>{gaps.length} checks were never filled in</SectionHead>
        <Banner kind="d" icon="⚑" title="This is the gap, and it is bigger than any score on the page">
          {gaps.length} of {dels.length * 2} checks have no rating at all. Nothing was recorded, so nothing
          can be reviewed — and every average on this report is drawn from the {cover}% that were. Making a
          rating mandatory before an order can be marked Sent closes this without asking anyone to work
          differently.
        </Banner>
        <Card padded style={{ marginTop: 14 }}>
          <Label>Whose work went unchecked</Label>
          {Object.entries(byWho)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 12)
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
            Spread fairly evenly, which says the gap is a process problem rather than one person being
            skipped.{' '}
            <button type="button" style={{ color: 'var(--brand)' }} onClick={onOpenRules}>
              The rule that fixes it
            </button>
          </p>
        </Card>
        <SectionHead>Every unrated check</SectionHead>
        <FlexTable
          cols="110px 160px 150px 130px 1fr"
          min={760}
          head={['Delivered', 'Order', 'Client', 'Stage', 'Whose work']}
        >
          {gaps
            .sort((a, b) => +b.d.d - +a.d.d)
            .map((g, i) => (
              <FlexRow cols="110px 160px 150px 130px 1fr" key={`${g.d.id}-${g.st}-${i}`}>
                <Cell v={g.d.dk} mono />
                <Cell v={g.d.id} mono s={g.d.pr} />
                <Cell v={g.d.cl} />
                <Cell v={g.st} />
                <Cell v={g.who} />
              </FlexRow>
            ))}
        </FlexTable>
      </>
    )
  }

  if (focus === 'spread') {
    const marks: number[] = []
    rows.forEach((x) => marks.push(x.acc, x.comp, x.fmt))
    const dist = [5, 4, 3, 2, 1].map((v) => ({ v, n: marks.filter((m) => m === v).length }))
    const sorted = people.slice().sort((a, b) => b.o - a.o)
    const lo = sorted.length ? Math.min(...sorted.map((x) => x.o)) : 0
    const hi = sorted.length ? Math.max(...sorted.map((x) => x.o)) : 0

    return (
      <>
        {head}
        <SectionHead>
          Every one of the {marks.length.toLocaleString()} marks behind {overall.toFixed(2)}
        </SectionHead>
        <Card padded>
          <Label>How the marks fall</Label>
          {dist.map((d) => {
            const scale = QC_SCALE.find((q) => q[0] === d.v)
            return (
              <div
                key={d.v}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '150px 1fr 120px',
                  gap: 12,
                  alignItems: 'center',
                  padding: '6px 0',
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
                      width: `${marks.length ? Math.round((d.n / marks.length) * 100) : 0}%`,
                      background: d.v >= 4 ? 'var(--ok)' : 'var(--warn)',
                    }}
                  />
                </span>
                <span className="mono gr" style={{ textAlign: 'right' }}>
                  {d.n.toLocaleString()} · {marks.length ? ((d.n / marks.length) * 100).toFixed(1) : '0.0'}%
                </span>
              </div>
            )
          })}
          <p className="gr" style={{ fontSize: '12.5px', marginTop: 12 }}>
            <b>{marks.length ? ((dist[0].n / marks.length) * 100).toFixed(0) : 0}% of all marks are a 5.</b> An
            average built from that cannot rank anyone — the question is not who scores lower, it is whether
            raters are willing to give a 3.
          </p>
        </Card>
        <SectionHead>Everyone, best to worst — and how little separates them</SectionHead>
        <Card padded>
          {sorted.map((p) => {
            const pos = hi === lo ? 50 : ((p.o - lo) / (hi - lo)) * 100
            return (
              <div
                key={p.n}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '170px 1fr 70px',
                  gap: 12,
                  alignItems: 'center',
                  padding: '5px 0',
                  fontSize: '12.5px',
                }}
              >
                <span>{p.n}</span>
                <span
                  style={{ position: 'relative', height: 14, background: 'var(--rail)', borderRadius: 5 }}
                >
                  <span
                    style={{
                      position: 'absolute',
                      left: `calc(${pos}% - 5px)`,
                      top: 2,
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      background: 'var(--brand)',
                    }}
                  />
                </span>
                <span className="mono" style={{ textAlign: 'right' }}>
                  {p.o.toFixed(2)}
                </span>
              </div>
            )
          })}
          <p className="gr" style={{ fontSize: '12.5px', marginTop: 12 }}>
            The dots span the full width, but the scale underneath runs only from {lo.toFixed(2)} to{' '}
            {hi.toFixed(2)}. Stretching a {(hi - lo).toFixed(2)} range across a chart is how a flat measure
            gets mistaken for a meaningful one.
          </p>
        </Card>
      </>
    )
  }

  /* defects */
  const list = defects.slice().sort((a, b) => +b.d - +a.d)
  const byReason: Record<string, number> = {}
  list.forEach((x) => {
    if (x.note) byReason[x.note] = (byReason[x.note] ?? 0) + 1
  })

  return (
    <>
      {head}
      <SectionHead>
        What the {list.length} defect{list.length === 1 ? ' was' : 's were'}
      </SectionHead>
      {Object.keys(byReason).length ? (
        <Card padded style={{ marginBottom: 14 }}>
          <Label>Grouped by reason</Label>
          <div className="rows" style={{ border: 'none', borderRadius: 0, marginTop: 6 }}>
            {Object.entries(byReason)
              .sort((a, b) => b[1] - a[1])
              .map(([why, n]) => (
                <div className="rw" key={why}>
                  <span className={n > 1 ? 'warn' : 'gr'} style={{ fontSize: '14.5px' }}>
                    {n > 1 ? '⚑' : '·'}
                  </span>
                  <span>
                    <b>{why}</b>
                    {n > 1 ? (
                      <div className="sd warn">
                        seen {n} times across the team — worth fixing in the process, not with one person
                      </div>
                    ) : null}
                  </span>
                  <span className="mono gr">{n}</span>
                </div>
              ))}
          </div>
        </Card>
      ) : null}
      <FlexTable
        cols="105px 150px 140px 120px 110px 1fr"
        min={900}
        head={['Date', 'Order', 'Who', 'Stage', 'Marks', 'What the rater said']}
      >
        {list.map((x, i) => (
          <FlexRow cols="105px 150px 140px 120px 110px 1fr" key={`${x.order}-${i}`}>
            <Cell v={x.dk} mono />
            <Cell v={x.order} mono s={`${x.cl} · ${x.pr}`} />
            <Cell>
              <button
                type="button"
                style={{ fontSize: '12.5px', color: 'var(--brand)' }}
                onClick={() => onOpenPerson(x.onName)}
              >
                {x.onName}
              </button>
              <div className="s">by {x.byName}</div>
            </Cell>
            <Cell v={x.stage} />
            <Cell>
              <div className="v mono" style={{ fontSize: '12.5px' }}>
                <span className={markTone(x.acc)}>{x.acc}</span>·
                <span className={markTone(x.comp)}>{x.comp}</span>·
                <span className={markTone(x.fmt)}>{x.fmt}</span>
              </div>
            </Cell>
            <Cell v={x.note ?? 'no reason recorded'} tone="bad" s={x.crit ?? undefined} />
          </FlexRow>
        ))}
      </FlexTable>
      <p className="gr" style={{ fontSize: '12.5px', marginTop: 10 }}>
        Click a name to see everything about that person. A reason appearing more than once is a process
        problem — the same mistake made by different people is not a coincidence.
      </p>
    </>
  )
}
