import { useState, type ReactNode } from 'react'
import { useGo } from '@/lib/nav'
import { Avatar, Chip, Empty } from '@/components/ui'
import { whoName } from '@/lib/permissions'
import type { Arrival } from '@/lib/engine'

export interface WorkItem {
  o: Arrival
  fin: boolean
  hr: number
  who?: string
  stage?: string
}

export const WORKCOLS = {
  who: '40px 150px 170px 100px 90px 120px 1fr',
  stage: '40px 150px 140px 100px 90px 130px 1fr',
} as const

export function WorkRow({
  item,
  mode,
  index,
  onOpen,
}: {
  item: WorkItem
  mode: keyof typeof WORKCOLS
  index: number
  onOpen: (orderId: string) => void
}) {
  const navigate = useGo()
  const owner = whoName(item.who ?? '')

  return (
    <div
      className="trow"
      role="button"
      tabIndex={0}
      style={{ gridTemplateColumns: WORKCOLS[mode] }}
      onClick={() => onOpen(item.o.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onOpen(item.o.id)
        }
      }}
    >
      <div className="cell">
        <div className="gr mono" style={{ fontSize: 'var(--t-label)' }}>
          {index + 1}
        </div>
      </div>
      <div className="cell">
        <div className="v mono">{item.o.id}</div>
        <div className="s">{item.o.cl}</div>
      </div>
      <div className="cell">
        {mode === 'who' ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <Avatar
              name={owner}
              title={`Open ${owner}`}
              style={{ width: 21, height: 21, fontSize: 'var(--t-micro)' }}
              onClick={() =>
                item.who && navigate({ to: '/staff/$personId', params: { personId: item.who } })
              }
            />
            <div className="v" style={{ fontSize: 'var(--t-small)' }}>
              {owner}
            </div>
          </div>
        ) : (
          <div className="v">{item.stage}</div>
        )}
      </div>
      <div className="cell">
        <div className="v">{item.o.pr}</div>
      </div>
      <div className="cell">
        <div className="v mono">{item.o.st}</div>
      </div>
      <div className="cell">
        <div className="v mono">{item.hr}:00</div>
      </div>
      <div className="cell">
        {item.fin ? <Chip kind="v">Completed</Chip> : <Chip kind="r">Pending</Chip>}
      </div>
    </div>
  )
}

export function WorkFilter({
  filter,
  onFilter,
  counts,
  query,
  onQuery,
  shown,
  total,
}: {
  filter: string
  onFilter: (f: string) => void
  counts: { all: number; done: number; pend: number }
  query: string
  onQuery: (q: string) => void
  shown: number
  total: number
}) {
  const pills: [string, string, number][] = [
    ['all', 'All', counts.all],
    ['done', 'Completed', counts.done],
    ['pend', 'Pending', counts.pend],
  ]
  return (
    <>
      <div className="fbar" role="group" aria-label="Filter tasks">
        {pills.map(([k, label, n]) => (
          <button
            key={k}
            type="button"
            className={`pill ${filter === k ? 'on' : ''} ${k === 'pend' && counts.pend ? 'urg' : ''}`}
            aria-pressed={filter === k}
            onClick={() => onFilter(k)}
          >
            {label}
            <span className="n">{n}</span>
          </button>
        ))}
        <div className="sp">
          <input
            className="inp"
            placeholder="Search order number"
            aria-label="Search order number"
            value={query}
            onChange={(e) => onQuery(e.target.value)}
          />
        </div>
      </div>
      <p className="cnt">
        <span>ⓘ</span> Showing <b>{shown}</b> of <b>{total}</b> stage tasks
      </p>
    </>
  )
}

export function WorkTable({
  cols,
  min,
  head,
  children,
  empty,
}: {
  cols: string
  min: number
  head: string[]
  children: ReactNode
  empty: { icon: string; text: string } | null
}) {
  return (
    <div className="tbl">
      <div className="tsc">
        <div style={{ minWidth: min }}>
          <div className="trow h" style={{ gridTemplateColumns: cols }}>
            {head.map((h, i) => (
              <span key={i}>{h}</span>
            ))}
          </div>
          <div className="tb">
            {empty ? <Empty icon={empty.icon}>{empty.text}</Empty> : children}
          </div>
        </div>
      </div>
    </div>
  )
}

export function useWorkFilter() {
  const [filter, setFilter] = useState('all')
  const [query, setQuery] = useState('')
  const match = (items: WorkItem[]) => {
    const q = query.trim().toLowerCase()
    return items.filter((i) => {
      if (filter === 'done' && !i.fin) return false
      if (filter === 'pend' && i.fin) return false
      return !q || i.o.id.toLowerCase().includes(q)
    })
  }
  return { filter, setFilter, query, setQuery, match }
}
