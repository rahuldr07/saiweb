import { useState } from 'react'
import { useParams } from '@tanstack/react-router'
import { useGo } from '@/lib/nav'
import {
  Bar,
  BarRow,
  Banner,
  Btn,
  Card,
  Chip,
  DetailList,
  DetailRow,
  Field,
  Kpi,
  Kpis,
  Label,
  NotFoundRecord,
  PageHead,
  Row,
  Rows,
  SectionHead,
  Tabs,
} from '@/components/ui'
import { Cell, FlexRow, FlexTable } from '@/components/FlexTable'
import { RatingsTable } from '@/components/RatingsTable'
import { SkeletonRows, SkeletonValue } from '@/components/async'
import { useBudgetHelp } from '@/components/budgetHelp'
import { useStaffEditor } from '@/components/editors/useStaffEditor'
import { useSession } from '@/state/session'
import { useUi } from '@/state/ui'
import { useStaff, usePerms, useRoles } from '@/state/company'
import { useLevels } from '@/state/levels'
import { AVAIL } from '@/data/people'
import { ASSIGN_STAGES, COVSTAGES, STAGES } from '@/data/org'
import { board } from '@/lib/engine'
import { covWord } from '@/lib/qualification'
import { median } from '@/lib/metrics'
import { standing, type StageWork } from '@/lib/quality'
import { DEFAULT_RANGE, inRange, resolveRange } from '@/lib/range'
import { fmtDate, initials } from '@/lib/format'
import { roleName } from '@/lib/permissions'
import { useDeliveries } from '@/lib/useDeliveries'
import { useQcLog } from '@/lib/useQcLog'
import { useStageWork } from '@/lib/useStageWork'
import type { QcEntry } from '@/data/quality'

const TABS = ['Overview', 'Work', 'Quality', 'Access'] as const
type Tab = (typeof TABS)[number]

const maskAadhaar = (a: string) => (a ? `XXXX XXXX ${a.replace(/\s/g, '').slice(-4)}` : '')

const TINT: Record<string, string> = {
  v: 'var(--oksoft)',
  d: 'var(--badtint)',
  r: 'var(--warntint)',
  b: 'var(--brandsoft)',
  n: 'var(--tint)',
}

export default function PersonDetail() {
  const { personId } = useParams({ from: '/staff/$personId' })
  const navigate = useGo()
  const { me, can } = useSession()
  const { openModal } = useUi()
  const budgetHelp = useBudgetHelp()
  const { editStaff } = useStaffEditor()
  const staff = useStaff()
  const perms = usePerms()
  const roles = useRoles()
  const levelsApi = useLevels()
  const [tab, setTab] = useState<Tab>('Overview')
  const [aadhaarShown, setAadhaarShown] = useState(false)

  const person = staff.find((s) => s.id === personId)

  const history = useDeliveries()
  const qcLog = useQcLog()
  const range = resolveRange(DEFAULT_RANGE)
  const stageWork = useStageWork(range)

  if (!person) {
    return <NotFoundRecord what="person" backTo="/company" backLabel="Staff" />
  }

  const { run, work: allWork, dwork } = board()
  const log = qcLog.data ?? []

  const rated = log.filter((x) => x.onName === person.n && inRange(x.d, range))
  const given = log.filter((x) => x.byName === person.n && inRange(x.d, range))
  const teamRows = log.filter((x) => inRange(x.d, range))

  const work = allWork[person.id] ?? { done: 0, pend: 0, tot: 0, pct: 0, items: [], stages: {} }
  const t: StageWork | null = stageWork.people[person.n] ?? null
  const qavg = rated.length ? rated.reduce((a, x) => a + x.avg, 0) / rated.length : null
  const teamAvg = teamRows.length ? teamRows.reduce((a, x) => a + x.avg, 0) / teamRows.length : 0
  const sd = qavg !== null && t ? standing(qavg, t.vsPeers, teamAvg) : null
  const role = roles.find((x) => x.id === person.r)
  const dis = person.active === false
  const isMe = person.id === me.id
  const load = run.load[person.id] ?? 0
  const level = levelsApi.levelOf(person.id)
  const levelId = levelsApi.personLevel(person.id)
  const loading = qcLog.isPending || history.isPending

  const maySeePersonal = isMe || can('people')

  const modalNote = (children: React.ReactNode) => (
    <p className="gr" style={{ fontSize: '12.5px', marginTop: 12 }}>
      {children}
    </p>
  )

  const openStages = () => {
    const items = [...work.items].sort((a, b) => a.hr - b.hr)
    openModal({
      title: `${person.n} — ${work.tot} stage${work.tot === 1 ? '' : 's'} today`,
      body: (
        <>
          {items.length ? (
            <Rows>
              {items.map((x, i) => (
                <Row
                  key={`${x.o.id}-${x.stage}-${i}`}
                  icon={<span className={x.fin ? 'ok' : 'gr'}>{x.fin ? '✓' : '·'}</span>}
                  title={`${x.o.id} · ${x.stage}`}
                  detail={`${x.o.cl} · ${x.o.pr} · placed at ${x.hr}:00`}
                  right={<span className={x.fin ? 'ok' : 'gr'}>{x.fin ? 'done' : 'open'}</span>}
                />
              ))}
            </Rows>
          ) : (
            <p className="gr" style={{ fontSize: '13.5px', margin: 0 }}>
              Nothing has been placed with them today.
            </p>
          )}
          {modalNote(
            <>
              Their target is <b>{person.cap} a day</b>, set on their record rather than by the
              department. The assignment run stops offering them work once they reach it.
            </>,
          )}
        </>
      ),
    })
  }

  const openLate = () => {
    const over = t ? t.items.filter((x) => x.over && x.d.late) : []
    openModal({
      title: `Late deliveries their stage overran — ${over.length}`,
      body: (
        <>
          {over.length ? (
            <Rows>
              {over.map((x, i) => (
                <Row
                  key={`${x.d.id}-${x.st}-${i}`}
                  icon={<span className="bad">⚑</span>}
                  title={`${x.d.id} · ${x.st}`}
                  detail={`${x.d.cl} · ${x.d.pr} · took ${x.h.toFixed(1)}h against a ${x.budget.toFixed(1)}h budget`}
                  right={<span className="mono bad">{x.ratio.toFixed(2)}×</span>}
                />
              ))}
            </Rows>
          ) : (
            <p className="gr" style={{ fontSize: '13.5px', margin: 0 }}>
              None. Where an order ran late, their stage was inside its budget.
            </p>
          )}
          {modalNote(
            <>
              Only counted when <b>their own stage</b> was the one that overran. An order can be late
              for reasons upstream of the person holding it, and blaming them for that is how a
              metric stops being trusted.
            </>,
          )}
        </>
      ),
    })
  }

  const CHECK_TITLE: Record<string, string> = {
    all: 'Every check on their work',
    defect: 'Scored 3 or below',
    clean: 'Nothing raised',
    gave: 'Checks they carried out',
  }

  const openChecks = (kind: 'all' | 'defect' | 'clean' | 'gave') => {
    const set: QcEntry[] =
      kind === 'gave'
        ? given
        : kind === 'defect'
          ? rated.filter((x) => x.defect)
          : kind === 'clean'
            ? rated.filter((x) => !x.crit)
            : rated
    openModal({
      title: `${person.n} — ${CHECK_TITLE[kind].toLowerCase()} · ${set.length}`,
      body: (
        <>
          {set.length ? (
            <Rows>
              {set.map((x, i) => (
                <Row
                  key={`${x.order}-${x.stage}-${i}`}
                  icon={
                    <span className={x.defect ? 'bad' : x.crit ? 'gr' : 'ok'}>
                      {x.defect ? '⚑' : x.crit ? '·' : '✓'}
                    </span>
                  }
                  title={`${x.order} · ${x.stage}`}
                  detail={`${fmtDate(x.d)} · ${
                    kind === 'gave' ? `on ${x.onName}` : `checked by ${x.byName}`
                  }${x.note ? ` — ${x.note}` : ''}`}
                  right={<span className="mono">{x.avg.toFixed(2)}</span>}
                />
              ))}
            </Rows>
          ) : (
            <p className="gr" style={{ fontSize: '13.5px', margin: 0 }}>
              Nothing in {range.label}.
            </p>
          )}
          {modalNote(
            kind === 'gave'
              ? 'What someone raises on others is as much a part of their record as what is raised on them — a checker who never finds anything is not necessarily a good checker.'
              : 'About a third of finished work is never rated, so these counts are a sample rather than a census. Read the reasons before the average.',
          )}
        </>
      ),
    })
  }

  const head = (
    <Card padded>
      <div className="ch" style={{ border: 'none', padding: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
          <span className="ava" style={{ width: 52, height: 52, fontSize: '17px' }}>
            {initials(person.n)}
          </span>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
              <h2 style={{ margin: 0, fontSize: '19px' }}>{person.n}</h2>
              <Chip kind={person.r === 'admin' ? 'b' : person.r === 'staff' ? 'n' : 'r'}>
                {roleName(person.r)}
              </Chip>
              {dis ? (
                <Chip kind="n">Disabled</Chip>
              ) : (
                <Chip kind={AVAIL[person.avail][1]}>{AVAIL[person.avail][0]}</Chip>
              )}
              {sd ? <Chip kind={sd[1]}>{sd[0]}</Chip> : null}
              {isMe ? <Chip kind="b">You</Chip> : null}
            </div>
            <div className="gr" style={{ fontSize: '12.5px', marginTop: 4 }}>
              {person.dep.length ? (
                person.dep.join(' · ')
              ) : (
                <span className="warn">in no department — cannot be assigned anything</span>
              )}
              {person.e ? (
                <>
                  {' · '}
                  <span className="mono">{person.e}</span>
                </>
              ) : null}
              {person.mob ? (
                <>
                  {' · '}
                  <span className="mono">{person.mob}</span>
                </>
              ) : null}
            </div>
          </div>
        </div>
        <div className="r">
          <Btn variant="ghost" onClick={() => editStaff(person.id)}>
            Edit details
          </Btn>
          {can('people') ? (
            <Btn
              variant="ghost"
              onClick={() => navigate({ to: '/company', search: { tab: 'Roles' } })}
            >
              Roles
            </Btn>
          ) : null}
        </div>
      </div>

      {person.conflict ? (
        <Banner kind="r" icon="⚖" title="In a stage and its own QC" style={{ margin: '14px 0 0' }}>
          {person.n} is in both Typing and Typing QC, so they could be asked to check their own
          typing. Assignment blocks it order by order, but the pairing itself is worth a decision.
        </Banner>
      ) : null}

      {dis ? (
        <Banner kind="d" icon="⚑" title="Disabled — takes no new work" style={{ margin: '14px 0 0' }}>
          Their history stays exactly as it is. Everything below still counts the work they did.
        </Banner>
      ) : null}
    </Card>
  )

  const overview = (
    <>
      <Kpis style={{ marginTop: 16 }}>
        <Kpi
          title="Today"
          value={work.tot}
          detail={`of a ${person.cap} target`}
          hint="Their day, stage by stage"
          onClick={() => setTab('Work')}
        />
        <Kpi
          title="Completed"
          value={<span className="ok">{work.done}</span>}
          detail={`${work.pct}% of their day`}
          hint="Their day, stage by stage"
          onClick={() => setTab('Work')}
        />
        <Kpi
          title="On their desk"
          value={<span className={work.pend ? 'warn' : 'ok'}>{work.pend}</span>}
          tone={work.pend ? 'warn' : undefined}
          detail="still to finish"
          hint="What is still open"
          onClick={() => setTab('Work')}
        />
        <Kpi
          title="Quality"
          value={loading ? <SkeletonValue width={64} /> : qavg !== null ? qavg.toFixed(2) : '—'}
          detail={`${rated.length} rating${rated.length === 1 ? '' : 's'} · ${range.label}`}
          hint="Every rating and why marks came off"
          onClick={() => setTab('Quality')}
        />
      </Kpis>

      {sd && qavg !== null && t ? (
        <Card padded style={{ marginTop: 16 }}>
          <div
            className="rw tagged"
            style={{ background: TINT[sd[1]] ?? 'var(--tint)', borderRadius: 9, padding: '13px 15px' }}
          >
            <span>
              <Chip kind={sd[1]}>{sd[0]}</Chip>
            </span>
            <span>
              <b>{sd[2]}</b>
              <div className="sd">
                Quality {qavg.toFixed(2)} against a team {teamAvg.toFixed(2)}; inside budget on{' '}
                {t.onBudget}% of {t.c} stages where peers on the same stages manage {t.expected}%.
              </div>
            </span>
            <span>
              <Btn variant="ghost" small onClick={() => setTab('Quality')}>
                The detail
              </Btn>
            </span>
          </div>
        </Card>
      ) : null}

      <div className="two" style={{ marginTop: 16 }}>
        <Card padded>
          <Label>Contact and emergency</Label>
          <DetailList
            gap={14}
            rows={(
              [
                ['Mobile', person.mob],
                ['Email', person.e],
                ['Address', person.addr],
              ] as [string, string][]
            ).filter((r) => r[1])}
          />
          {person.emg?.n ? (
            <div
              className="rw"
              style={{
                background: 'var(--badtint)',
                borderRadius: 9,
                padding: '12px 14px',
                marginTop: 12,
              }}
            >
              <span className="bad" style={{ fontSize: '14.5px' }}>
                ☎
              </span>
              <span>
                <b>
                  {person.emg.n} — {person.emg.rel}
                </b>
                <div className="sd mono">{person.emg.mob}</div>
                <div className="sd gr">Called first if something happens here.</div>
              </span>
              <span />
            </div>
          ) : (
            <Banner kind="r" icon="⚠" style={{ marginTop: 12 }}>
              <b>No emergency contact on record.</b> This is the field nobody misses until the day it
              is needed.
            </Banner>
          )}
        </Card>

        <Card padded>
          <Label>Statutory</Label>
          {maySeePersonal ? (
            <>
              {(
                [
                  ['PAN', person.pan],
                  ['UAN — provident fund', person.uan],
                  ['ESIC number', person.esicNo],
                ] as [string, string][]
              ).map((r) => (
                <DetailRow
                  key={r[0]}
                  gap={14}
                  label={r[0]}
                  value={
                    r[1] ? <span className="mono">{r[1]}</span> : <span className="bad">not on record</span>
                  }
                />
              ))}
              <DetailRow
                gap={14}
                center
                label="Aadhaar"
                value={
                  <span style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                    <b className="mono">
                      {person.aadhaar
                        ? aadhaarShown
                          ? person.aadhaar
                          : maskAadhaar(person.aadhaar)
                        : 'not on record'}
                    </b>
                    {person.aadhaar && !aadhaarShown ? (
                      <Btn variant="ghost" small onClick={() => setAadhaarShown(true)}>
                        Show
                      </Btn>
                    ) : null}
                  </span>
                }
              />
              <DetailRow
                gap={14}
                label="Bank"
                last
                value={
                  person.bank?.acct ? (
                    <span className="mono">
                      {person.bank.acct} · {person.bank.ifsc}
                    </span>
                  ) : (
                    <span className="bad">not on record</span>
                  )
                }
              />
              <p className="gr" style={{ fontSize: '12.5px', marginTop: 10 }}>
                Aadhaar shows its last four by default. Anything more should be a deliberate act, and
                in a real deployment a logged one.
              </p>
            </>
          ) : (
            <p className="gr" style={{ fontSize: '12.5px', margin: '10px 0 0' }}>
              Statutory identifiers and bank details need the “people” capability. Ask a company admin
              if you should be able to see them.
            </p>
          )}
        </Card>
      </div>

      <div className="two" style={{ marginTop: 16 }}>
        <Card padded>
          <Label>Where they work</Label>
          {person.dep.length ? (
            person.dep.map((d) => {
              const st = work.stages[d] ?? { done: 0, pend: 0 }
              const dept = dwork[d]
              return (
                <div
                  key={d}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '130px 1fr 120px',
                    gap: 12,
                    alignItems: 'center',
                    padding: '7px 0',
                    fontSize: '12.5px',
                  }}
                >
                  <span>
                    <b>{d}</b>
                  </span>
                  <Bar value={st.done + st.pend} max={Math.max(1, work.tot)} color="var(--brand2)" />
                  <span className="mono gr" style={{ textAlign: 'right' }}>
                    {st.done + st.pend} today
                    {dept?.staff ? ` · 1 of ${dept.staff.length}` : ''}
                  </span>
                </div>
              )
            })
          ) : (
            <p className="gr" style={{ fontSize: '12.5px', margin: 0 }}>
              No department, so the assignment engine can never pick them.{' '}
              <button type="button" className="lnk" onClick={() => editStaff(person.id)}>
                Fix that
              </button>
              .
            </p>
          )}
          <p className="gr" style={{ fontSize: '12.5px', marginTop: 12 }}>
            A person in one department is a single point of failure for that stage on the day they
            are away.
          </p>
        </Card>

        <Card padded>
          <Label>Capacity</Label>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '8px 0 10px' }}>
            <b className="mono" style={{ fontSize: '26px' }}>
              {load}
            </b>
            <span className="gr">of {person.cap} today</span>
          </div>
          <Bar
            value={load}
            max={person.cap}
            color={load >= person.cap ? 'var(--warn)' : 'var(--ok)'}
          />
          <p className="gr" style={{ fontSize: '12.5px', marginTop: 12 }}>
            {load >= person.cap
              ? 'At target, so the engine will not give them anything else today. Anything that needed them became an exception.'
              : `${person.cap - load} more before the engine stops offering them work.`}
          </p>
          <p className="gr" style={{ fontSize: '12.5px' }}>
            Their target is set on their record, not by the department.
          </p>
        </Card>

        {person.dep.some((d) => COVSTAGES.includes(d)) ? (
          <Card padded>
            <Label>What they can be given</Label>
            <div style={{ marginTop: 10 }}>
              <Field
                label="Level"
                hint={
                  levelId
                    ? 'Coverage comes from the level, so changing it here moves them, not the level.'
                    : 'Not restricted — a candidate for anything in their department.'
                }
              >
                <select
                  className="inp"
                  aria-label="Level"
                  value={levelId ?? ''}
                  onChange={(e) => levelsApi.setPersonLevel(person.id, e.target.value)}
                >
                  <option value="">No level — takes anything</option>
                  {levelsApi.levels.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.n} — {covWord(l)}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            {levelId && level ? (
              <div className="rw" style={{ padding: '11px 0', marginTop: 6 }}>
                <span className="ok" style={{ fontSize: '14.5px' }}>
                  ◈
                </span>
                <span>
                  <b>{covWord(levelsApi.covOf(person.id))}</b>
                  <div className="sd">
                    Shared with {Math.max(0, levelsApi.onLevel(levelId).length - 1)} other
                    {levelsApi.onLevel(levelId).length - 1 === 1 ? '' : 's'} on {level.n}. Widen the
                    level and they all move together.
                  </div>
                </span>
                <span>
                  <Btn
                    variant="ghost"
                    small
                    onClick={() => {
                      levelsApi.select(levelId)
                      navigate({ to: '/assign' })
                    }}
                  >
                    Open the level
                  </Btn>
                </span>
              </div>
            ) : null}
            <p className="gr" style={{ fontSize: '12.5px', marginTop: 10 }}>
              Levels apply to {COVSTAGES.join(' and ')} only — the stages that need local knowledge.
              Typing and RTS work from what the searcher found.
            </p>
          </Card>
        ) : null}
      </div>
    </>
  )

  const dayItems = [...work.items].sort((a, b) => a.hr - b.hr)

  const workTab = (
    <>
      <Kpis style={{ marginTop: 16 }}>
        <Kpi
          title="Stages today"
          value={work.tot}
          detail={`${work.done} done · ${work.pend} open`}
          hint="Their day, stage by stage"
          onClick={openStages}
        />
        <Kpi
          title="Inside budget"
          value={loading ? <SkeletonValue width={64} /> : t ? `${t.onBudget}%` : '—'}
          valueTone={t ? (t.vsPeers >= -5 ? 'ok' : 'warn') : undefined}
          tone={t && t.vsPeers < -5 ? 'warn' : undefined}
          detail={t ? `peers ${t.expected}%` : 'no history in range'}
          hint="What this is measured against"
          onClick={budgetHelp}
        />
        <Kpi
          title="Median time used"
          value={loading ? <SkeletonValue width={64} /> : t ? `${t.ratio.toFixed(2)}×` : '—'}
          detail="of the budget allowed"
          hint="What this is measured against"
          onClick={budgetHelp}
        />
        <Kpi
          title="Late orders they overran"
          value={
            loading ? (
              <SkeletonValue width={48} />
            ) : (
              <span className={t?.causedLate ? 'bad' : 'ok'}>{t ? t.causedLate : '—'}</span>
            )
          }
          tone={t?.causedLate ? 'alert' : undefined}
          detail="their stage went over"
          hint="Which orders, and by how much"
          onClick={openLate}
        />
      </Kpis>

      {loading ? (
        <Card style={{ marginTop: 16 }}>
          <div className="cb">
            <SkeletonRows rows={4} cols={3} />
          </div>
        </Card>
      ) : t ? (
        <Card padded style={{ marginTop: 16 }}>
          <Label>Time against budget, by department — {range.label}</Label>
          {ASSIGN_STAGES.filter((st) => t.stages[st]?.length).map((st) => {
            const l = t.stages[st]
            const md = median(l.map((x) => x.ratio))
            const ov = l.filter((x) => x.over).length
            return (
              <BarRow
                key={st}
                cols="120px 1fr 200px"
                padding="7px 0"
                label={st}
                value={md}
                max={2}
                budget={{ value: 1, max: 2 }}
                color={md > 1 ? 'var(--warn)' : 'var(--brand2)'}
                right={
                  <>
                    {md.toFixed(2)}×{' '}
                    <span className={ov / l.length > 0.3 ? 'warn' : 'gr'}>
                      · over on {ov} of {l.length}
                    </span>
                  </>
                }
              />
            )
          })}
          <p className="gr" style={{ fontSize: '12.5px', marginTop: 12 }}>
            Pale bar is the budget, solid is their median. Judged against people doing the same
            stages, not against the whole company.
          </p>
        </Card>
      ) : null}

      <SectionHead>Today, stage by stage</SectionHead>
      {dayItems.length ? (
        <FlexTable
          cols="40px 105px 160px 150px 150px 1fr"
          min={800}
          head={['#', 'Arrived', 'Order', 'Client', 'Stage', 'Status']}
        >
          {dayItems.map((i, idx) => (
            <FlexRow
              key={`${i.o.id}-${i.stage}-${idx}`}
              cols="40px 105px 160px 150px 150px 1fr"
              onClick={() => navigate({ to: '/orders/$orderId', params: { orderId: i.o.id } })}
            >
              <Cell v={idx + 1} mono tone="gr" />
              <Cell v={`${i.hr}:00`} mono />
              <Cell v={i.o.id} s={i.o.pr} mono />
              <Cell v={i.o.cl} />
              <Cell v={i.stage} />
              <Cell>
                <Chip kind={i.fin ? 'v' : 'r'}>{i.fin ? 'Completed' : 'On their desk'}</Chip>
              </Cell>
            </FlexRow>
          ))}
        </FlexTable>
      ) : (
        <Card padded>
          <p className="gr" style={{ fontSize: '12.5px', margin: 0 }}>
            Nothing assigned today.
            {person.avail !== 'ok'
              ? ` They are ${AVAIL[person.avail][0].toLowerCase()}.`
              : ' The engine had work but did not need them.'}
          </p>
        </Card>
      )}
    </>
  )

  const defects = rated.filter((x) => x.defect)
  const clean = rated.filter((x) => !x.crit)
  const gavg = given.length ? given.reduce((a, x) => a + x.avg, 0) / given.length : null
  const reasons = Object.entries(
    rated
      .filter((x) => x.note)
      .reduce<Record<string, number>>((acc, x) => {
        acc[x.note!] = (acc[x.note!] ?? 0) + 1
        return acc
      }, {}),
  ).sort((a, b) => b[1] - a[1])

  const qualityTab = (
    <>
      <Kpis style={{ marginTop: 16 }}>
        <Kpi
          title="Quality"
          value={loading ? <SkeletonValue width={64} /> : qavg !== null ? qavg.toFixed(2) : '—'}
          detail={`${rated.length} ratings`}
          hint="Every rating on their work"
          onClick={() => openChecks('all')}
        />
        <Kpi
          title="Defects"
          value={
            <span className={!rated.length ? 'gr' : defects.length ? 'bad' : 'ok'}>
              {rated.length ? defects.length : '—'}
            </span>
          }
          tone={defects.length ? 'alert' : undefined}
          detail={rated.length ? 'a 3 or below' : 'nothing to count'}
          hint="The ones scored 3 or below"
          onClick={() => openChecks('defect')}
        />
        <Kpi
          title="Clean"
          value={
            <span className={rated.length ? 'ok' : 'gr'}>{rated.length ? clean.length : '—'}</span>
          }
          detail={
            rated.length
              ? `${Math.round((clean.length / rated.length) * 100)}% straight fives`
              : 'never rated in this range'
          }
          hint="The ones with nothing raised"
          onClick={() => openChecks('clean')}
        />
        <Kpi
          title="Ratings they gave"
          value={given.length || '—'}
          detail={gavg !== null ? `averaging ${gavg.toFixed(2)}` : 'not a QC role'}
          hint="What they raised on other people"
          onClick={() => openChecks('gave')}
        />
      </Kpis>

      {loading ? (
        <Card style={{ marginTop: 16 }}>
          <div className="cb">
            <SkeletonRows rows={5} cols={4} />
          </div>
        </Card>
      ) : rated.length ? (
        <>
          {reasons.length ? (
            <>
              <SectionHead>Why marks came off</SectionHead>
              <Card>
                <Rows bare>
                  {reasons.map(([why, n]) => (
                    <div className="rw" key={why}>
                      <span className={n > 1 ? 'warn' : 'gr'} style={{ fontSize: '14.5px' }}>
                        {n > 1 ? '⚑' : '·'}
                      </span>
                      <span>
                        <b>{why}</b>
                        {n > 1 ? <div className="sd warn">{n} times — a habit, not a slip</div> : null}
                      </span>
                      <span className="mono gr">{n}</span>
                    </div>
                  ))}
                </Rows>
              </Card>
            </>
          ) : (
            <Card padded style={{ marginTop: 16 }}>
              <p className="gr" style={{ fontSize: '12.5px', margin: 0 }}>
                Every rating in this range was a straight 5 on all three criteria.
              </p>
            </Card>
          )}

          <SectionHead>Every rating — {range.label}</SectionHead>
          <RatingsTable rows={rated} cols="40px 105px 150px 130px 110px 1fr 140px" min={920} />
        </>
      ) : (
        <Card padded style={{ marginTop: 16 }}>
          <p className="gr" style={{ fontSize: '12.5px', margin: 0 }}>
            No ratings in this range. Either their work was not checked, or they do not do work that
            gets checked.
          </p>
        </Card>
      )}

      {given.length && gavg !== null ? (
        <>
          <SectionHead>As a checker — {given.length} ratings given</SectionHead>
          <Card padded>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 10 }}>
              <b className="mono" style={{ fontSize: '23px' }}>
                {gavg.toFixed(2)}
              </b>
              <span className="gr">
                average given, against {teamAvg.toFixed(2)} across everyone
              </span>
            </div>
            <Bar
              value={Math.min(100, Math.round((gavg / 5) * 100))}
              max={100}
              color={Math.abs(gavg - teamAvg) > 0.06 ? 'var(--warn)' : 'var(--ok)'}
            />
            <p className="gr" style={{ fontSize: '12.5px', marginTop: 12 }}>
              {Math.abs(gavg - teamAvg) <= 0.06 ? (
                'They mark in line with everyone else, so their scores can be compared with anyone’s.'
              ) : gavg > teamAvg ? (
                <>
                  They mark <b>{(gavg - teamAvg).toFixed(2)} higher</b> than the company average. Work
                  they check will look better than the same work checked by someone else — worth
                  knowing before comparing two people’s scores.
                </>
              ) : (
                <>
                  They mark <b>{(teamAvg - gavg).toFixed(2)} lower</b> than the company average. Anyone
                  they check will look worse than the same work checked by someone else.
                </>
              )}
            </p>
            <p className="gr" style={{ fontSize: '12.5px' }}>
              On a scale where almost everything is a 5, who checks the work can matter more than who
              did it.
            </p>
          </Card>
        </>
      ) : null}
    </>
  )

  const held = role ? role.p : []

  const accessTab = (
    <>
      <div className="two" style={{ marginTop: 16 }}>
        <Card padded>
          <Label>Role</Label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '8px 0 4px' }}>
            <Chip kind={person.r === 'admin' ? 'b' : person.r === 'staff' ? 'n' : 'r'}>
              {roleName(person.r)}
            </Chip>
            <span className="gr" style={{ fontSize: '12.5px' }}>
              {role ? role.desc : 'role no longer exists'}
            </span>
          </div>
          <Rows bare style={{ marginTop: 10 }}>
            {perms.map((x) => {
              const has = held.includes(x.k)
              return (
                <div className="rw" key={x.k}>
                  <span className={has ? 'ok' : 'gr'} style={{ fontSize: '13.5px' }}>
                    {has ? '✓' : '·'}
                  </span>
                  <span>
                    <b className={has ? '' : 'gr'}>{x.n}</b>
                    {x.never ? <div className="sd gr">nobody holds this</div> : null}
                  </span>
                  <span />
                </div>
              )
            })}
          </Rows>
          <p className="gr" style={{ fontSize: '12.5px', marginTop: 12 }}>
            These come from the role, not from the person. Change them under{' '}
            <button
              type="button"
              className="lnk"
              onClick={() => navigate({ to: '/company', search: { tab: 'Roles' } })}
            >
              Company → Roles
            </button>{' '}
            and everyone holding the role moves with it.
          </p>
        </Card>

        <Card padded>
          <Label>Departments — what they can be assigned</Label>
          {STAGES.map((d) => {
            const inIt = person.dep.includes(d)
            return (
              <div className="rw" style={{ padding: '9px 0' }} key={d}>
                <span className={inIt ? 'ok' : 'gr'} style={{ fontSize: '13.5px' }}>
                  {inIt ? '✓' : '·'}
                </span>
                <span>
                  <b className={inIt ? '' : 'gr'}>{d}</b>
                  <div className="sd gr">
                    {inIt
                      ? ASSIGN_STAGES.includes(d)
                        ? 'eligible for automatic assignment'
                        : 'assigned by hand when needed'
                      : 'not eligible'}
                  </div>
                </span>
                <span />
              </div>
            )
          })}
          <p className="gr" style={{ fontSize: '12.5px', marginTop: 10 }}>
            Department decides what work can reach them; the role decides what they can see and do.
          </p>
        </Card>
      </div>

      <Card padded style={{ marginTop: 16 }}>
        <Label>Account</Label>
        <Rows bare>
          <Row
            icon={<span className="gr">·</span>}
            title="Daily target"
            detail={`${person.cap} stages — the engine stops offering work at this number`}
            right={
              <Btn variant="ghost" small onClick={() => editStaff(person.id)}>
                Change
              </Btn>
            }
          />
          <Row
            icon={<span className="gr">·</span>}
            title="Availability"
            detail={`${AVAIL[person.avail][0]}${
              person.avail !== 'ok' ? ' — the engine skips them entirely' : ''
            }`}
            right={
              <Btn variant="ghost" small onClick={() => editStaff(person.id)}>
                Change
              </Btn>
            }
          />
          <Row
            icon={<span className={dis ? 'bad' : 'ok'}>{dis ? '⚑' : '✓'}</span>}
            title={dis ? 'Disabled' : 'Active'}
            detail={
              dis
                ? 'Takes no new work. History is kept.'
                : 'Counted in capacity and eligible for assignment.'
            }
            right={
              <Btn variant="ghost" small onClick={() => editStaff(person.id)}>
                {dis ? 'Re-enable' : 'Disable'}
              </Btn>
            }
          />
        </Rows>
        <p className="gr" style={{ fontSize: '12.5px', marginTop: 12 }}>
          Disabling keeps every rating and every hour they worked. Deleting a person would silently
          rewrite the reports they appear in, which is why it is not offered.
        </p>
      </Card>
    </>
  )

  return (
    <>
      <PageHead
        parent={{ to: '/company', search: { tab: 'Staff' }, label: 'Staff' }}
        title={person.n}
        sub={`${person.dep.join(', ') || 'no department'} · ${roleName(person.r)}`}
        actions={
          <>
            <Btn
              variant="ghost"
              onClick={() =>
                navigate({ to: '/reports', search: { tab: 'By staff', sw: person.id } })
              }
            >
              In workload
            </Btn>
            <Btn onClick={() => editStaff(person.id)}>Edit details</Btn>
          </>
        }
      />

      {head}

      <div style={{ marginTop: 16 }}>
        <Tabs tabs={[...TABS]} value={tab} onChange={setTab} />
      </div>

      {tab === 'Overview' ? overview : null}
      {tab === 'Work' ? workTab : null}
      {tab === 'Quality' ? qualityTab : null}
      {tab === 'Access' ? accessTab : null}
    </>
  )
}
