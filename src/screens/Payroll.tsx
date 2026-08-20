import { useReducer, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import {
  Assumption,
  Avatar,
  Btn,
  Card,
  Chip,
  Kpi,
  Kpis,
  Label,
  PageHead,
  SectionHead,
  Tabs,
} from '@/components/ui'
import { RequireCap } from '@/components/RequireCap'
import { useSession } from '@/state/session'
import { useUi } from '@/state/ui'
import { PAYCFG, PAYMONTHS, PAYRUNS, RUNSTATE, RUNSTEPS } from '@/data/hrms'
import { STAFF } from '@/data/people'
import {
  inr,
  nextRunAction,
  paidStaff,
  payTotals,
  settlement,
  stepIndex,
  type PayTotals,
} from '@/lib/payroll'
import { fmtDate, initials } from '@/lib/format'
import { csvName, downloadCSV } from '@/lib/csv'
import type { Person, RunState } from '@/data/types'

/**
 * Payroll.
 *
 * Four different jobs happen here — running the month, reading the register,
 * remitting what is owed, and settling anyone leaving. Stacked, the checks that
 * stop a run sat above a 28-row table and were scrolled past, so each gets a tab
 * and the count of things to check sits on the first one.
 *
 * Nothing on any of them is stored. Every figure is built from one number per
 * person — their CTC — and this month's attendance, so there is no second set of
 * numbers to fall out of step with the payslips.
 */

type Tab = 'The run' | 'Register' | 'Cost and statutory' | 'Leavers'

const REGISTER_COLS = '180px 100px 90px 120px 100px 90px 90px 110px 120px'

function Payroll() {
  const navigate = useNavigate()
  const { me } = useSession()
  const { toast, openModal, closeModal } = useUi()

  const [, changed] = useReducer((n: number) => n + 1, 0)
  const [month, setMonth] = useState(PAYMONTHS[PAYMONTHS.length - 1])
  const [tab, setTab] = useState<Tab>('The run')

  const run = PAYRUNS[month]
  const totals = payTotals(month)

  /* Three ways a person cannot be paid properly, and they are not the same. No
     salary leaves them out of the run; no bank account produces a payslip with
     nowhere to send the money; no joining date pays a full month regardless. */
  const noCtc = STAFF.filter((x) => x.active !== false && !x.ctc)
  const noBank = paidStaff().filter((x) => !x.bank || !x.bank.acct)
  const noDoj = paidStaff().filter((x) => !x.doj)
  const leavers = paidStaff().filter((p) => p.leaving)

  const checks = noCtc.length + noBank.length + noDoj.length + totals.lop.length
  const blockers = noCtc.length + noBank.length
  const step = stepIndex(run.state)
  const action = nextRunAction(run.state)

  const TABS: [Tab, number | null][] = [
    ['The run', checks || null],
    ['Register', null],
    ['Cost and statutory', null],
    ['Leavers', leavers.length || null],
  ]

  const sub =
    tab === 'The run'
      ? `${month} · ${RUNSTATE[run.state][0]} · ${paidStaff().length} people on the payroll`
      : tab === 'Register'
        ? `${month} · every figure built from CTC and this month's attendance`
        : tab === 'Cost and statutory'
          ? `${month} · what the month costs, and what has to be remitted`
          : `Full and final settlement for anyone whose last day falls in ${month}`

  const openPerson = (id: string) => navigate({ to: '/staff/$personId', params: { personId: id } })

  /* The month travels with it, so a slip opened from June's run is June's slip. */
  const openPayslip = (id: string) =>
    navigate({ to: '/payslips/$personId', params: { personId: id }, search: { m: month } })

  const setState = (to: RunState) => {
    run.state = to
    if (to === 'paid') run.published = true
    closeModal()
    changed()
    toast(`${month} — ${RUNSTATE[to][0]}`)
  }

  /* ── the three gates ───────────────────────────────────────────────────── */

  const lockRun = () =>
    openModal({
      title: `Lock attendance for ${month}?`,
      body: (
        <>
          <p style={{ fontSize: '13.5px' }}>
            Attendance is frozen at today’s figures. Payroll is then computed against a fixed set of
            numbers rather than a moving one.
          </p>
          {noCtc.length ? (
            <div className="bnr r" style={{ margin: '12px 0 0' }}>
              <span className="bi">⚠</span>
              <div>
                <b>
                  {noCtc.length} active {noCtc.length === 1 ? 'person has' : 'people have'} no salary set
                </b>{' '}
                and will not be paid at all this month. Locking does not stop you fixing that, but it is
                easier to fix now.
              </div>
            </div>
          ) : null}
          <p className="gr" style={{ fontSize: '12.5px', marginTop: 12 }}>
            {totals.list.length} people · gross {inr(totals.gross)} · net {inr(totals.net)}.
          </p>
        </>
      ),
      footer: (
        <>
          <Btn variant="ghost" onClick={closeModal}>
            Not yet
          </Btn>
          <Btn onClick={() => setState('locked')}>Lock it</Btn>
        </>
      ),
    })

  /**
   * Approving closes the month to edits, so it asks for a typed name.
   *
   * Not friction for its own sake: reopening an approved month should need a
   * reason and leave a trace, and a single button does not distinguish a
   * deliberate act from a misclick.
   */
  const approveRun = () =>
    openModal({
      title: `Approve ${month} payroll?`,
      body: (
        <ApproveForm
          expected={me.n}
          totals={totals}
          onApprove={() => {
            run.by = me.n
            run.at = fmtDate(new Date())
            setState('approved')
          }}
          onCancel={closeModal}
        />
      ),
    })

  const publishRun = () =>
    openModal({
      title: `Publish ${totals.list.length} payslips?`,
      body: (
        <>
          <p style={{ fontSize: '13.5px' }}>
            Every person on the run can see their {month} payslip from their own account, immediately.
          </p>
          <p className="gr" style={{ fontSize: '12.5px' }}>
            The bank file becomes available at the same time — {inr(totals.net)} across{' '}
            {totals.list.length} accounts, drawn on {PAYCFG.bankName}.
          </p>
        </>
      ),
      footer: (
        <>
          <Btn variant="ghost" onClick={closeModal}>
            Cancel
          </Btn>
          <Btn onClick={() => setState('paid')}>Publish</Btn>
        </>
      ),
    })

  const advance = () => {
    if (run.state === 'draft') return lockRun()
    if (run.state === 'locked') return approveRun()
    if (run.state === 'approved') return publishRun()
  }

  /* ── exports ───────────────────────────────────────────────────────────── */

  const exportCsv = (name: string, rows: (string | number)[][], noun: string) => {
    const out = downloadCSV(csvName(`${name}-${month.replace(' ', '-')}`), rows)
    toast(`${out.name} — ${out.rows.length - 1} ${noun}`)
  }

  const exportRegister = () =>
    exportCsv(
      'payroll-register',
      [
        ['Name', 'Department', 'Unpaid days', 'Gross', 'PF', 'PT', 'ESI', 'TDS', 'Net pay'],
        ...totals.list.map((x) => [
          x.p.n,
          x.p.dep[0] ?? '',
          x.lopDays,
          x.gross,
          x.epf,
          x.pt,
          x.esi,
          x.tds,
          x.net,
        ]),
      ],
      'people',
    )

  const exportBankFile = () =>
    exportCsv(
      'bank-file',
      [
        ['Beneficiary', 'Account', 'IFSC', 'Amount', 'Narration'],
        ...totals.list
          .filter((x) => x.p.bank?.acct)
          .map((x) => [x.p.bank.name, x.p.bank.acct, x.p.bank.ifsc, x.net, `Salary ${month}`]),
      ],
      'credits',
    )

  /** The four statutory returns, each with the columns its portal asks for. */
  const STATUTORY: [label: string, name: string, header: string[], row: (x: PayTotals['list'][0]) => (string | number)[]][] =
    [
      [
        'PF ECR',
        'pf-ecr',
        ['UAN', 'Name', 'Gross wages', 'EPF wages', 'Employee share', 'Employer share'],
        (x) => [x.p.uan, x.p.n, x.gross, x.st.pfWage, x.epf, x.st.epfEr],
      ],
      [
        'ESI return',
        'esi-return',
        ['ESIC number', 'Name', 'Days', 'Gross wages', 'Employee contribution'],
        (x) => [x.p.esicNo, x.p.n, x.p.doj ? 26 - x.lopDays : 26, x.gross, x.esi],
      ],
      [
        'PT challan',
        'pt-challan',
        ['Name', 'State', 'Gross', 'Professional tax'],
        (x) => [x.p.n, PAYCFG.ptState, x.gross, x.pt],
      ],
      [
        'Form 24Q',
        'form-24q',
        ['PAN', 'Name', 'Gross salary', 'Tax deducted'],
        (x) => [x.p.pan, x.p.n, x.gross, x.tds],
      ],
    ]

  return (
    <>
      <PageHead
        title="Payroll"
        sub={sub}
        actions={
          <>
            <Btn variant="ghost" onClick={() => navigate({ to: '/company' })}>
              Settings
            </Btn>
            {tab === 'Register' ? (
              <Btn variant="ghost" onClick={exportRegister}>
                Export register
              </Btn>
            ) : null}
            {tab === 'The run' && run.state === 'paid' ? (
              <Btn onClick={exportBankFile}>Bank file</Btn>
            ) : null}
          </>
        }
      />

      <div className="fbar" role="group" aria-label="Payroll month">
        {PAYMONTHS.map((m) => {
          const r = PAYRUNS[m]
          return (
            <button
              key={m}
              type="button"
              className={`pill ${month === m ? 'on' : ''}`}
              aria-pressed={month === m}
              onClick={() => setMonth(m)}
            >
              {m} <Chip kind={RUNSTATE[r.state][1]}>{RUNSTATE[r.state][0]}</Chip>
            </button>
          )
        })}
      </div>

      <Tabs tabs={TABS} value={tab} onChange={setTab} />

      {tab === 'The run' ? (
        <>
          <div className={`bnr ${run.state === 'paid' ? 'v' : run.state === 'approved' ? 'b' : 'r'}`}>
            <span className="bi">{run.state === 'paid' ? '✓' : '◷'}</span>
            <div>
              <div className="bt">
                {month} — {RUNSTATE[run.state][0]}
              </div>
              {RUNSTATE[run.state][2]}
              {run.by && run.state !== 'draft' ? ` Approved by ${run.by}.` : ''}
            </div>
            {action ? (
              <div className="ba">
                <Btn onClick={advance}>{action[0]}</Btn>
              </div>
            ) : null}
          </div>

          <Card padded style={{ marginTop: 16 }}>
            <Label>The month, step by step</Label>
            <div style={{ display: 'flex', gap: 0, marginTop: 12, flexWrap: 'wrap' }}>
              {RUNSTEPS.map((s, i) => {
                const done = i < step
                const nowAt = i === step
                return (
                  <button
                    key={s[0]}
                    type="button"
                    className={`step ${done ? 'done' : nowAt ? 'now' : ''}`}
                    title={
                      done
                        ? `Open what ${s[0].toLowerCase()} produced`
                        : nowAt
                          ? `What ${s[0].toLowerCase()} needs`
                          : 'Not yet — what has to happen first'
                    }
                    onClick={() => {
                      if (i <= 1) setTab('Register')
                      else if (i === 2) setTab('The run')
                      else if (action) advance()
                      else setTab('Register')
                    }}
                  >
                    <span className="sh">
                      <span
                        className="sn"
                        style={{
                          background: done ? 'var(--ok)' : nowAt ? 'var(--brand)' : 'var(--rail)',
                          color: done || nowAt ? '#fff' : 'var(--gr)',
                        }}
                      >
                        {done ? '✓' : i + 1}
                      </span>
                      <b style={{ fontSize: '13.5px', color: done || nowAt ? 'var(--ink)' : 'var(--gr)' }}>
                        {s[0]}
                      </b>
                    </span>
                    <span className="gr sd2">{s[1]}</span>
                  </button>
                )
              })}
            </div>
          </Card>

          <Kpis style={{ marginTop: 16 }}>
            <Kpi
              title="On the payroll"
              value={totals.list.length}
              tone={blockers ? 'alert' : undefined}
              detail={
                blockers ? (
                  <span className="bad">{blockers} cannot be paid yet</span>
                ) : (
                  'all payable'
                )
              }
              onClick={() => setTab('Register')}
            />
            <Kpi
              title="Gross earnings"
              value={inr(totals.gross)}
              detail="before deductions"
              onClick={() => setTab('Register')}
            />
            <Kpi
              title="Deductions"
              value={<span className="warn">{inr(totals.ded)}</span>}
              detail={`PF ${inr(totals.pf)} · PT ${inr(totals.pt)} · TDS ${inr(totals.tds)}`}
              onClick={() => setTab('Cost and statutory')}
            />
            <Kpi
              title="Net payable"
              value={<span className="ok">{inr(totals.net)}</span>}
              detail={`to ${totals.list.length} bank accounts`}
              onClick={() => setTab('Register')}
            />
          </Kpis>

          {checks ? (
            <>
              <SectionHead>Check these before approving — {checks}</SectionHead>
              <Card>
                <div className="rows" style={{ border: 'none', borderRadius: 0 }}>
                  {noBank.map((p) => (
                    <Check
                      key={`bank-${p.id}`}
                      bad
                      title={`${p.n} has no bank account on record`}
                      detail="Their payslip is produced and their money has nowhere to go. They are left out of the bank file rather than paid to a made-up account."
                      action="Add account"
                      onAction={() => openPerson(p.id)}
                    />
                  ))}
                  {noDoj.map((p) => (
                    <Check
                      key={`doj-${p.id}`}
                      title={`${p.n} has no joining date`}
                      detail="They are paid a full month even if they joined halfway through it, and gratuity cannot be worked out at all."
                      action="Set date"
                      onAction={() => openPerson(p.id)}
                    />
                  ))}
                  {noCtc.map((p) => (
                    <Check
                      key={`ctc-${p.id}`}
                      bad
                      title={`${p.n} has no salary on record`}
                      detail="They are active and assigned work, but there is nothing to pay. They are left out of the run entirely, which is worse than being paid wrong."
                      action="Set salary"
                      onAction={() => openPerson(p.id)}
                    />
                  ))}
                  {totals.lop.map((x) => (
                    <Check
                      key={`lop-${x.p.id}`}
                      title={`${x.p.n} — ${x.lopDays} unpaid day${x.lopDays === 1 ? '' : 's'}`}
                      detail={`${inr(x.lopAmt)} withheld from a gross of ${inr(x.st.gross)}. Confirm the days are right before this becomes a payslip.`}
                      action="Payslip"
                      onAction={() => openPayslip(x.p.id)}
                    />
                  ))}
                </div>
              </Card>
            </>
          ) : (
            <Card padded style={{ marginTop: 16 }}>
              <p className="gr" style={{ fontSize: '12.5px', margin: 0 }}>
                Nothing to check — every active person has a salary, and nobody has unpaid days this
                month.
              </p>
            </Card>
          )}
        </>
      ) : null}

      {tab === 'Register' ? (
        <>
          <SectionHead>The register — {totals.list.length} people</SectionHead>
          <Card>
            <div className="tsc">
              <div style={{ minWidth: 1060 }}>
                <div className="trow h" style={{ gridTemplateColumns: REGISTER_COLS }}>
                  <span>Name</span>
                  <span>Department</span>
                  <span>LOP</span>
                  <span>Gross</span>
                  <span>PF</span>
                  <span>PT</span>
                  <span>ESI</span>
                  <span>TDS</span>
                  <span>Net pay</span>
                </div>
                <div className="tb">
                  {totals.list.map((x) => (
                    <div
                      key={x.p.id}
                      className="trow"
                      role="button"
                      tabIndex={0}
                      onClick={() => openPayslip(x.p.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') openPayslip(x.p.id)
                      }}
                      style={{ gridTemplateColumns: REGISTER_COLS }}
                    >
                      <div className="cell">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <Avatar name={x.p.n} />
                          <div className="v">{x.p.n}</div>
                        </div>
                      </div>
                      <div className="cell">
                        <div className="v gr" style={{ fontSize: '12.5px' }}>
                          {x.p.dep[0] ?? '—'}
                        </div>
                      </div>
                      <div className="cell">
                        <div className={`v mono ${x.lopDays ? 'warn' : 'gr'}`}>{x.lopDays || '—'}</div>
                      </div>
                      <div className="cell">
                        <div className="v mono">{inr(x.gross)}</div>
                        {x.lopDays ? <div className="s warn">−{inr(x.lopAmt)}</div> : null}
                      </div>
                      <div className="cell">
                        <div className="v mono">{inr(x.epf)}</div>
                      </div>
                      <div className="cell">
                        <div className="v mono">{inr(x.pt)}</div>
                      </div>
                      <div className="cell">
                        <div className={`v mono ${x.esi ? '' : 'gr'}`}>{x.esi ? inr(x.esi) : '—'}</div>
                      </div>
                      <div className="cell">
                        <div className={`v mono ${x.tds ? '' : 'gr'}`}>{x.tds ? inr(x.tds) : '—'}</div>
                      </div>
                      <div className="cell">
                        <div className="v mono ok" style={{ fontWeight: 650 }}>
                          {inr(x.net)}
                        </div>
                      </div>
                    </div>
                  ))}
                  <div
                    className="trow"
                    style={{ gridTemplateColumns: REGISTER_COLS, background: 'var(--tint)' }}
                  >
                    <div className="cell">
                      <div className="v" style={{ fontWeight: 700 }}>
                        Total
                      </div>
                    </div>
                    <div className="cell" />
                    <div className="cell">
                      <div className="v mono">{totals.list.reduce((a, x) => a + x.lopDays, 0)}</div>
                    </div>
                    <div className="cell">
                      <div className="v mono" style={{ fontWeight: 700 }}>
                        {inr(totals.gross)}
                      </div>
                    </div>
                    <div className="cell">
                      <div className="v mono">{inr(totals.pf)}</div>
                    </div>
                    <div className="cell">
                      <div className="v mono">{inr(totals.pt)}</div>
                    </div>
                    <div className="cell">
                      <div className="v mono">{inr(totals.esi)}</div>
                    </div>
                    <div className="cell">
                      <div className="v mono">{inr(totals.tds)}</div>
                    </div>
                    <div className="cell">
                      <div className="v mono ok" style={{ fontWeight: 700 }}>
                        {inr(totals.net)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Card>
          <p className="gr" style={{ fontSize: '12.5px', marginTop: 10 }}>
            Every figure comes from the person’s CTC and this month’s attendance. Change either and the
            register moves — there is no separately stored salary to fall out of step.
          </p>
        </>
      ) : null}

      {tab === 'Cost and statutory' ? (
        <div className="two">
          <Card padded>
            <Label>What this costs the company</Label>
            {(
              [
                ['Gross earnings', totals.gross],
                ['Provident fund — employer', totals.erpf],
                ['Gratuity provisioned', totals.grat],
              ] as [string, number][]
            ).map(([label, v]) => (
              <Line key={label} label={label} value={inr(v)} />
            ))}
            <div
              style={{ display: 'flex', justifyContent: 'space-between', padding: '11px 0 0', fontSize: '14.5px' }}
            >
              <b>Total cost</b>
              <b className="mono">{inr(totals.gross + totals.erpf + totals.grat)}</b>
            </div>
            <p className="gr" style={{ fontSize: '12.5px', marginTop: 12 }}>
              Net pay is what lands in accounts; this is what the month actually costs. The difference is
              the employer’s own contributions.
            </p>
          </Card>

          <Card padded>
            <Label>Statutory to remit</Label>
            {(
              [
                ['Provident fund — employee + employer', totals.pf + totals.erpf, 'EPFO, by the 15th'],
                ['ESI — employee share', totals.esi, 'ESIC, by the 15th'],
                ['Professional tax', totals.pt, `${PAYCFG.ptState}, monthly`],
                ['TDS on salary', totals.tds, 'by the 7th of next month'],
              ] as [string, number, string][]
            ).map(([label, v, when]) => (
              <div className="rw" key={label} style={{ padding: '9px 0' }}>
                <span className="gr">·</span>
                <span>
                  <b>{label}</b>
                  <div className="sd gr">{when}</div>
                </span>
                <span className="mono">{inr(v)}</span>
              </div>
            ))}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
              {STATUTORY.map(([label, name, header, row]) => (
                <Btn
                  key={label}
                  variant="ghost"
                  small
                  onClick={() => exportCsv(name, [header, ...totals.list.map(row)], 'people')}
                >
                  {label}
                </Btn>
              ))}
            </div>
            <Assumption title="These are the right figures in the right shape, not portal-ready files">
              Each downloads with the columns the corresponding portal asks for, from the same run the
              register came from. <b>The exact file layouts change, and each portal has its own
              validator</b> — have whoever files your returns run one through before you rely on it.
            </Assumption>
          </Card>
        </div>
      ) : null}

      {tab === 'Leavers' ? (
        leavers.length ? (
          leavers.map((p) => <Leaver key={p.id} p={p} onOpen={() => openPerson(p.id)} />)
        ) : (
          <Card padded>
            <p className="gr" style={{ fontSize: '13.5px', margin: 0 }}>
              Nobody is leaving this month. When someone is, their settlement is computed here from their
              joining date, leave balance and any advance outstanding — not worked out separately on a
              spreadsheet.
            </p>
          </Card>
        )
      ) : null}
    </>
  )
}

/** One line of a cost or statutory breakdown. */
function Line({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        padding: '7px 0',
        fontSize: '13.5px',
        borderBottom: '1px solid var(--hair)',
      }}
    >
      <span className="gr">{label}</span>
      <b className="mono">{value}</b>
    </div>
  )
}

/** Something that has to be fixed, or knowingly accepted, before approving. */
function Check({
  bad,
  title,
  detail,
  action,
  onAction,
}: {
  bad?: boolean
  title: string
  detail: string
  action: string
  onAction: () => void
}) {
  return (
    <div className="rw">
      <span className={bad ? 'bad' : 'warn'} style={{ fontSize: '14.5px' }}>
        {bad ? '⚑' : '◷'}
      </span>
      <span>
        <b>{title}</b>
        <div className="sd">{detail}</div>
      </span>
      <span>
        <Btn variant="ghost" small onClick={onAction}>
          {action}
        </Btn>
      </span>
    </div>
  )
}

/** Full and final settlement for one person. */
function Leaver({ p, onOpen }: { p: Person; onOpen: () => void }) {
  const f = settlement(p, p.leaving)
  return (
    <Card padded style={{ marginBottom: 14 }}>
      <div className="ch" style={{ border: 'none', padding: '0 0 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            type="button"
            className="ava"
            style={{ width: 34, height: 34, fontSize: '13.5px' }}
            onClick={onOpen}
          >
            {initials(p.n)}
          </button>
          <div>
            <b style={{ fontSize: '14.5px' }}>{p.n}</b>
            <div className="gr" style={{ fontSize: '12.5px' }}>
              {p.dep.join(', ')} · joined {p.doj || '—'} · last day{' '}
              {p.leaving ? fmtDate(p.leaving) : '—'}
            </div>
          </div>
        </div>
        <div className="r">
          <Chip kind="r">Full and final</Chip>
        </div>
      </div>
      {f.lines.map(([label, v]) => (
        <div
          key={label}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            padding: '7px 0',
            fontSize: '13.5px',
            borderBottom: '1px solid var(--hair)',
          }}
        >
          <span className="gr">{label}</span>
          <b className={`mono ${v < 0 ? 'warn' : ''}`}>
            {v < 0 ? '−' : ''}
            {inr(Math.abs(v))}
          </b>
        </div>
      ))}
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '11px 0 0', fontSize: '14.5px' }}>
        <b>Payable</b>
        <b className="mono ok">{inr(f.total)}</b>
      </div>
      {f.yrs === null ? (
        <div className="bnr d" style={{ marginTop: 12 }}>
          <span className="bi">⚑</span>
          <div>
            <b>No joining date, so gratuity cannot be worked out.</b> It is not zero — it is unknown,
            which is worse.
          </div>
        </div>
      ) : f.yrs < 5 ? (
        <p className="gr" style={{ fontSize: '12.5px', marginTop: 10 }}>
          {f.yrs.toFixed(1)} years served. Gratuity becomes payable at five, so none is due — this is the
          rule, not a rounding.
        </p>
      ) : (
        <p className="gr" style={{ fontSize: '12.5px', marginTop: 10 }}>
          {Math.floor(f.yrs)} completed years at fifteen days of last-drawn basic, which is what the Act
          provides.
        </p>
      )}
    </Card>
  )
}

/** Approving asks for a typed name, so it cannot be a misclick. */
function ApproveForm({
  expected,
  totals,
  onApprove,
  onCancel,
}: {
  expected: string
  totals: PayTotals
  onApprove: () => void
  onCancel: () => void
}) {
  const [typed, setTyped] = useState('')
  const [error, setError] = useState<string | null>(null)

  return (
    <>
      <div className="bnr d" style={{ margin: '0 0 12px' }}>
        <span className="bi">⚑</span>
        <div>
          <div className="bt">After this the month is closed to edits</div>
          {totals.list.length} people, {inr(totals.net)} net. Reopening an approved month should need a
          reason and leave a trace — which is why it is not simply a button.
        </div>
      </div>
      {totals.lop.length ? (
        <p style={{ fontSize: '13.5px' }}>
          <b>{totals.lop.length}</b> {totals.lop.length === 1 ? 'person has' : 'people have'} unpaid days.
          Confirm those are right — this is the last easy moment.
        </p>
      ) : null}
      <div className="fld">
        <label htmlFor="apName">Type your name to approve</label>
        <input
          className="inp"
          id="apName"
          placeholder={expected}
          value={typed}
          onChange={(e) => {
            setTyped(e.target.value)
            setError(null)
          }}
        />
      </div>
      {error ? (
        <div className="bnr r" style={{ margin: 0 }}>
          <span className="bi">⚠</span>
          <div>{error}</div>
        </div>
      ) : null}
      <div className="mf" style={{ marginTop: 16 }}>
        <Btn variant="ghost" onClick={onCancel}>
          Cancel
        </Btn>
        <Btn
          onClick={() => {
            if (typed.trim() !== expected) {
              setError(`Type ${expected} exactly. Approving payroll should take a deliberate act.`)
              return
            }
            onApprove()
          }}
        >
          Approve
        </Btn>
      </div>
    </>
  )
}

export default function PayrollRoute() {
  return (
    <RequireCap cap="pricing">
      <Payroll />
    </RequireCap>
  )
}
