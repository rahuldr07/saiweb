import { Btn, Card, Rows } from '@/components/ui'
import { absencePattern } from '@/lib/attendance'
import type { Person } from '@/data/types'

export function PatternsTab({
  list,
  openPerson,
}: {
  list: Person[]
  openPerson: (id: string) => void
}) {
  const flagged = list.map((p) => ({ p, a: absencePattern(p.id) })).filter((x) => x.a.flags.length)

  if (!flagged.length) {
    return (
      <Card padded>
        <p className="gr" style={{ fontSize: 'var(--t-body)', margin: 0 }}>
          No patterns worth raising. Absence is spread the way you would expect it to be.
        </p>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <Rows bare>
          {flagged.map(({ p, a }) => (
            <div className="rw" key={p.id}>
              <span className="warn" style={{ fontSize: 'var(--t-lead)' }}>
                ◷
              </span>
              <span>
                <b>{p.n}</b>{' '}
                <span className="gr">
                  · {a.total} days taken, {a.lop} unpaid
                </span>
                {a.flags.map(([head, why]) => (
                  <div className="sd" key={head} style={{ marginTop: 4 }}>
                    <b>{head}</b> — {why}
                  </div>
                ))}
              </span>
              <span>
                <Btn variant="ghost" small onClick={() => openPerson(p.id)}>
                  Their record
                </Btn>
              </span>
            </div>
          ))}
        </Rows>
      </Card>
      <p className="gr" style={{ fontSize: 'var(--t-small)', marginTop: 10 }}>
        Patterns, not totals. Somebody who took three weeks in one go does not appear here; somebody
        who takes every third Monday does. The second is the one a manager can actually help with.
      </p>
    </>
  )
}
