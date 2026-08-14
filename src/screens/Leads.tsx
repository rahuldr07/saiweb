import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Banner, Btn, Kpi, Kpis, PageHead } from '@/components/ui'
import { RequireCap } from '@/components/RequireCap'
import { DataTable, type DataRow } from '@/components/DataTable'
import { LEADS } from '@/data/business'
import { LSTATUS } from '@/data/budget'
import { whoName } from '@/lib/permissions'
import { followUpCount, isStale, leadAge, needsFollowUp } from '@/lib/derived'

/**
 * Free-form statuses, no enforced pipeline and no due dates. A follow-up is either
 * flagged by a person or derived from how long the lead has gone quiet.
 */
function Leads() {
  const navigate = useNavigate()
  const [pill, setPill] = useState('all')

  const rows: DataRow[] = LEADS.map((l) => ({
    id: l.id,
    k: needsFollowUp(l) ? [l.st, 'followup'] : l.st,
    onClick: () => navigate({ to: '/leads/$leadId', params: { leadId: l.id } }),
    search: `${l.co} ${l.loc} ${l.contacts.map((c) => c.n).join(' ')}`,
    c: [
      { v: l.co, s: l.loc },
      { v: LSTATUS[l.st][0], chip: LSTATUS[l.st][1] },
      { v: l.contacts[0]?.n ?? '—', s: l.contacts[0]?.e },
      { v: whoName(l.own) },
      {
        v: `${leadAge(l)}d ago`,
        mono: true,
        s: isStale(l) ? 'gone quiet' : l.flag ? 'flagged' : undefined,
        bad: isStale(l),
      },
    ],
  }))

  const fu = followUpCount()

  return (
    <>
      <PageHead
        title="Leads"
        sub="Companies we are talking to. No pipeline is enforced — the statuses are labels, not gates."
        actions={<Btn onClick={() => navigate({ to: '/leads/new' })}>＋ New lead</Btn>}
      />

      {fu ? (
        <Banner kind="r" icon="◷" title={`${fu} lead${fu === 1 ? '' : 's'} need following up`}>
          Either flagged by hand, or nothing has been recorded against them for two weeks.
        </Banner>
      ) : null}

      <Kpis>
        <Kpi title="Open leads" value={LEADS.filter((l) => !['won', 'lost'].includes(l.st)).length} detail="still live" />
        <Kpi title="Need following up" value={<span className={fu ? 'warn' : 'ok'}>{fu}</span>} detail="flagged or quiet" />
        <Kpi title="Won" value={<span className="ok">{LEADS.filter((l) => l.st === 'won').length}</span>} detail="became clients" />
        <Kpi title="Lost" value={LEADS.filter((l) => l.st === 'lost').length} detail="worth a second try later" />
      </Kpis>

      <div style={{ marginTop: 20 }}>
        <DataTable
          noun="leads"
          min={900}
          search="Search company or contact"
          activePill={pill}
          onPill={setPill}
          pills={[
            { key: 'all', label: 'All', count: LEADS.length },
            { key: 'followup', label: 'Need follow-up', count: fu, urgent: true },
            ...Object.keys(LSTATUS).map((k) => ({
              key: k,
              label: LSTATUS[k][0],
              count: LEADS.filter((l) => l.st === k).length,
            })),
          ]}
          cols={[
            { l: 'Company', w: 220, f: 1.4 },
            { l: 'Status', w: 130 },
            { l: 'Main contact', w: 200 },
            { l: 'Owner', w: 150 },
            { l: 'Last touched', w: 140 },
          ]}
          rows={rows}
          emptyText="No leads match this filter."
        />
      </div>
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
