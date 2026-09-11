import { board } from '@/lib/engine'
import { fmtDate } from '@/lib/format'
import { now } from '@/lib/clock'

const DAY_LABEL = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function DayPicker({ value, onChange }: { value: string; onChange: (dk: string) => void }) {
  const { run } = board()
  const today = fmtDate(now())

  return (
    <div className="fbar">
      <select
        className="inp"
        aria-label="Choose a day"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {run.days.map((d) => (
          <option key={d.dk} value={d.dk}>
            {d.dk === today ? 'Today' : DAY_LABEL[d.date.getDay()]} · {d.dk} — {d.n}
          </option>
        ))}
        <option value="all">
          All {run.days.length} days — {run.orders.length}
        </option>
      </select>
    </div>
  )
}
