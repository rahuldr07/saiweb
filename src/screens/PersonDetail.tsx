import { useMemo, useState } from 'react'
import { useNavigate, useParams } from '@tanstack/react-router'
import {
  Avatar,
  Bar,
  Banner,
  Btn,
  Card,
  CardBody,
  CardHead,
  Chip,
  Empty,
  KeyValues,
  Kpi,
  Kpis,
  NotFoundRecord,
  PageHead,
  Rows,
  Tabs,
} from '@/components/ui'
import { SkeletonRows, SkeletonValue } from '@/components/async'
import { useSession } from '@/state/session'
import { AVAIL, STAFF } from '@/data/people'
import { ROLELIST } from '@/data/org'
import { board } from '@/lib/engine'
import { covSummary, levelOf } from '@/lib/coverage'
import { inr, leaveBalance, structureOf, yearsServed } from '@/lib/payroll'
import { ONTIMETARGET } from '@/lib/metrics'
import { useDeliveries } from '@/lib/useDeliveries'
import { roleName } from '@/lib/permissions'

const TABS = ['Work', 'Coverage', 'Leave', 'Employment'] as const
type Tab = (typeof TABS)[number]

/**
 * One person: what they are carrying today, what they are qualified to take,
 * where their leave stands, and their employment record.
 *
 * Two rules the design is firm about, and this screen keeps:
 *
 *  - Personal performance is measured against a target, never against a
 *    colleague. There is no ranking on this screen and no comparison to peers.
 *  - The employment record — bank, PAN, Aadhaar, salary — is not roster
 *    information. It needs `people`, and it is a separate tab rather than
 *    something you scroll past on the way to somebody's workload.
 */
export default function PersonDetail() {
  const { personId } = useParams({ from: '/staff/$personId' })
  const navigate = useNavigate()
  const { me, can } = useSession()
  const [tab, setTab] = useState<Tab>('Work')

  const person = STAFF.find((s) => s.id === personId)
  const history = useDeliveries()

  const mine = useMemo(
    () => (history.data ?? []).filter((d) => Object.values(d.by).includes(personId)),
    [history.data, personId],
  )

  const work = board().work[personId]

  if (!person) {
    return <NotFoundRecord what="person" backTo="/company" backLabel="Company" />
  }

  const isMe = person.id === me.id
  const late = mine.filter((d) => d.late).length
  const onTime = mine.length ? ((mine.length - late) / mine.length) * 100 : null
  const level = levelOf(person.id)
  const structure = person.ctc ? structureOf(person) : null
  const balances = leaveBalance(person.id)
  const served = yearsServed(person)

  /* Somebody's own record is always theirs to see; anyone else's employment
     details need the capability that manages staff. */
  const maySeeEmployment = isMe || can('people')
  const maySeePay = isMe || can('pricing')

  const role = ROLELIST.find((r) => r.id === person.r)

  /* Both come out of the history already fetched for the on-time tile, so this
     costs nothing extra — and a person's page that shows only today is thin for
     exactly the people who are on leave or between orders. */
  const recent = [...mine].sort((a, b) => b.d.getTime() - a.d.getTime()).slice(0, 8)
  const stageMix = Object.entries(
    mine.reduce<Record<string, number>>((acc, d) => {
      for (const [stage, who] of Object.entries(d.by)) {
        if (who === person.id) acc[stage] = (acc[stage] ?? 0) + 1
      }
      return acc
    }, {}),
  ).sort((a, b) => b[1] - a[1])

  return (
    <>
      <PageHead
        parent={{ to: '/company', label: 'Company' }}
        title={person.n}
        sub={
          <>
            {roleName(person.r)} · {person.dep.length ? person.dep.join(', ') : 'No department'} ·{' '}
            <span className="mono">{person.e}</span>
          </>
        }
        actions={
          <>
            <Chip kind={AVAIL[person.avail][1]}>{AVAIL[person.avail][0]}</Chip>
            {person.active === false ? <Chip kind="n">Inactive</Chip> : null}
            {isMe ? <Chip kind="b">You</Chip> : null}
          </>
        }
      />

      {person.avail !== 'ok' ? (
        <Banner kind="r" icon="◷" title={`Not available — ${AVAIL[person.avail][0]}`}>
          The assignment engine skips {isMe ? 'you' : person.n.split(' ')[0]} entirely while this is set, so
          nothing new will be placed today.
        </Banner>
      ) : null}

      <Kpis>
        <Kpi title="On desk today" value={work?.tot ?? 0} detail="stages assigned" />
        <Kpi
          title="Finished today"
          value={<span className="ok">{work?.done ?? 0}</span>}
          detail={`${work?.pct ?? 0}% of them`}
        />
        <Kpi
          title="Daily target"
          value={
            <span className="mono">
              {person.open}/{person.cap}
            </span>
          }
          detail={<Bar value={person.open} max={person.cap} />}
        />
        <Kpi
          title="On time"
          value={
            history.isPending ? (
              <SkeletonValue />
            ) : onTime === null ? (
              '—'
            ) : (
              onTime.toFixed(1) + '%'
            )
          }
          tone={!history.isPending && onTime !== null && onTime < ONTIMETARGET ? 'warn' : undefined}
          detail={`across ${mine.length} delivered`}
        />
      </Kpis>

      <div style={{ marginTop: 20 }}>
        <Tabs tabs={[...TABS]} value={tab} onChange={setTab} />
      </div>

      {tab === 'Work' ? (
        <Card>
          <CardHead
            title="On the desk today"
            actions={
              work?.items.length ? <Chip kind="n">{work.items.length} stages</Chip> : undefined
            }
          />
          {work?.items.length ? (
            <Rows>
              {work.items.map((item, i) => (
                <button
                  key={`${item.o.id}-${item.stage}-${i}`}
                  type="button"
                  className="rw"
                  style={{ width: '100%' }}
                  onClick={() => navigate({ to: '/orders/$orderId', params: { orderId: item.o.id } })}
                >
                  <span className={item.fin ? 'ok' : 'warn'}>{item.fin ? '✓' : '◷'}</span>
                  <span>
                    <b className="mono">{item.o.id}</b>
                    <div className="sd">
                      {item.stage} · {item.o.pr} · {item.o.co}, {item.o.st}
                    </div>
                  </span>
                  <span>
                    <Chip kind={item.fin ? 'v' : 'r'}>{item.fin ? 'Done' : 'In hand'}</Chip>
                  </span>
                </button>
              ))}
            </Rows>
          ) : (
            <Empty
              icon={person.dep.length === 0 ? '⊘' : '◷'}
              action={
                <Btn small onClick={() => navigate({ to: '/assign' })}>
                  Open Assignment
                </Btn>
              }
            >
              {person.dep.length === 0
                ? `${person.n.split(' ')[0]} belongs to no department, so the engine has no stage to give them.`
                : person.avail !== 'ok'
                  ? `Nothing was placed today — ${person.n.split(' ')[0]} is ${AVAIL[person.avail][0].toLowerCase()}, and the engine skips anyone unavailable.`
                  : `Nothing was placed with ${isMe ? 'you' : person.n.split(' ')[0]} today.`}
            </Empty>
          )}
        </Card>
      ) : null}

      {tab === 'Work' ? (
        <div className="two" style={{ marginTop: 16 }}>
          <Card>
            <CardHead title="Recently delivered" />
            {history.isPending ? (
              <CardBody>
                <SkeletonRows rows={4} cols={3} />
              </CardBody>
            ) : recent.length ? (
              <Rows>
                {recent.map((d) => (
                  <div className="rw" key={d.id}>
                    <span className={d.late ? 'bad' : 'ok'}>{d.late ? '⚑' : '✓'}</span>
                    <span>
                      <b className="mono">{d.id}</b>
                      <div className="sd">
                        {d.pr} · {d.cl} ·{' '}
                        {Object.entries(d.by)
                          .filter(([, who]) => who === person.id)
                          .map(([stage]) => stage)
                          .join(', ')}
                      </div>
                    </span>
                    <span className="mono gr" style={{ fontSize: '11.5px' }}>
                      {d.dk}
                    </span>
                  </div>
                ))}
              </Rows>
            ) : (
              <Empty icon="☰">Nothing delivered yet.</Empty>
            )}
          </Card>

          <Card>
            <CardHead
              title="Usually works"
              actions={mine.length ? <Chip kind="n">{mine.length} delivered</Chip> : undefined}
            />
            {history.isPending ? (
              <CardBody>
                <SkeletonRows rows={3} cols={2} />
              </CardBody>
            ) : stageMix.length ? (
              <CardBody>
                {stageMix.map(([stage, n]) => (
                  <div key={stage} style={{ marginBottom: 12 }}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: '12.5px',
                        marginBottom: 4,
                      }}
                    >
                      <span>{stage}</span>
                      <span className="mono gr">{n}</span>
                    </div>
                    <Bar value={n} max={stageMix[0][1]} />
                  </div>
                ))}
                <p className="gr" style={{ fontSize: '11.5px', marginTop: 10 }}>
                  Which stages {person.n.split(' ')[0]} has actually been given, across every delivered
                  order — not the departments they are a member of.
                </p>
              </CardBody>
            ) : (
              <Empty icon="◷">No delivered orders on record yet.</Empty>
            )}
          </Card>
        </div>
      ) : null}

      {tab === 'Coverage' ? (
        <Card>
          <CardHead title="What they may be given" actions={<Chip kind="n">{covSummary(person.id)}</Chip>} />
          <CardBody>
            <KeyValues
              rows={[
                ['Level', level ? `${level.n} — ${level.note}` : 'No level, so nothing is ruled out'],
                [
                  'States',
                  level && level.states !== 'all' ? level.states.join(', ') : 'Every state',
                ],
                [
                  'Counties',
                  level && Object.keys(level.counties ?? {}).length
                    ? Object.entries(level.counties ?? {})
                        .map(([st, cs]) => `${st}: ${cs.join(', ')}`)
                        .join(' · ')
                    : 'Every county in those states',
                ],
                [
                  'Products',
                  level && level.products !== 'all' ? level.products.join(', ') : 'Every product',
                ],
                ['Departments', person.dep.length ? person.dep.join(', ') : 'None'],
                ['Shift', person.shift],
              ]}
            />
            <p className="gr" style={{ fontSize: '12.5px', marginTop: 12 }}>
              Coverage is checked before availability and before load. Somebody who does not cover a county
              was never a candidate for it — the exception says that, rather than blaming the roster.
            </p>
          </CardBody>
        </Card>
      ) : null}

      {tab === 'Leave' ? (
        <Card>
          <CardHead title="Balances" />
          <CardBody>
            <div className="tsc">
              <table className="mat">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th style={{ textAlign: 'right' }}>Earned</th>
                    <th style={{ textAlign: 'right' }}>Taken</th>
                    <th style={{ textAlign: 'right' }}>Pending</th>
                    <th style={{ textAlign: 'right' }}>Left</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(balances).map(([kind, b]) => (
                    <tr key={kind}>
                      <td>{kind.toUpperCase()}</td>
                      <td className="mono" style={{ textAlign: 'right' }}>{b.earned}</td>
                      <td className="mono" style={{ textAlign: 'right' }}>{b.taken}</td>
                      <td className="mono" style={{ textAlign: 'right' }}>{b.pending}</td>
                      <td
                        className="mono"
                        style={{ textAlign: 'right', fontWeight: 600 }}
                      >
                        {b.left}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
      ) : null}

      {tab === 'Employment' ? (
        maySeeEmployment ? (
          <>
            <Card>
              <CardHead
                title="Record"
                actions={served !== null ? <Chip kind="n">{served.toFixed(1)} years</Chip> : undefined}
              />
              <CardBody>
                <KeyValues
                  rows={[
                    ['Employee id', <span className="mono">{person.id}</span>],
                    ['Joined', <span className="mono">{person.doj || 'Not on record'}</span>],
                    ['Date of birth', <span className="mono">{person.dob || 'Not on record'}</span>],
                    ['Mobile', <span className="mono">{person.mob}</span>],
                    ['Address', person.addr],
                    [
                      'Emergency contact',
                      person.emg ? `${person.emg.n} (${person.emg.rel}) · ${person.emg.mob}` : '—',
                    ],
                    ['Role', role ? `${role.n} — ${role.desc}` : person.r],
                    [
                      'Capabilities',
                      role ? (
                        <span style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                          {role.p.map((c) => (
                            <Chip key={c} kind="n" plain>
                              {c}
                            </Chip>
                          ))}
                        </span>
                      ) : (
                        '—'
                      ),
                    ],
                  ]}
                />
              </CardBody>
            </Card>

            <Card style={{ marginTop: 16 }}>
              <CardHead title="Statutory" />
              <CardBody>
                <KeyValues
                  rows={[
                    ['PAN', <span className="mono">{person.pan || '—'}</span>],
                    ['Aadhaar', <span className="mono">{person.aadhaar || '—'}</span>],
                    ['UAN', <span className="mono">{person.uan || '—'}</span>],
                    ['ESIC', <span className="mono">{person.esicNo || '—'}</span>],
                    [
                      'Bank',
                      person.bank
                        ? `${person.bank.name} · ${person.bank.acct} · ${person.bank.ifsc}`
                        : '—',
                    ],
                  ]}
                />
              </CardBody>
            </Card>

            {structure && maySeePay ? (
              <Card style={{ marginTop: 16 }}>
                <CardHead
                  title="Salary structure"
                  actions={<Chip kind="n">{inr(structure.ctc)} CTC</Chip>}
                />
                <CardBody>
                  <KeyValues
                    rows={[
                      ['Monthly', <span className="mono">{inr(structure.monthly)}</span>],
                      ['Basic', <span className="mono">{inr(structure.basic)}</span>],
                      ['House rent allowance', <span className="mono">{inr(structure.hra)}</span>],
                      ['Special allowance', <span className="mono">{inr(structure.special)}</span>],
                      ['Gross', <span className="mono">{inr(structure.gross)}</span>],
                      ['Employer PF', <span className="mono">{inr(structure.epfEr)}</span>],
                      ['Gratuity provision', <span className="mono">{inr(structure.grat)}</span>],
                    ]}
                  />
                  <p className="gr" style={{ fontSize: '12.5px', marginTop: 12 }}>
                    Everything above is derived from the one CTC figure through the 50% wage rule. Nothing
                    here is typed twice, so a payslip cannot disagree with this page.
                  </p>
                </CardBody>
              </Card>
            ) : null}
          </>
        ) : (
          <Card>
            <CardBody>
              <p className="gr">
                Employment records need the “people” capability. Ask a company admin if you should be able
                to see this.
              </p>
            </CardBody>
          </Card>
        )
      ) : null}

      {work?.tot ? (
        <p className="gr" style={{ fontSize: '12.5px', marginTop: 16 }}>
          <Avatar name={person.n} style={{ verticalAlign: '-6px', marginRight: 6 }} />
          Measured against {person.n.split(' ')[0]}’s own target of {person.cap} a day — never against a
          colleague.
        </p>
      ) : null}
    </>
  )
}
