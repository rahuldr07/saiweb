import { useState } from 'react'
import { Banner, Btn, Card, PageHead, SectionHead } from '@/components/ui'
import { ErrorBoundary } from '@/components/async'
import { RequireCap } from '@/components/RequireCap'
import { useSession } from '@/state/session'
import { useUi } from '@/state/ui'
import { HIRESTAGES } from '@/data/hrms'
import { fmtDate } from '@/lib/format'
import { NewOpening } from './hiring/NewOpening'
import { addOpening, moveCandidate, nextStage, useBoard } from './hiring/store'
import type { Candidate, HireStage, Opening } from '@/data/types'

/**
 * Recruitment.
 *
 * Two halves, and the order matters: the pipeline first, because that is what
 * moves day to day, and the openings under it, because that is what explains
 * why the pipeline exists at all.
 *
 * Every opening carries its reason. A req without one is how headcount grows
 * without anyone deciding to grow it.
 */

/** The board is a row of stage columns that scrolls rather than wraps. */
const COLUMN_MIN = 168

/** Only the first few fit a column before it becomes a list nobody reads. */
const SHOWN_PER_STAGE = 5

function CandidateCard({ c, onMove }: { c: Candidate; onMove: (c: Candidate) => void }) {
  return (
    <button
      type="button"
      onClick={() => onMove(c)}
      title={`Move ${c.n} on`}
      style={{
        textAlign: 'left',
        background: 'var(--tint)',
        border: '1px solid var(--hair)',
        borderRadius: 9,
        padding: '9px 11px',
        width: '100%',
      }}
    >
      <div style={{ fontSize: '12.5px', fontWeight: 650 }}>{c.n}</div>
      <div className="gr" style={{ fontSize: '11.5px' }}>
        {c.exp} yr{c.exp === 1 ? '' : 's'} · {c.src}
      </div>
      {c.note ? (
        <div className="gr" style={{ fontSize: '11.5px', marginTop: 3 }}>
          {c.note}
        </div>
      ) : null}
    </button>
  )
}

function StageColumn({
  stage,
  list,
  onMove,
}: {
  stage: HireStage
  list: Candidate[]
  onMove: (c: Candidate) => void
}) {
  return (
    <div style={{ flex: 1, minWidth: COLUMN_MIN }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 9,
        }}
      >
        <b style={{ fontSize: '12.5px' }}>{stage}</b>
        <span className="mono gr" style={{ fontSize: '11.5px' }}>
          {list.length}
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        {list.length ? (
          list
            .slice(0, SHOWN_PER_STAGE)
            .map((c) => <CandidateCard key={c.id} c={c} onMove={onMove} />)
        ) : (
          <div className="gr" style={{ fontSize: '11.5px', padding: '8px 0' }}>
            nobody
          </div>
        )}
        {list.length > SHOWN_PER_STAGE ? (
          <div className="gr" style={{ fontSize: '11.5px' }}>
            and {list.length - SHOWN_PER_STAGE} more
          </div>
        ) : null}
      </div>
    </div>
  )
}

function Recruitment() {
  const { me } = useSession()
  const { openModal, closeModal, toast } = useUi()
  const { candidates, openings } = useBoard()
  const [job, setJob] = useState('all')

  /* A pill for an opening that has since been filtered away would strand the
     view on an empty board, so an unknown filter falls back to everything. */
  const active = job === 'all' || openings.some((o) => o.id === job) ? job : 'all'
  const shown = candidates.filter((c) => active === 'all' || c.job === active)
  const seats = openings.reduce((a, o) => a + o.n, 0)

  /* A pill names its department, which is short and is what people filter by.
     Two openings in one department would then give two identical pills — which
     the seeded three never do, but raising a second Search role immediately
     does — so a department that appears twice falls back to the role title. */
  const pillLabel = (o: Opening) =>
    openings.filter((x) => x.dep === o.dep).length > 1 ? o.title : o.dep

  /* One confirmation before anything moves. The step is small but it is the
     record of somebody's application, so it is not a stray click. */
  const askMove = (c: Candidate) => {
    const next = nextStage(c.stage)
    if (!next) return toast(`${c.n} has already joined`)

    openModal({
      title: `Move ${c.n} to ${next}?`,
      body: (
        <>
          <p style={{ fontSize: '13.5px' }}>
            {c.n} · {c.exp} year{c.exp === 1 ? '' : 's'} · from {c.src}
            {c.note ? ` · ${c.note}` : ''}
          </p>
          {next === 'Joined' ? (
            <Banner kind="b" icon="◔" style={{ margin: '12px 0 0' }}>
              Marking someone joined would create their staff record, department and salary.{' '}
              <b>That step is not built yet</b> — it needs the offer figures, which live outside
              this screen.
            </Banner>
          ) : null}
        </>
      ),
      footer: (
        <>
          <Btn variant="ghost" onClick={closeModal}>
            Cancel
          </Btn>
          <Btn
            onClick={() => {
              moveCandidate(c.id)
              closeModal()
              toast(`${c.n} → ${next}`)
            }}
          >
            Move to {next}
          </Btn>
        </>
      ),
    })
  }

  const raise = () =>
    openModal({
      title: 'New opening',
      body: (
        <NewOpening
          raisedBy={me.n}
          onCancel={closeModal}
          onSubmit={(opening: Opening) => {
            addOpening(opening)
            closeModal()
            toast(`${opening.title} — ${opening.n} seat${opening.n === 1 ? '' : 's'} open`)
          }}
        />
      ),
    })

  return (
    <>
      <PageHead
        title="Recruitment"
        sub={`${seats} position${seats === 1 ? '' : 's'} open across ${openings.length} role${
          openings.length === 1 ? '' : 's'
        } · ${shown.length} ${shown.length === 1 ? 'person' : 'people'} in the pipeline`}
        actions={<Btn onClick={raise}>＋ New opening</Btn>}
      />

      <div className="fbar" role="group" aria-label="Which role">
        <button
          type="button"
          className={`pill ${active === 'all' ? 'on' : ''}`}
          aria-pressed={active === 'all'}
          onClick={() => setJob('all')}
        >
          All roles
          <span className="n">{candidates.length}</span>
        </button>
        {openings.map((o) => (
          <button
            key={o.id}
            type="button"
            className={`pill ${active === o.id ? 'on' : ''}`}
            aria-pressed={active === o.id}
            onClick={() => setJob(o.id)}
            title={`${o.title} — ${o.dep}`}
          >
            {pillLabel(o)}
            <span className="n">{candidates.filter((c) => c.job === o.id).length}</span>
          </button>
        ))}
      </div>

      <SectionHead>The pipeline</SectionHead>
      <Card padded>
        {shown.length ? (
          <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4 }}>
            {HIRESTAGES.map((st) => (
              <StageColumn
                key={st}
                stage={st}
                list={shown.filter((c) => c.stage === st)}
                onMove={askMove}
              />
            ))}
          </div>
        ) : (
          <p className="gr" style={{ fontSize: '13.5px', margin: 0 }}>
            Nobody has applied to this role yet. The pipeline fills as candidates come in against
            it.
          </p>
        )}
        <p className="gr" style={{ fontSize: '12.5px', marginTop: 12 }}>
          Click anyone to move them a stage on. A candidate at Joined becomes a staff record — that
          is the only way people get into the system, so nobody exists without a hiring trail.
        </p>
      </Card>

      <SectionHead>Open positions</SectionHead>
      <Card>
        <div className="rows" style={{ border: 'none', borderRadius: 0 }}>
          {openings.map((o) => {
            const mine = candidates.filter((c) => c.job === o.id)
            const atOffer = mine.filter(
              (c) => c.stage === 'Offer' || c.stage === 'Verification',
            ).length
            return (
              <div className="rw" key={o.id}>
                <span className="br">{o.n}</span>
                <span>
                  <b>{o.title}</b>
                  <div className="sd">
                    {o.dep} · {o.type} · opened {fmtDate(o.open)} by {o.by}
                  </div>
                  <div className="sd gr" style={{ marginTop: 4 }}>
                    {o.why}
                  </div>
                </span>
                <span className="mono gr" style={{ fontSize: '11.5px' }}>
                  {mine.length} in pipeline
                  <br />
                  {atOffer} at offer
                </span>
              </div>
            )
          })}
        </div>
      </Card>
      <p className="gr" style={{ fontSize: '12.5px', marginTop: 10 }}>
        Every opening carries why it exists. A req without a reason is how headcount grows without
        anyone deciding to grow it.
      </p>
    </>
  )
}

export default function RecruitmentRoute() {
  return (
    <RequireCap cap="people">
      <ErrorBoundary what="Recruitment">
        <Recruitment />
      </ErrorBoundary>
    </RequireCap>
  )
}
