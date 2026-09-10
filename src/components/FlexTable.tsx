import type { ReactNode } from 'react'

export function FlexTable({
  cols,
  min,
  head,
  children,
  id,
}: {
  cols: string
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
  tone?: 'ok' | 'warn' | 'bad' | 'gr' | undefined
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
