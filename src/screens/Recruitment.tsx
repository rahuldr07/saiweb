import { useState } from 'react'
import { Btn, Card, CardHead, Chip, Kpi, Kpis, PageHead, Rows, SectionHead } from '@/components/ui'
import { RequireCap } from '@/components/RequireCap'
import { DataTable, type DataRow } from '@/components/DataTable'
import { useSession } from '@/state/session'
import { useUi } from '@/state/ui'
import { CANDIDATES, OPENINGS } from '@/data/hrms'
import { fmtDate } from '@/lib/format'
import { NewOpening } from './hiring/NewOpening'
import type { ChipKind, Opening } from '@/data/types'

const STAGE_KIND: Record<string, ChipKind> = {
  Applied: 'n',
  Screened: 'b',
  Interview: 'r',
  Offer: 'v',
  Verification: 'v',
}

/** Openings, and the candidate pipeline against each. */
function Recruitment() {
  const { me } = useSession()
  const { openModal, closeModal, toast } = useUi()
  const [job, setJob] = useState('all')
  /* Openings raised in this session, newest first, alongside the seeded ones. */
  const [added, setAdded] = useState<Opening[]>([])

  const openings = [...added, ...OPENINGS]
  const base = CANDIDATES.filter((c) => job === 'all' || c.job === job)
  const openingOf = (id: string) => openings.find((o) => o.id === id)

  const raise = () =>
    openModal({
      title: 'New opening',
      body: (
        <NewOpening
          raisedBy={me.n}
          onSubmit={(opening) => {
            setAdded((a) => [opening, ...a])
            closeModal()
            toast(`${opening.title} — ${opening.n} seat${opening.n === 1 ? '' : 's'} open`)
          }}
        />
      ),
    })

  const rows: DataRow[] = base.map((c) => ({
    id: c.id,
    k: c.stage,
    search: `${c.n} ${c.src} ${openingOf(c.job)?.title ?? ''}`,
    c: [
      { v: c.n, s: c.note },
      { v: openingOf(c.job)?.title ?? c.job, s: openingOf(c.job)?.dep },
      { v: `${c.exp} yr${c.exp === 1 ? '' : 's'}`, mono: true },
      { v: c.src },
      { v: c.stage, chip: STAGE_KIND[c.stage] ?? 'n' },
      { v: fmtDate(c.at), mono: true },
    ],
  }))

  const seats = openings.reduce((a, o) => a + o.n, 0)

  return (
    <>
      <PageHead
        title="Recruitment"
        actions={<Btn onClick={raise}>＋ New opening</Btn>}
        sub={`${openings.length} opening${openings.length === 1 ? '' : 's'} for ${seats} seats, and ${CANDIDATES.length} people in the pipeline.`}
      />

      <Kpis>
        <Kpi title="Open roles" value={openings.length} detail={`${seats} seats in total`} />
        <Kpi title="In the pipeline" value={CANDIDATES.length} detail="across every stage" />
        <Kpi
          title="At interview"
          value={CANDIDATES.filter((c) => c.stage === 'Interview').length}
          detail="waiting on us"
        />
        <Kpi
          title="At offer"
          value={<span className="ok">{CANDIDATES.filter((c) => c.stage === 'Offer').length}</span>}
          detail="waiting on them"
        />
      </Kpis>

      <SectionHead>Openings</SectionHead>
      <Card>
        <CardHead title={`${openings.length} live`} />
        <Rows>
          {openings.map((o) => {
            const mine = CANDIDATES.filter((c) => c.job === o.id)
            return (
              <div className="rw" key={o.id}>
                <span className="gr">⊕</span>
                <span>
                  <b>{o.title}</b>
                  <div className="sd">
                    {o.dep} · {o.type} · {o.n} seat{o.n === 1 ? '' : 's'} · opened {fmtDate(o.open)} by {o.by}
                  </div>
                  <div className="sd">{o.why}</div>
                </span>
                <span>
                  <Chip kind={mine.length ? 'b' : 'n'}>{mine.length} candidates</Chip>
                </span>
              </div>
            )
          })}
        </Rows>
      </Card>

      <SectionHead>Candidates</SectionHead>
      <DataTable
        noun="candidates"
        min={1000}
        search="Search a candidate or source"
        filters={[
          {
            label: 'Opening',
            value: job,
            onChange: setJob,
            options: [
              ['all', 'All openings'],
              ...openings.map((o) => [o.id, o.title] as [string, string]),
            ],
          },
        ]}
        pills={[
          { key: 'all', label: 'All', count: base.length },
          ...['Applied', 'Screened', 'Interview', 'Offer', 'Verification'].map((s) => ({
            key: s,
            label: s,
            count: base.filter((c) => c.stage === s).length,
          })),
        ]}
        cols={[
          { l: 'Candidate', w: 200, f: 1.3 },
          { l: 'Opening', w: 220, f: 1.3 },
          { l: 'Experience', w: 110 },
          { l: 'Source', w: 120 },
          { l: 'Stage', w: 140 },
          { l: 'Applied', w: 110 },
        ]}
        rows={rows}
        emptyText="No candidates match this filter."
      />
    </>
  )
}

export default function RecruitmentRoute() {
  return (
    <RequireCap cap="people">
      <Recruitment />
    </RequireCap>
  )
}
