import { Component, useEffect, type ErrorInfo, type ReactNode } from 'react'
import { Btn, Card, Empty } from './ui'

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

export function SkeletonValue({ width = 72 }: { width?: number }) {
  return <Skeleton width={width} height={26} radius={5} style={{ verticalAlign: '-4px' }} />
}

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

export function LoadFailed({
  what,
  error,
  onRetry,
}: {
  what: string
  error?: unknown
  onRetry?: (() => void) | undefined
}) {
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

export function RouteError({ error, reset }: { error: unknown; reset?: () => void }) {
  useEffect(() => {
    console.error('Route error:', error)
  }, [error])
  return <LoadFailed what="This screen" error={error} onRetry={reset} />
}

interface BoundaryProps {
  children: ReactNode
  what?: string
}

interface BoundaryState {
  error: Error | null
}

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
