import { QC_DAYS } from '@/data/quality'
import { fmtDate } from '@/lib/format'
import {
  QC_PRESETS,
  iso,
  rangeFloor,
  resolveRange,
  setPreset,
  setRangeEnd,
  type RangeState,
} from '@/lib/range'
import { now } from '@/lib/clock'

/**
 * The date range control, and the sentence underneath saying what it resolved
 * to. The sentence matters as much as the control: "last 30 days" is a label,
 * and the two actual dates are what somebody needs to quote a figure.
 */
export function RangeBar({
  id,
  value,
  onChange,
  note,
}: {
  id: string
  value: RangeState
  onChange: (next: RangeState) => void
  note?: string
}) {
  const r = resolveRange(value)
  const lo = iso(rangeFloor())
  const hi = iso(now())

  return (
    <>
      <div className="fbar" role="group" aria-label="Date range">
        {QC_PRESETS.map(([key, label]) => (
          <button
            key={key}
            className={`pill ${r.preset === key ? 'on' : ''}`}
            aria-pressed={r.preset === key}
            onClick={() => onChange(setPreset(value, key))}
          >
            {label}
          </button>
        ))}
        <button
          className={`pill ${r.preset === 'custom' ? 'on' : ''}`}
          aria-pressed={r.preset === 'custom'}
          onClick={() => onChange(setPreset(value, 'custom'))}
        >
          Custom
        </button>
        <div className="sp" style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <label htmlFor={`${id}f`} className="gr" style={{ fontSize: '11.5px' }}>
            From
          </label>
          <input
            id={`${id}f`}
            className="inp mono"
            type="date"
            style={{ width: 150 }}
            value={iso(r.from)}
            min={lo}
            max={hi}
            onChange={(e) => onChange(setRangeEnd(value, 'from', e.target.value))}
          />
          <label htmlFor={`${id}t`} className="gr" style={{ fontSize: '11.5px' }}>
            to
          </label>
          <input
            id={`${id}t`}
            className="inp mono"
            type="date"
            style={{ width: 150 }}
            value={iso(r.to)}
            min={lo}
            max={hi}
            onChange={(e) => onChange(setRangeEnd(value, 'to', e.target.value))}
          />
        </div>
      </div>
      <p className="cnt">
        <span>ⓘ</span> Showing <b>{fmtDate(r.from)}</b> to <b>{fmtDate(r.to)}</b> —{' '}
        {note ?? 'every figure below follows this range'}. History goes back {QC_DAYS} days.
      </p>
    </>
  )
}
