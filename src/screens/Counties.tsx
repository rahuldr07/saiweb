import { useState } from 'react'
import { Btn, Chip, Kpi, Kpis, PageHead, Rows, SectionHead } from '@/components/ui'
import { DataTable, type DataRow } from '@/components/DataTable'
import { useUi } from '@/state/ui'
import { COUNTIES, LINKTYPES } from '@/data/catalog'
import { LSTATE } from '@/lib/derived'
import { ALLSTATES, stateName } from '@/lib/coverage'
import { csvName, downloadCSV } from '@/lib/csv'

/**
 * The coverage register. Intake validates against this: an order cannot be taken
 * for a county we do not cover.
 */
export default function Counties() {
  const { openModal, toast } = useUi()
  const [state, setState] = useState('all')

  const base = COUNTIES.filter((c) => state === 'all' || c.st === state)

  const open = (key: string) => {
    const c = base.find((x) => `${x.st}-${x.n}` === key)
    if (!c) return
    openModal({
      title: `${c.n}, ${c.st}`,
      body: (
        <>
          <p className="gr" style={{ fontSize: '12.5px', marginBottom: 14 }}>
            {stateName(c.st)} · county index {c.idx}
          </p>
          <Rows>
            {LINKTYPES.map((t) => {
              const l = c.links[t.k]
              const [label, kind] = LSTATE[l.s]
              return (
                <div className="rw" key={t.k}>
                  <span className="gr">·</span>
                  <span>
                    <b>{t.n}</b>
                    <div className="sd mono" style={{ fontSize: '11.5px' }}>
                      {l.u || 'no link on file'}
                    </div>
                    <div className="sd">{t.note}</div>
                  </span>
                  <span>
                    <Chip kind={kind}>{label}</Chip>
                  </span>
                </div>
              )
            })}
          </Rows>
        </>
      ),
    })
  }

  const rows: DataRow[] = base.map((c) => {
    const online = LINKTYPES.filter((t) => c.links[t.k].u).length
    return {
      id: `${c.st}-${c.n}`,
      k: online === LINKTYPES.length ? 'full' : online ? 'part' : 'manual',
      onClick: () => open(`${c.st}-${c.n}`),
      search: `${c.n} ${c.st} ${stateName(c.st)}`,
      c: [
        { v: c.n, s: stateName(c.st) },
        { v: c.st, mono: true },
        { v: String(c.idx), mono: true },
        {
          v: `${online} of ${LINKTYPES.length}`,
          mono: true,
          s: online === LINKTYPES.length ? 'all sources online' : 'the rest are searched by hand',
        },
        {
          raw: (
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {LINKTYPES.map((t) => {
                const [label, kind] = LSTATE[c.links[t.k].s]
                return (
                  <Chip key={t.k} kind={kind}>
                    {t.n} · {label}
                  </Chip>
                )
              })}
            </div>
          ),
        },
      ],
    }
  })

  const exportCounties = () => {
    const out = downloadCSV(csvName('counties'), [
      ['County', 'State', 'Index', ...LINKTYPES.map((t) => t.n)],
      ...base.map((c) => [c.n, c.st, c.idx, ...LINKTYPES.map((t) => c.links[t.k].u || '')]),
    ])
    toast(`${out.name} — ${out.rows.length - 1} rows`)
  }

  const online = base.flatMap((c) => LINKTYPES.map((t) => c.links[t.k])).filter((l) => l.u).length
  const total = base.length * LINKTYPES.length

  return (
    <>
      <PageHead
        title="County coverage"
        sub="Where we can take work, and which sources are online. Order intake is validated against this."
        actions={
          <Btn variant="ghost" onClick={exportCounties}>
            Export
          </Btn>
        }
      />

      <SectionHead>Where we can take work</SectionHead>
      <Kpis>
        <Kpi title="Counties" value={base.length} detail={`across ${new Set(base.map((c) => c.st)).size} states`} />
        <Kpi title="Sources online" value={<span className="mono">{online}</span>} detail={`of ${total} possible`} />
        <Kpi
          title="Searched by hand"
          value={<span className="mono warn">{total - online}</span>}
          detail="no link on file"
        />
        <Kpi title="Link types" value={LINKTYPES.length} detail="per county" />
      </Kpis>

      <div style={{ marginTop: 20 }}>
        <DataTable
          noun="counties"
          min={1000}
          search="Search a county or state"
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
            {
              key: 'full',
              label: 'Fully online',
              count: base.filter((c) => LINKTYPES.every((t) => c.links[t.k].u)).length,
            },
            {
              key: 'part',
              label: 'Part online',
              count: base.filter(
                (c) => LINKTYPES.some((t) => c.links[t.k].u) && !LINKTYPES.every((t) => c.links[t.k].u),
              ).length,
            },
            {
              key: 'manual',
              label: 'By hand only',
              count: base.filter((c) => !LINKTYPES.some((t) => c.links[t.k].u)).length,
            },
          ]}
          cols={[
            { l: 'County', w: 180 },
            { l: 'State', w: 80 },
            { l: 'Index', w: 90 },
            { l: 'Sources', w: 150 },
            { l: 'Where the data comes from', w: 300, f: 1.6 },
          ]}
          rows={rows}
          emptyText="No counties match this filter."
        />
      </div>
    </>
  )
}
