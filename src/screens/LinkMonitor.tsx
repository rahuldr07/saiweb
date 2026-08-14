import { useState } from 'react'
import { Banner, Btn, Kpi, Kpis, PageHead } from '@/components/ui'
import { DataTable, type DataRow } from '@/components/DataTable'
import { useUi } from '@/state/ui'
import { LINKCHECK } from '@/data/catalog'
import { LSTATE, allLinks, brokenLinks, linkStats, nextLinkCheck } from '@/lib/derived'
import { ALLSTATES, stateName } from '@/lib/coverage'
import { fmtDT } from '@/lib/format'
import { now } from '@/lib/clock'
import type { LinkStatus } from '@/data/types'

/**
 * Health of the county sites searchers depend on. A link that quietly moved costs
 * an order its SLA, so the states are explicit rather than a boolean.
 */
export default function LinkMonitor() {
  const { toast } = useUi()
  const [state, setState] = useState('all')
  const [pill, setPill] = useState('all')

  const stats = linkStats()
  const base = allLinks().filter((x) => state === 'all' || x.c.st === state)
  const due = now() >= nextLinkCheck()

  const rows: DataRow[] = base.map((x) => {
    const [label, kind] = LSTATE[x.l.s]
    return {
      id: `${x.c.st}-${x.c.n}-${x.k}`,
      k: x.l.s,
      search: `${x.c.n} ${x.c.st} ${x.lbl} ${x.l.u}`,
      c: [
        { v: x.c.n, s: stateName(x.c.st) },
        { v: x.lbl },
        { v: x.l.u || 'no link on file', mono: true },
        { v: label, chip: kind },
      ],
    }
  })

  return (
    <>
      <PageHead
        title="Link monitor"
        sub={`${stats.types} sources across ${stats.total / stats.types} counties. Last checked ${fmtDT(LINKCHECK.last)}.`}
        actions={<Btn onClick={() => toast('Re-checking every county link')}>Re-check now</Btn>}
      />

      {stats.bad ? (
        <Banner kind="d" icon="⚑" title={`${stats.bad} link${stats.bad === 1 ? '' : 's'} need attention`}>
          {[...new Set(brokenLinks().map((x) => x.c.n))].slice(0, 4).join(', ')} — a searcher hitting one of
          these loses the time before they report it.
        </Banner>
      ) : null}

      {due ? (
        <Banner kind="r" icon="◷" title="Link check is due">
          Runs every {LINKCHECK.every} days; the last one was {fmtDT(LINKCHECK.last)}. Results go to{' '}
          {LINKCHECK.notify === 'admins' ? 'company admins' : LINKCHECK.notify}.
        </Banner>
      ) : null}

      <Kpis>
        <Kpi title="Working" value={<span className="mono ok">{stats.by.ok}</span>} detail="checked and fine" />
        <Kpi
          title="Need attention"
          value={<span className="mono bad">{stats.bad}</span>}
          tone={stats.bad ? 'alert' : undefined}
          detail="slow, moved, login or down"
        />
        <Kpi
          title="No link on file"
          value={<span className="mono">{stats.by.none}</span>}
          detail="searched by hand"
        />
        <Kpi title="Never checked" value={<span className="mono">{stats.by.unchecked}</span>} detail="unknown state" />
      </Kpis>

      <div style={{ marginTop: 20 }}>
        <DataTable
          noun="links"
          min={960}
          search="Search a county or address"
          activePill={pill}
          onPill={setPill}
          filters={[
            {
              label: 'State',
              value: state,
              onChange: setState,
              options: [
                ['all', 'All states'],
                ...ALLSTATES().map((s) => [s, `${s} — ${stateName(s)}`] as [string, string]),
              ],
            },
          ]}
          pills={[
            { key: 'all', label: 'All', count: base.length },
            ...(Object.keys(LSTATE) as LinkStatus[]).map((k) => ({
              key: k,
              label: LSTATE[k][0],
              count: base.filter((x) => x.l.s === k).length,
              urgent: k === 'broken',
            })),
          ]}
          cols={[
            { l: 'County', w: 170 },
            { l: 'Source', w: 130 },
            { l: 'Address', w: 320, f: 1.8 },
            { l: 'State', w: 160 },
          ]}
          rows={rows}
          emptyText="No links match this filter."
        />
      </div>
    </>
  )
}
