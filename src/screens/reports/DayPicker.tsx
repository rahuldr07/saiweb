import { board } from '@/lib/engine'
import { fmtDate } from '@/lib/format'
import { now } from '@/lib/clock'

const DAY_LABEL = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/** Today reads as "Today"; the rest read as the weekday they were. */
export function DayPicker({ value, onChange }: { value: string; onChange: (dk: string) => void }) {
  const { run } = board()
  const today = fmtDate(now())

  return (
    <div className="fbar" role="group" aria-label="Choose a day">
      {run.days.map((d) => (
        <button
          key={d.dk}
          className={`pill ${value === d.dk ? 'on' : ''}`}
          aria-pressed={value === d.dk}
          onClick={() => onChange(d.dk)}
        >
          {d.dk === today ? 'Today' : DAY_LABEL[d.date.getDay()]}{' '}
          <span className="mono gr" style={{ fontSize: '10.5px' }}>
            {d.dk}
          </span>
          <span className="n">{d.n}</span>
        </button>
      ))}
      <button
        className={`pill ${value === 'all' ? 'on' : ''}`}
        aria-pressed={value === 'all'}
        onClick={() => onChange('all')}
      >
        All {run.days.length} days<span className="n">{run.orders.length}</span>
      </button>
    </div>
  )
}
