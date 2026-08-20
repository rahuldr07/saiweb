import { useNavigate } from '@tanstack/react-router'
import { Avatar, Banner, Card, Chip, SectionHead } from '@/components/ui'
import { Cell, FlexRow, FlexTable } from '@/components/FlexTable'
import { FocusHead } from '@/components/FocusKpis'
import { board, isDone } from '@/lib/engine'
import { ASSIGN_STAGES } from '@/data/org'
import { AVAIL, STAFF } from '@/data/people'
import { whoName } from '@/lib/permissions'

/** What each exclusion means, and what would actually clear it. */
const CAUSE: Record<string, [string, string]> = {
  capacity: [
    'Everyone eligible was already at their daily target',
    'Raise the target, add someone to that department, or accept the queue.',
  ],
  unavailable: [
    'Everyone eligible was on leave or off shift',
    'Cover, or a rule that routes elsewhere when a department is empty.',
  ],
  'no-dept': ['Nobody belongs to that department', 'Add a member, or the stage cannot run at all.'],
  self: [
    'The only person free had already done the paired stage',
    'Self-review is blocked, so the work waited rather than being checked by its author.',
  ],
  coverage: [
    'Nobody covers that county or product',
    'Widen somebody’s level, or hire for the place the work keeps arriving from.',
  ],
}

/**
 * What a headline workload figure actually contains.
 *
 * Shared by the two workload tabs because the question — which stage tasks are
 * behind this number — is the same one whether you arrived at it per person or
 * per department. Only the grouping differs.
 */
export function WorkFocus({
  focus,
  mode,
  onBack,
}: {
  focus: string
  mode: 'dept' | 'staff'
  onBack: () => void
}) {
  const { run, work } = board()
  const navigate = useNavigate()
  const all = run.assigns.filter((a) => a.today).map((a) => ({ ...a, fin: isDone(a.o, a.stage) }))
  const exc = run.exc.filter((e) => e.today)

  if (focus === 'exc') {
    const causes: Record<string, typeof exc> = {}
    exc.forEach((e) => {
      ;(causes[e.why] = causes[e.why] ?? []).push(e)
    })
    return (
      <>
        <FocusHead
          title={`${exc.length} stage${exc.length === 1 ? '' : 's'} the engine could not place`}
          onBack={onBack}
        >
          These are not lost — they are waiting for a person to place them by hand. Grouped by why, because
          each cause has a different fix.
        </FocusHead>
        {Object.entries(causes)
          .sort((a, b) => b[1].length - a[1].length)
          .map(([why, list]) => {
            const c = CAUSE[why] ?? [why, '']
            return (
              <div key={why}>
                <SectionHead>
                  {c[0]} — {list.length}
                </SectionHead>
                <Banner kind="r" icon="◷" title="What would clear these">
                  {c[1]}
                </Banner>
                <FlexTable
                  cols="160px 140px 150px 1fr"
                  min={760}
                  head={['Order', 'Stage', 'Client', 'What happened']}
                >
                  {list.map((e, i) => (
                    <FlexRow cols="160px 140px 150px 1fr" key={`${e.o.id}-${e.stage}-${i}`}>
                      <Cell v={e.o.id} mono s={e.o.pr} />
                      <Cell v={e.stage} />
                      <Cell v={e.o.cl} />
                      <Cell v={e.t} />
                    </FlexRow>
                  ))}
                </FlexTable>
              </div>
            )
          })}
        <p className="gr" style={{ fontSize: '12.5px', marginTop: 10 }}>
          Every one of these arrived today and found no home. The Assignment screen shows the full decision
          trail for any of them.
        </p>
      </>
    )
  }

  if (focus === 'idle') {
    const roster = STAFF.filter((x) => x.dep.length)
    const busy = roster.filter((x) => (work[x.id]?.pend ?? 0) > 0)
    const idle = roster.filter((x) => !busy.includes(x))
    return (
      <>
        <FocusHead title={`${busy.length} of ${roster.length} have work in hand`} onBack={onBack}>
          {idle.length
            ? `${idle.length} finished everything assigned to them, or were never given any. Those are two different situations and the list separates them.`
            : 'Nobody is sitting without work.'}
        </FocusHead>

        <SectionHead>Nothing on their desk — {idle.length}</SectionHead>
        {idle.length ? (
          <FlexTable cols="200px 190px 130px 1fr" min={720} head={['Person', 'Departments', 'Today', 'Why']}>
            {idle.map((x) => {
              const wk = work[x.id] ?? { done: 0, tot: 0 }
              return (
                <FlexRow cols="200px 190px 130px 1fr" key={x.id}>
                  <Cell>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Avatar
                        name={x.n}
                        title={`Open ${x.n}`}
                        onClick={() => navigate({ to: '/staff/$personId', params: { personId: x.id } })}
                      />
                      <div className="v">{x.n}</div>
                    </div>
                  </Cell>
                  <Cell v={x.dep.join(', ')} tone="gr" />
                  <Cell v={wk.tot || 0} mono s={`${wk.done || 0} done`} />
                  {x.avail !== 'ok' ? (
                    <Cell v={`${AVAIL[x.avail][0]} — not eligible today`} tone="warn" />
                  ) : wk.tot ? (
                    <Cell v={`finished all ${wk.tot} of theirs`} tone="ok" />
                  ) : (
                    <Cell v="never given anything — capacity going unused" tone="bad" />
                  )}
                </FlexRow>
              )
            })}
          </FlexTable>
        ) : (
          <Card padded>
            <p className="gr" style={{ fontSize: '12.5px', margin: 0 }}>
              Everyone has something in hand.
            </p>
          </Card>
        )}

        <SectionHead>Working now — {busy.length}</SectionHead>
        <FlexTable cols="200px 190px 110px 1fr" min={680} head={['Person', 'Departments', 'In hand', 'Progress']}>
          {busy
            .slice()
            .sort((a, b) => work[b.id].pend - work[a.id].pend)
            .map((x) => {
              const wk = work[x.id]
              return (
                <FlexRow cols="200px 190px 110px 1fr" key={x.id}>
                  <Cell>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Avatar name={x.n} />
                      <div className="v">{x.n}</div>
                    </div>
                  </Cell>
                  <Cell v={x.dep.join(', ')} tone="gr" />
                  <Cell v={wk.pend} mono tone="warn" />
                  <Cell>
                    <div className="split" style={{ marginTop: 5 }}>
                      <span style={{ width: `${wk.pct}%`, background: 'var(--ok)' }} />
                      <span style={{ width: `${100 - wk.pct}%`, background: 'var(--warn)' }} />
                    </div>
                    <div className="s">
                      {wk.pct}% of {wk.tot} complete
                    </div>
                  </Cell>
                </FlexRow>
              )
            })}
        </FlexTable>
        <p className="gr" style={{ fontSize: '12.5px', marginTop: 10 }}>
          "Nobody idle" counts people holding unfinished work. Somebody who cleared their queue is not idle in
          any way worth worrying about — somebody who was never given any is.
        </p>
      </>
    )
  }

  const list = (focus === 'done' ? all.filter((a) => a.fin) : focus === 'pend' ? all.filter((a) => !a.fin) : all)
    .slice()
    .sort((a, b) => a.hr - b.hr)
  const groups = mode === 'dept' ? ASSIGN_STAGES : [...new Set(list.map((a) => a.who))]

  return (
    <>
      <FocusHead
        title={
          focus === 'done'
            ? `The ${list.length} stages finished today`
            : focus === 'pend'
              ? `The ${list.length} stages still open`
              : `All ${list.length} stage tasks today`
        }
        onBack={onBack}
      >
        One order passes through every department, so a single order appears once per stage. Grouped by{' '}
        {mode === 'dept' ? 'department' : 'person'}.
      </FocusHead>
      {groups.map((g) => {
        const mine = list.filter((a) => (mode === 'dept' ? a.stage === g : a.who === g))
        if (!mine.length) return null
        return (
          <div key={g}>
            <SectionHead>
              {mode === 'dept' ? g : whoName(g)} — {mine.length}
            </SectionHead>
            <FlexTable
              cols="105px 150px 140px 160px 1fr"
              min={800}
              head={['Arrived', 'Order', 'Client', mode === 'dept' ? 'Who has it' : 'Stage', 'Status']}
            >
              {mine.map((a, i) => (
                <FlexRow cols="105px 150px 140px 160px 1fr" key={`${a.o.id}-${a.stage}-${i}`}>
                  <Cell v={`${a.hr}:00`} mono />
                  <Cell v={a.o.id} mono s={a.o.pr} />
                  <Cell v={a.o.cl} />
                  <Cell v={mode === 'dept' ? whoName(a.who) : a.stage} />
                  <Cell>
                    {a.fin ? <Chip kind="v">Completed</Chip> : <Chip kind="r">On their desk</Chip>}
                  </Cell>
                </FlexRow>
              ))}
            </FlexTable>
          </div>
        )
      })}
      <p className="gr" style={{ fontSize: '12.5px', marginTop: 10 }}>
        Ordered by arrival time, because that is the order the engine placed them in.
      </p>
    </>
  )
}
