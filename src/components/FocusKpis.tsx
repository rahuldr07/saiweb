import type { ReactNode } from 'react'
import { Btn, Kpi, Kpis } from './ui'

/**
 * A row of KPI tiles where each one opens the detail behind it.
 *
 * The tile is the control: pressing it focuses the report on that figure, and
 * pressing it again goes back. A tile whose count is zero is not made pressable,
 * because opening an empty list teaches nothing — but it still renders, so the
 * zero itself is visible rather than the row silently changing shape.
 */

export interface FocusCard {
  key: string
  title: string
  value: ReactNode
  detail: ReactNode
  /** Governs whether the tile is pressable — a zero is shown, not hidden. */
  count?: number
  tone?: 'alert' | 'warn'
}

export function FocusKpis({
  cards,
  focus,
  onFocus,
}: {
  cards: FocusCard[]
  focus: string
  onFocus: (key: string) => void
}) {
  return (
    <Kpis>
      {cards.map((c) => {
        const on = focus === c.key
        const live = c.count === undefined || c.count > 0
        return (
          <Kpi
            key={c.key}
            title={c.title}
            value={c.value}
            tone={c.tone}
            selected={on}
            onClick={live ? () => onFocus(on ? 'all' : c.key) : undefined}
            detail={
              <>
                {c.detail}
                {live ? (
                  <span className={on ? 'brand' : 'gr'} style={{ fontSize: '10.5px' }}>
                    {' '}
                    · {on ? 'showing these' : 'click to see'}
                  </span>
                ) : null}
              </>
            }
          />
        )
      })}
    </Kpis>
  )
}

/** The banner that names what you drilled into, with the way back. */
export function FocusHead({
  title,
  children,
  onBack,
}: {
  title: ReactNode
  children?: ReactNode
  onBack: () => void
}) {
  return (
    <div className="bnr b" style={{ marginTop: 14 }}>
      <span className="bi">▤</span>
      <div>
        <div className="bt">{title}</div>
        {children ? <div className="bs">{children}</div> : null}
      </div>
      <div className="ba">
        <Btn variant="ghost" small onClick={onBack}>
          Back to the report
        </Btn>
      </div>
    </div>
  )
}
