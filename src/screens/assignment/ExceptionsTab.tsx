import { useState } from 'react'
import { useGo } from '@/lib/nav'
import { Btn, Card, Chip, Empty } from '@/components/ui'
import { useUi } from '@/state/ui'
import { AVAIL, STAFF } from '@/data/people'
import { ASSIGN_STAGES, PAIRS } from '@/data/org'
import { COVSTAGES } from '@/lib/qualification'
import { whoName } from '@/lib/permissions'
import { covOK } from '@/lib/ruleText'
import { EXCLUSION, type AssignmentBoard, type Exception, type ExclusionReason } from '@/lib/engine'

const REMEDY: Record<ExclusionReason, string> = {
  capacity: 'Raising a target or adding someone to the department clears all of these.',
  self: 'The person free for the QC is the one who did the work. Assign someone else or accept the pairing knowingly.',
  unavailable: 'Everyone in that department is on leave or off shift today.',
  coverage:
    'This is not a roster problem — the people are there, they are simply not qualified for that state, county or product. Widening somebody’s coverage clears the whole group.',
  'no-dept': 'Nobody is a member of that department at all.',
}

const SHOWN_PER_CAUSE = 5

const COLS = '40px 150px 120px 130px 1fr'

const key = (e: Exception) => `${e.o.id}|${e.stage}`

export function ExceptionsTab({
  board,
  onTab,
}: {
  board: AssignmentBoard
  onTab: (t: 'Rules') => void
}) {
  const navigate = useGo()
  const { toast, openModal, closeModal } = useUi()
  const [placed, setPlaced] = useState<Record<string, string>>({})

  const { run } = board
  const exc = run.exc.filter((e) => e.today)
  const orders = run.today
  const total = orders.length * ASSIGN_STAGES.length

  const byWhy = exc.reduce<Record<string, Exception[]>>((acc, e) => {
    ;(acc[e.why] = acc[e.why] ?? []).push(e)
    return acc
  }, {})

  const deptOut = run.deptOut

  const assign = (e: Exception, id: string) => {
    if (!id) return
    const paired = PAIRS[e.stage]
    const author = paired ? e.o.plan?.[paired] : undefined
    if (author && author === id) {
      openModal({
        title: 'That would be self-review',
        body: (
          <>
            <p style={{ fontSize: 'var(--t-body)' }}>
              <b>{whoName(id)}</b> did the {paired} on this order. Checking their own work is the one
              thing the QC score cannot survive.
            </p>
            <p className="gr" style={{ fontSize: 'var(--t-small)' }}>
              Pick someone else, or turn the rule off under Rules if that is genuinely how you work.
            </p>
          </>
        ),
        footer: <Btn onClick={closeModal}>Pick someone else</Btn>,
      })
      return
    }
    setPlaced((p) => ({ ...p, [key(e)]: id }))
    toast(`${e.stage} → ${whoName(id)}`)
  }

  return (
    <>
      <div className={`bnr ${exc.length ? 'r' : 'v'}`}>
        <span className="bi">{exc.length ? '⚑' : '✓'}</span>
        <div>
          <div className="bt">
            {exc.length} stage{exc.length === 1 ? '' : 's'} could not be placed
          </div>
          Out of {total} across {orders.length} orders. Everything else went out automatically as it
          arrived — these are the only ones waiting on a person.
          <div className="bs">
            Doc Req is not assigned here — it is an exception branch, given out only when an order
            enters it.
          </div>
        </div>
        <div className="ba">
          <Btn variant="ghost" onClick={() => onTab('Rules')}>
            Change the rules
          </Btn>
        </div>
      </div>

      {deptOut.length ? (
        <div className="bnr d">
          <span className="bi">⚠</span>
          <div>
            <div className="bt">{deptOut.join(' and ')} has nobody available today</div>
            {deptOut.map((d) => {
              const members = STAFF.filter((s) => s.dep.includes(d))
              const allOnLeave = members.every((s) => s.avail === 'leave')
              return (
                <span key={d}>
                  {d} is staffed by {members.map((s) => s.n).join(', ')} —{' '}
                  {members.length === 1 ? 'one person, and they are' : 'all of whom are'}{' '}
                  {allOnLeave ? 'on leave' : 'unavailable'}.{' '}
                </span>
              )
            })}
            Any order that needs it today has nowhere to go.
            <div className="bs">This is why a department with one member is worth watching.</div>
          </div>
          <div className="ba">
            <Btn
              variant="ghost"
              small
              onClick={() => navigate({ to: '/company', search: { tab: 'Departments' } })}
            >
              See departments
            </Btn>
          </div>
        </div>
      ) : null}

      <h2 className="sec">Grouped by why — fixing the cause clears the whole group</h2>

      {Object.entries(byWhy)
        .map(([why, list]) => {
          const [label, tone] = EXCLUSION[why as ExclusionReason]
          return (
            <Card key={why} style={{ marginBottom: 13 }}>
              <div className="ch">
                <h2>{label}</h2>
                <div className="r">
                  <Chip kind={tone === 'bad' ? 'd' : 'r'}>
                    {list.length} stage{list.length === 1 ? '' : 's'}
                  </Chip>
                </div>
              </div>
              <div className="cb" style={{ paddingBottom: 0 }}>
                <p className="gr" style={{ fontSize: 'var(--t-small)', marginBottom: 13 }}>
                  {list[0].t}. {REMEDY[why as ExclusionReason]}
                </p>
              </div>
              <div className="tsc">
                <div style={{ minWidth: 700 }}>
                  <div className="trow h" style={{ gridTemplateColumns: COLS }}>
                    <span>#</span>
                    <span>Order</span>
                    <span>Stage</span>
                    <span>Product</span>
                    <span>What you can do</span>
                  </div>
                  <div className="tb">
                    {list.slice(0, SHOWN_PER_CAUSE).map((e, ei) => {
                      const chosen = placed[key(e)]
                      const options = STAFF.filter(
                        (s) => s.dep.includes(e.stage) && s.active !== false,
                      ).sort((a, b) => Number(covOK(b.id, e)) - Number(covOK(a.id, e)))
                      return (
                        <div key={key(e)} className="trow" style={{ gridTemplateColumns: COLS }}>
                          <div className="cell">
                            <div className="gr mono" style={{ fontSize: 'var(--t-label)' }}>
                              {ei + 1}
                            </div>
                          </div>
                          <div className="cell">
                            <div className="v mono">{e.o.id}</div>
                            <div className="s">
                              {e.o.cl} · {e.o.co ? `${e.o.co}, ${e.o.st}` : e.o.st}
                            </div>
                          </div>
                          <div className="cell">
                            <div className="v">{e.stage}</div>
                          </div>
                          <div className="cell">
                            <div className="v">{e.o.pr}</div>
                          </div>
                          <div
                            className="cell"
                            style={{
                              display: 'flex',
                              gap: 7,
                              flexWrap: 'wrap',
                              alignItems: 'flex-start',
                            }}
                          >
                            <div style={{ minWidth: 150 }}>
                              <select
                                className="inp"
                                style={{ width: '100%' }}
                                aria-label={`Assign ${e.o.id} ${e.stage} manually`}
                                value={chosen ?? ''}
                                onChange={(ev) => assign(e, ev.target.value)}
                              >
                                <option value="">— assign anyway —</option>
                                {options.map((s) => (
                                  <option key={s.id} value={s.id}>
                                    {s.n}
                                    {COVSTAGES.includes(e.stage) && !covOK(s.id, e)
                                      ? ' — outside their coverage'
                                      : ''}
                                    {s.avail !== 'ok' ? ` (${AVAIL[s.avail][0].toLowerCase()})` : ''}
                                    {(run.load[s.id] ?? 0) >= s.cap ? ' — over target' : ''}
                                  </option>
                                ))}
                              </select>
                              {e.why === 'coverage' && e.near?.length ? (
                                <div className="s gr" style={{ marginTop: 5 }}>
                                  Closest: {e.near.slice(0, 2).map(whoName).join(', ')} — {e.o.st} but
                                  not {e.o.co}
                                </div>
                              ) : null}
                              {chosen ? (
                                <div className="s ok" style={{ marginTop: 5 }}>
                                  Placed by hand with {whoName(chosen)} — not written back to the run.
                                </div>
                              ) : null}
                            </div>
                            <Btn
                              variant="ghost"
                              small
                              onClick={() => toast('Held for tomorrow’s batch')}
                            >
                              Defer
                            </Btn>
                          </div>
                        </div>
                      )
                    })}
                    {list.length > SHOWN_PER_CAUSE ? (
                      <div className="trow" style={{ gridTemplateColumns: '1fr' }}>
                        <div className="cell gr" style={{ fontSize: 'var(--t-small)', padding: '4px 0' }}>
                          + {list.length - SHOWN_PER_CAUSE} more of the same kind — fixing the cause
                          above clears them together.
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </Card>
          )
        })}

      {exc.length ? null : (
        <Card>
          <Empty icon="✓">No exceptions. Every stage found an owner inside the rules.</Empty>
        </Card>
      )}
    </>
  )
}
