import { Card } from '@/components/ui'
import { useTimeclock } from '@/state/timeclock'
import { HOLIDAYS } from '@/data/people'
import { shiftOf } from '@/lib/workingDay'
import { fmtDate, pad } from '@/lib/format'
import type { Person } from '@/data/types'
import { onLeaveOn } from '../onLeave'

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function RosterTab({ list, today }: { list: Person[]; today: Date }) {
  const clock = useTimeclock()

  const days = [...Array(7)].map(
    (_, i) => new Date(today.getFullYear(), today.getMonth(), today.getDate() + i),
  )
  const holidayOn = (d: Date) => HOLIDAYS.find((h) => h.d === fmtDate(d))
  const swapOn = (p: Person, d: Date) =>
    clock.swaps.find((x) => x.st === 'approved' && x.d === fmtDate(d) && (x.from === p.id || x.to === p.id))

  return (
    <>
      <Card>
        <div className="tsc">
          <table className="mat" style={{ minWidth: 220 + 7 * 104 }}>
            <thead>
              <tr>
                <th style={{ minWidth: 190 }}>Who</th>
                {days.map((d) => {
                  const h = holidayOn(d)
                  return (
                    <th key={d.toDateString()} style={{ textAlign: 'center', minWidth: 96 }}>
                      {DAY_NAMES[d.getDay()]}
                      <div className="gr" style={{ fontWeight: 400, fontSize: '11.5px' }}>
                        {pad(d.getDate())}/{pad(d.getMonth() + 1)}
                      </div>
                      {h ? (
                        <div className="chip n" style={{ fontSize: '10.5px', marginTop: 3 }}>
                          {h.n.split(' ')[0]}
                        </div>
                      ) : null}
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {list.map((p) => {
                const sh = shiftOf(p)
                return (
                  <tr key={p.id}>
                    <td>
                      <b>{p.n}</b>
                      <div className="gr" style={{ fontSize: '11.5px' }}>
                        {sh.n} · {sh.from}–{sh.to}
                      </div>
                    </td>
                    {days.map((d) => {
                      const h = holidayOn(d)
                      const off = onLeaveOn(p.id, d)
                      const sw = swapOn(p, d)
                      const rest = d.getDay() === 0
                      return (
                        <td key={d.toDateString()} style={{ textAlign: 'center' }}>
                          {h && !h.opt ? (
                            <span className="chip n" style={{ fontSize: '10.5px' }}>
                              Holiday
                            </span>
                          ) : off ? (
                            <span className="chip r" style={{ fontSize: '10.5px' }}>
                              Leave
                            </span>
                          ) : rest ? (
                            <span className="gr" style={{ fontSize: '11.5px' }}>
                              rest
                            </span>
                          ) : sw ? (
                            <span className="chip b" style={{ fontSize: '10.5px' }}>
                              Swap
                            </span>
                          ) : (
                            <span className="mono gr" style={{ fontSize: '11.5px' }}>
                              {sh.from}
                            </span>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>
      <p className="gr" style={{ fontSize: '12.5px', marginTop: 10 }}>
        Seven days ahead, with holidays, approved leave and agreed swaps already in it. This is the
        view a person checks before asking for a day — and the one a lead checks before approving one.
      </p>
    </>
  )
}
