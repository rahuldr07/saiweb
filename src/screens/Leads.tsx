import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Btn, Chip, PageHead } from '@/components/ui'
import { RequireCap } from '@/components/RequireCap'
import { DataTable, type DataRow } from '@/components/DataTable'
import { useNotBuilt } from '@/components/notBuilt'
import { LEADS, STALE_BAD, STALE_WARN } from '@/data/business'
import { LSTATUS } from '@/data/budget'
import { fmtDate } from '@/lib/format'
import { csvName, downloadCSV } from '@/lib/csv'
import { whoName } from '@/lib/permissions'
import {
  followUpCount,
  isStale,
  lastTouch,
  leadAge,
  needsFollowUp,
  staleness,
} from '@/lib/derived'

/**
 * Firms we are trying to win.
 *
 * There is no pipeline to keep up to date and nothing to schedule: a lead turns
 * amber on its own once it has been left long enough, and red after longer. That
 * is the whole point of the screen — the ones that have gone quiet surface
 * themselves rather than waiting for somebody to remember them.
 */

const COLS = [
  { l: 'Company', w: 210 },
  { l: 'Main contact', w: 210 },
  { l: 'Location', w: 130 },
  { l: 'Status', w: 130 },
  { l: 'Last contact', w: 150 },
  { l: 'Follow up', w: 110 },
]

function Leads() {
  const navigate = useNavigate()
  const notBuilt = useNotBuilt()
  const [pill, setPill] = useState('all')

  const fu = followUpCount()
  const flagged = LEADS.filter((l) => l.flag && !['won', 'lost'].includes(l.st)).length
  const quiet = LEADS.filter((l) => isStale(l) && !l.flag).length
  const open = LEADS.filter((l) => !['won', 'lost'].includes(l.st)).length

  const exportLeads = () =>
    downloadCSV(csvName('leads'), [
      ['Company', 'Location', 'Status', 'Owner', 'Main contact', 'Email', 'Last contact', 'Days', 'Follow up'],
      ...LEADS.map((l) => {
        const main = l.contacts.find((c) => c.main) ?? l.contacts[0]
        return [
          l.co,
          l.loc,
          LSTATUS[l.st][0],
          whoName(l.own),
          main?.n ?? '',
          main?.e ?? '',
          fmtDate(lastTouch(l)),
          leadAge(l),
          l.flag ? 'Flagged' : isStale(l) ? 'Gone quiet' : '',
        ]
      }),
    ])

  const rows: DataRow[] = LEADS.map((l) => {
    const main = l.contacts.find((c) => c.main) ?? l.contacts[0]
    const age = leadAge(l)
    const tone = staleness(l)
    return {
      id: l.id,
      /* A lead belongs to its status, and also to the derived buckets — one row
         answers to several pills without the screen filtering by hand. */
      k: [
        l.st,
        ...(needsFollowUp(l) ? ['follow'] : []),
        ...(['won', 'lost'].includes(l.st) ? [] : ['open']),
      ],
      onClick: () => navigate({ to: '/leads/$leadId', params: { leadId: l.id } }),
      search: `${l.co} ${l.loc} ${l.contacts.map((c) => `${c.n} ${c.e}`).join(' ')}`,
      c: [
        {
          v: <b>{l.co}</b>,
          s: `${l.contacts.length} contact${l.contacts.length === 1 ? '' : 's'} · ${l.notes.length} note${l.notes.length === 1 ? '' : 's'}`,
        },
        { v: main?.n ?? '—', s: main?.e },
        { raw: <span className="gr" style={{ fontSize: '12.5px' }}>{l.loc}</span> },
        { v: LSTATUS[l.st][0], chip: LSTATUS[l.st][1] },
        {
          v: fmtDate(lastTouch(l)),
          mono: true,
          s: (
            <span className={tone === 'bad' ? 'bad' : tone === 'warn' ? 'warn' : undefined}>
              {age} day{age === 1 ? '' : 's'} ago
            </span>
          ),
        },
        {
          raw: l.flag ? (
            <Chip kind="r">Flagged</Chip>
          ) : isStale(l) ? (
            <Chip kind="r">Gone quiet</Chip>
          ) : (
            <span className="gr">—</span>
          ),
        },
      ],
    }
  })

  return (
    <>
      <PageHead
        title="Leads"
        sub="Firms you are trying to win. A lead that has gone quiet is the point of this screen."
        actions={
          <>
            <Btn
              variant="ghost"
              onClick={() =>
                notBuilt(
                  'Importing a CSV',
                  'a file picker and a column mapper — the same one Bulk import uses',
                  exportLeads,
                )
              }
            >
              Import
            </Btn>
            <Btn onClick={() => navigate({ to: '/leads/new' })}>＋ Add lead</Btn>
          </>
        }
      />

      {fu ? (
        <div className="bnr r">
          <span className="bi">◷</span>
          <div>
            <div className="bt">
              {fu} lead{fu === 1 ? '' : 's'} need{fu === 1 ? 's' : ''} following up
            </div>
            {flagged} flagged by hand, and {quiet} that {quiet === 1 ? 'has' : 'have'} simply gone
            quiet — no contact in over {STALE_WARN} days.
            <div className="bs">
              There are no due dates to keep up to date. A lead goes amber on its own once it has been
              left long enough.
            </div>
          </div>
          <div className="ba">
            <Btn variant="ghost" small onClick={() => setPill('follow')}>
              Show them
            </Btn>
          </div>
        </div>
      ) : null}

      <DataTable
        noun="leads"
        min={960}
        search="Search company or contact"
        activePill={pill}
        onPill={setPill}
        pills={[
          { key: 'all', label: 'All', count: LEADS.length },
          { key: 'follow', label: 'Needs follow-up', count: fu, urgent: true },
          { key: 'open', label: 'Open', count: open },
          ...Object.entries(LSTATUS).map(([k, v]) => ({
            key: k,
            label: v[0],
            count: LEADS.filter((l) => l.st === k).length,
          })),
        ]}
        cols={COLS}
        rows={rows}
        emptyText="No leads match this filter."
      />

      <p className="gr" style={{ fontSize: '12.5px', marginTop: 12 }}>
        Amber after {STALE_WARN} days without contact, red after {STALE_BAD}. Won, lost and “not now”
        leads are left alone.
      </p>
    </>
  )
}

export default function LeadsRoute() {
  return (
    <RequireCap cap="pricing">
      <Leads />
    </RequireCap>
  )
}
