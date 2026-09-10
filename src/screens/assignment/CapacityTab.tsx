import { useGo } from '@/lib/nav'
import { BarRow, Btn, Card, Chip, Label } from '@/components/ui'
import { AVAIL, STAFF } from '@/data/people'
import { CAPACITY_AMBER, CAPACITY_RED, capacityTone } from '@/lib/metrics'
import type { AssignmentBoard } from '@/lib/engine'

/**
 * How much room is left, and when it ran out.
 *
 * The day chart is the one that matters: capacity is not a number, it is a curve,
 * and the hour it crosses 90% is the hour the next arrival starts becoming an
 * exception. The per-person bars then say who that will be.
 */

export function CapacityTab({ board }: { board: AssignmentBoard }) {
  const navigate = useGo()
  const { run } = board
  const load = run.load
  const plan = run.assigns.filter((a) => a.today)

  const rostered = STAFF.filter((s) => s.dep.length)
  const available = rostered.filter((s) => s.avail === 'ok')
  const totalCap = available.reduce((a, s) => a + s.cap, 0)

  /* People who have nothing left to give while orders are still arriving. */
  const atTarget = available.filter((s) => (load[s.id] ?? 0) >= s.cap)
  const stagesAffected = [...new Set(atTarget.flatMap((s) => s.dep))]

  return (
    <>
      {atTarget.length ? (
        <div className="bnr r">
          <span className="bi">◷</span>
          <div>
            <div className="bt">
              {atTarget.length} {atTarget.length === 1 ? 'person is' : 'people are'} at their target
              with orders still arriving
            </div>
            {atTarget.map((s) => s.n).join(', ')}. Anything else needing{' '}
            {stagesAffected.join(' or ')} today becomes an exception.
            <div className="bs">
              Raising a target or bringing someone in clears it prospectively — it does not re-place
              what already failed.
            </div>
          </div>
        </div>
      ) : null}

      <Card padded>
        <Label>Load through the day</Label>
        <div
          style={{ display: 'flex', gap: 5, alignItems: 'flex-end', height: 150, marginTop: 6 }}
        >
          {run.hourly.map((h) => {
            const used = Object.values(h.load).reduce((a, b) => a + b, 0)
            const pct = totalCap ? Math.round((used / totalCap) * 100) : 0
            return (
              <div
                key={h.hr}
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'flex-end',
                  height: '100%',
                  gap: 4,
                }}
                title={`${h.hr}:00 — ${pct}% of total capacity used`}
              >
                <span className="mono gr" style={{ fontSize: '10.5px', textAlign: 'center' }}>
                  {pct}%
                </span>
                <span
                  style={{
                    background: capacityTone(pct).fill,
                    borderRadius: '5px 5px 0 0',
                    height: `${Math.min(100, pct)}%`,
                  }}
                />
                <span className="mono gr" style={{ fontSize: '9.5px', textAlign: 'center' }}>
                  {h.hr}
                </span>
              </div>
            )
          })}
        </div>
        <p className="gr" style={{ fontSize: '12.5px', marginTop: 12 }}>
          Total capacity consumed as the day fills. Green under {CAPACITY_AMBER}%, amber to{' '}
          {CAPACITY_RED}%, red above —
          the point at which the next arrival is likely to become an exception.
        </p>
      </Card>

      <Card padded style={{ marginTop: 18 }}>
        <Label>Per person — target against today’s load</Label>
        {rostered.map((s) => {
          const added = plan.filter((p) => p.who === s.id).length
          const total = load[s.id] ?? 0
          const before = total - added
          const at = total >= s.cap
          const carried = total ? Math.round((before / total) * 100) : 0
          return (
            <BarRow
              key={s.id}
              cols="150px 1fr 120px"
              padding="7px 0"
              labelClass=""
              label={
                <>
                  {s.n}
                  {s.avail !== 'ok' ? (
                    <>
                      {' '}
                      <span
                        className={`chip ${AVAIL[s.avail][1]}`}
                        style={{ fontSize: '10.5px', padding: '1px 7px' }}
                      >
                        {AVAIL[s.avail][0]}
                      </span>
                    </>
                  ) : null}
                </>
              }
              value={total}
              max={s.cap}
              color={
                at
                  ? 'var(--bad)'
                  : added
                    ? `linear-gradient(90deg, var(--brand2) ${carried}%, var(--ok) ${carried}%)`
                    : 'var(--brand2)'
              }
              title={`${before} already open, ${added} added, target ${s.cap}`}
              rightClass={`mono ${at ? 'bad' : 'gr'}`}
              rightStyle={{ fontSize: '11.5px' }}
              right={
                <>
                  {total} / {s.cap}
                  {added ? <span className="ok"> +{added}</span> : null}
                </>
              }
            />
          )
        })}
        <p className="gr" style={{ fontSize: '11.5px', marginTop: 10 }}>
          Purple is what they already had, green is what this batch added. Red means at target.
        </p>
      </Card>

      <Card style={{ marginTop: 18 }}>
        <div className="ch">
          <h2>Availability today</h2>
          <div className="r">
            <Btn
              variant="ghost"
              small
              onClick={() => navigate({ to: '/company', search: { tab: 'Staff' } })}
            >
              Edit staff
            </Btn>
          </div>
        </div>
        <div className="tsc">
          <table className="mat">
            <thead>
              <tr>
                <th>Staff</th>
                <th>Departments</th>
                <th style={{ textAlign: 'right' }}>Target</th>
                <th style={{ textAlign: 'right' }}>Load</th>
                <th style={{ textAlign: 'right' }}>Room</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rostered.map((s) => {
                const total = load[s.id] ?? 0
                return (
                  <tr key={s.id}>
                    <td>
                      <b>{s.n}</b>
                    </td>
                    <td className="gr">{s.dep.join(', ')}</td>
                    <td className="n">{s.cap}</td>
                    <td className="n">{total}</td>
                    <td className={`n ${total >= s.cap ? 'bad' : ''}`}>
                      {Math.max(0, s.cap - total)}
                    </td>
                    <td>
                      <Chip kind={AVAIL[s.avail][1]}>{AVAIL[s.avail][0]}</Chip>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  )
}
