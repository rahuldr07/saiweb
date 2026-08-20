import type { ReactNode } from 'react'

/**
 * The design's grid-based register: a header row and body rows sharing one
 * `grid-template-columns`, inside a card that scrolls sideways on its own so a
 * wide table never takes the page with it.
 *
 * Separate from `DataTable`, which owns filtering, pills and search. This is the
 * plain version for report sections, where the tab above already did the
 * filtering and the table's only job is to lay the answer out.
 */

export function FlexTable({
  cols,
  min,
  head,
  children,
  id,
}: {
  /** A grid-template-columns value, e.g. '110px 150px 1fr'. */
  cols: string
  /** Below this width the card scrolls rather than the columns collapsing. */
  min: number
  head: string[]
  children: ReactNode
  id?: string
}) {
  return (
    <div className="card" id={id}>
      <div className="tsc">
        <div style={{ minWidth: min }}>
          <div className="trow h" style={{ gridTemplateColumns: cols }}>
            {head.map((h) => (
              <span key={h}>{h}</span>
            ))}
          </div>
          <div className="tb">{children}</div>
        </div>
      </div>
    </div>
  )
}

export function FlexRow({
  cols,
  children,
  onClick,
}: {
  cols: string
  children: ReactNode
  onClick?: () => void
}) {
  return (
    <div
      className="trow"
      style={{ gridTemplateColumns: cols, cursor: onClick ? 'pointer' : undefined }}
      {...(onClick
        ? {
            role: 'button',
            tabIndex: 0,
            onClick,
            onKeyDown: (e: React.KeyboardEvent) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onClick()
              }
            },
          }
        : {})}
    >
      {children}
    </div>
  )
}

/** One cell: a value, and optionally the smaller line under it. */
export function Cell({
  v,
  s,
  mono,
  tone,
  children,
}: {
  v?: ReactNode
  s?: ReactNode
  mono?: boolean
  tone?: 'ok' | 'warn' | 'bad' | 'gr'
  children?: ReactNode
}) {
  return (
    <div className="cell">
      {children ?? (
        <>
          <div
            className={`v${mono ? ' mono' : ''}${tone ? ' ' + tone : ''}`}
            style={{ fontSize: '12.5px' }}
          >
            {v}
          </div>
          {s ? <div className="s">{s}</div> : null}
        </>
      )}
    </div>
  )
}
