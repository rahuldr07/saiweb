import { Component, useEffect, type ErrorInfo, type ReactNode } from 'react'
import { Btn, Card, Empty } from './ui'

/**
 * What a screen shows while its data is in flight, and when it never arrives.
 *
 * Two rules, both about not moving things under the reader:
 *
 *  - A skeleton occupies the space its content will occupy. A spinner that
 *    collapses to nothing hands the reader a layout shift at the exact moment
 *    they have started reading.
 *  - A failure says what failed and offers the way out. A blank panel is
 *    indistinguishable from "there is nothing here", which is a different fact.
 */

/* ── skeletons ──────────────────────────────────────────────────────────── */

export function Skeleton({
  width = '100%',
  height = 14,
  radius = 4,
  style,
}: {
  width?: number | string
  height?: number | string
  radius?: number
  style?: React.CSSProperties
}) {
  return (
    <span
      className="skel"
      aria-hidden="true"
      style={{ width, height, borderRadius: radius, ...style }}
    />
  )
}

/** Stands in for a KPI tile's value, at the size the figure will be. */
export function SkeletonValue({ width = 72 }: { width?: number }) {
  return <Skeleton width={width} height={26} radius={5} style={{ verticalAlign: '-4px' }} />
}

/** Stands in for a run of table rows, at the row height the table uses. */
export function SkeletonRows({ rows = 6, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="skel-rows" role="status" aria-live="polite" aria-label="Loading">
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className="skel-row">
          {Array.from({ length: cols }, (_, c) => (
            <Skeleton key={c} width={c === 0 ? '60%' : '40%'} />
          ))}
        </div>
      ))}
    </div>
  )
}

/* ── failure ────────────────────────────────────────────────────────────── */

export function LoadFailed({
  what,
  error,
  onRetry,
}: {
  what: string
  error?: unknown
  onRetry?: (() => void) | undefined
}) {
  /* The message is a developer's sentence — "Cannot read properties of undefined"
     — and in front of somebody trying to get through their day it is noise at
     best. It stays inline in development, where it saves a round trip, and goes
     to the console in a build, where the person who needs it can still find it
     and the person who does not is spared it. `what` already names the failure,
     which is the part a reader can act on. */
  const detail = import.meta.env.DEV && error instanceof Error ? error.message : null
  return (
    <Card>
      <Empty
        icon="⚠"
        action={
          onRetry ? (
            <Btn small onClick={onRetry}>
              Try again
            </Btn>
          ) : undefined
        }
      >
        {what} could not be loaded{detail ? ` — ${detail}` : '.'}
      </Empty>
    </Card>
  )
}

/**
 * What the router shows when a screen throws and nothing below caught it.
 *
 * Without one of these TanStack renders its own default, which puts the error
 * message and a button that prints the stack in front of whoever was using the
 * screen. This names what failed, offers the way back, and leaves the detail
 * where it belongs.
 */
export function RouteError({ error, reset }: { error: unknown; reset?: () => void }) {
  useEffect(() => {
    console.error('Route error:', error)
  }, [error])
  return <LoadFailed what="This screen" error={error} onRetry={reset} />
}

/* ── error boundary ─────────────────────────────────────────────────────── */

interface BoundaryProps {
  children: ReactNode
  /** What the reader was looking at, so the message can name it. */
  what?: string
}

interface BoundaryState {
  error: Error | null
}

/**
 * Catches a render-time throw so one broken panel does not blank the whole
 * application. Router-level errors are the router's job; this is for the case
 * where a screen's own render hits something it cannot cope with.
 */
export class ErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): BoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Screen error:', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <LoadFailed
          what={this.props.what ?? 'This screen'}
          error={this.state.error}
          onRetry={() => this.setState({ error: null })}
        />
      )
    }
    return this.props.children
  }
}
