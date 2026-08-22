import { useMemo, useState, type ReactNode } from 'react'
import type { ChipKind } from '@/data/types'
import { Chip, Empty, Select } from './ui'

/**
 * The register: filter pills with counts, secondary selects, a search box, a
 * count line, and a compact grid table. Nearly every list screen in the design
 * is this component with different columns, so it carries the pattern's rules
 * rather than each screen re-implementing them.
 *
 * A row may belong to more than one filter — an invoice is both owing and
 * overdue — so `k` is a key or a list of them.
 */

export interface Col {
  l: string
  /** Minimum width in px. */
  w?: number
  /** Flex share. */
  f?: number
}

export interface Cell {
  v?: ReactNode
  mono?: boolean
  /** Sub-line under the value. */
  s?: ReactNode
  /** Render the sub-line in the bad colour. */
  bad?: boolean
  /** Render the value as a status chip of this variant. */
  chip?: ChipKind
  /** Arbitrary content, laid out by the caller. */
  raw?: ReactNode
}

export interface DataRow {
  id: string
  k?: string | string[]
  c: Cell[]
  onClick?: () => void
  /** Extra text the search box should match on, beyond the visible cells. */
  search?: string
}

export interface Pill {
  key: string
  label: string
  count?: number
  urgent?: boolean
}

export interface SelectFilter {
  label: string
  value: string
  options: [string, string][]
  onChange: (v: string) => void
}

export interface DataTableProps {
  cols: Col[]
  rows: DataRow[]
  pills?: Pill[]
  activePill?: string
  onPill?: (key: string) => void
  filters?: SelectFilter[]
  search?: string
  noun?: string
  /** Denominator for the count line when it is not simply `rows.length`. */
  total?: number
  min?: number
  emptyText?: string
  emptyAction?: ReactNode
}

const cellText = (c: Cell): string =>
  [c.v, c.s].filter((x) => typeof x === 'string' || typeof x === 'number').join(' ')

export function DataTable({
  cols,
  rows,
  pills,
  activePill,
  onPill,
  filters,
  search,
  noun = 'orders',
  total,
  min = 860,
  emptyText = 'No rows match this filter.',
  emptyAction,
}: DataTableProps) {
  const [innerPill, setInnerPill] = useState('all')
  const [query, setQuery] = useState('')

  const active = activePill ?? innerPill
  const setActive = onPill ?? setInnerPill

  const byPill = useMemo(
    () =>
      active === 'all'
        ? rows
        : rows.filter((r) => (Array.isArray(r.k) ? r.k.includes(active) : r.k === active)),
    [rows, active],
  )

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return byPill
    return byPill.filter((r) =>
      (r.c.map(cellText).join(' ') + ' ' + (r.search ?? '')).toLowerCase().includes(q),
    )
  }, [byPill, query])

  const den =
    active === 'all' ? (total ?? rows.length) : (pills?.find((p) => p.key === active)?.count ?? byPill.length)

  const tm = cols.map((x) => `minmax(${x.w ?? 100}px,${x.f ?? 1}fr)`).join(' ')
  const hasBar = !!(pills?.length || search || filters?.length)

  return (
    <>
      {hasBar ? (
        <>
          <div className="fbar">
            {(pills ?? []).map((p) => (
              <button
                key={p.key}
                type="button"
                className={`pill ${p.urgent ? 'urg' : ''} ${p.key === active ? 'on' : ''}`}
                aria-pressed={p.key === active}
                onClick={() => setActive(p.key)}
              >
                {p.label}
                {p.count != null ? <span className="n">{p.count}</span> : null}
              </button>
            ))}
            <div className="sp">
              {(filters ?? []).map((f) => (
                <Select
                  key={f.label}
                  label={f.label}
                  value={f.value}
                  options={f.options}
                  onChange={f.onChange}
                />
              ))}
              {search ? (
                <input
                  className="inp"
                  placeholder={search}
                  aria-label={search}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              ) : null}
            </div>
          </div>
          <p className="cnt">
            <span>ⓘ</span> Showing <b>{visible.length}</b> of <b>{den}</b> {noun}
          </p>
        </>
      ) : null}

      <div className="tbl">
        <div className="tsc">
          <div style={{ minWidth: min }}>
            <div className="trow h" style={{ gridTemplateColumns: tm }}>
              {cols.map((c) => (
                <span key={c.l}>{c.l}</span>
              ))}
            </div>
            <div className="tb">
              {visible.length ? (
                visible.map((r) => (
                  <div
                    key={r.id}
                    className="trow"
                    style={{ gridTemplateColumns: tm }}
                    {...(r.onClick
                      ? {
                          role: 'button',
                          tabIndex: 0,
                          onClick: r.onClick,
                          onKeyDown: (e: React.KeyboardEvent) => {
                            if (e.key === 'Enter') {
                              e.preventDefault()
                              r.onClick?.()
                            }
                          },
                        }
                      : {})}
                  >
                    {r.c.map((x, i) => (
                      <div className="cell" key={i}>
                        {x.raw ? (
                          x.raw
                        ) : x.chip ? (
                          <Chip kind={x.chip}>{x.v}</Chip>
                        ) : (
                          <div className={`v${x.mono ? ' mono' : ''}`}>{x.v}</div>
                        )}
                        {x.s ? <div className={`s${x.bad ? ' bad' : ''}`}>{x.s}</div> : null}
                      </div>
                    ))}
                  </div>
                ))
              ) : (
                <Empty action={emptyAction}>{emptyText}</Empty>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
