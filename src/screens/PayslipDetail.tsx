import { useNavigate, useParams, useSearch } from '@tanstack/react-router'
import { Assumption, Btn, Card, Label, PageHead } from '@/components/ui'
import { useSession } from '@/state/session'
import { useUi } from '@/state/ui'
import { PAYCFG, PAYMONTHS, PAYRUNS, RUNSTATE } from '@/data/hrms'
import { STAFF } from '@/data/people'
import { inr, inr2, payslipOf, words, ytd } from '@/lib/payroll'
import { roleName } from '@/lib/permissions'
import { csvName, downloadCSV } from '@/lib/csv'

/**
 * One payslip.
 *
 * A document rather than a screen: it states the figures, then explains where
 * each came from, because the questions a payslip actually gets asked are "why
 * is basic that number" and "what is this deduction". Every line is derived from
 * one CTC and one month's attendance, so nothing here is typed in and nothing
 * can disagree with the payroll register.
 *
 * Two things are deliberately refused. Somebody else's slip needs the pricing
 * permission, and an unpublished month is not shown even to its owner — not
 * because it is secret, but because it is not final.
 */

/** A labelled amount, the way both columns of the slip state one. */
function Row({ label, value, tone }: { label: string; value: number; tone?: 'warn' | 'ok' }) {
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
      <b className={`mono ${tone ?? ''}`}>{inr2(value)}</b>
    </div>
  )
}

/** A closing figure under a column, which is not a row and should not look like one. */
function Total({ label, value, tone }: { label: string; value: number; tone?: 'warn' | 'ok' }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '11px 0 0', fontSize: '14.5px' }}>
      <b>{label}</b>
      <b className={`mono ${tone ?? ''}`}>{inr2(value)}</b>
    </div>
  )
}

/** One reason a figure is what it is. */
function Why({ head, detail }: { head: string; detail: string }) {
  return (
    <div className="rw">
      <span className="gr">·</span>
      <span>
        <b>{head}</b>
        <div className="sd gr">{detail}</div>
      </span>
      <span />
    </div>
  )
}

export default function PayslipDetail() {
  const { personId } = useParams({ from: '/payslips/$personId' })
  const { m } = useSearch({ from: '/payslips/$personId' })
  const navigate = useNavigate()
  const { me, tenant, can } = useSession()
  const { toast } = useUi()

  const person = STAFF.find((x) => x.id === personId)
  const month = m && PAYMONTHS.includes(m) ? m : PAYMONTHS[PAYMONTHS.length - 1]
  const mine = person?.id === me.id

  if (!person) {
    return (
      <>
        <PageHead parent={{ to: '/payslips', label: 'Payslips' }} title="No such person" />
        <Card padded style={{ maxWidth: 560 }}>
          <p style={{ fontSize: '13.5px', margin: 0 }}>
            Nobody on the roster has that reference.
          </p>
        </Card>
      </>
    )
  }

  /* Somebody else's pay needs the permission, and saying so beats an empty page. */
  if (!mine && !can('pricing')) {
    return (
      <>
        <PageHead
          parent={{ to: '/mywork', label: 'My work' }}
          title="Not yours to open"
          sub={`${me.n} can only see their own payslips.`}
        />
        <Card padded style={{ maxWidth: 560 }}>
          <p style={{ fontSize: '13.5px', margin: 0 }}>
            Seeing another person’s pay needs the “See pricing and invoices” permission, which your role
            does not have.
          </p>
          <div style={{ marginTop: 14 }}>
            <Btn
              onClick={() =>
                navigate({ to: '/payslips/$personId', params: { personId: me.id }, search: { m: month } })
              }
            >
              Open mine instead
            </Btn>
          </div>
        </Card>
      </>
    )
  }

  const run = PAYRUNS[month]

  /* Not hidden — just not final. An unpublished figure that later moves is worse
     than no figure, so the state is stated instead. */
  if (mine && !run.published) {
    return (
      <>
        <PageHead parent={{ to: '/mypay', label: 'My payslips' }} title={`${month} is not out yet`} />
        <Card padded style={{ maxWidth: 560 }}>
          <p style={{ fontSize: '13.5px', margin: 0 }}>
            {month} payroll is <b>{RUNSTATE[run.state][0].toLowerCase()}</b>. Payslips appear here the
            moment it is published — nothing is hidden from you, it simply is not final.
          </p>
        </Card>
      </>
    )
  }

  const s = payslipOf(person, month)
  const y = ytd(person, month)

  const download = () => {
    const out = downloadCSV(csvName(`payslip-${person.n.replace(/\s+/g, '-')}-${month.replace(' ', '-')}`), [
      ['Payslip', tenant.name, month],
      [],
      ['Employee', person.n],
      ['Employee ID', person.id.toUpperCase()],
      ['Department', person.dep.join(', ')],
      ['Working days', s.a.working],
      ['Paid leave', s.a.paidLeave],
      ['Unpaid days', s.a.lop],
      [],
      ['Earnings', 'Amount'],
      ...s.earn,
      ['Gross earnings', s.gross],
      [],
      ['Deductions', 'Amount'],
      ...s.ded,
      ['Total deductions', s.totalDed],
      [],
      ['Net pay', s.net],
      ['In words', words(s.net)],
      [],
      ['Employer contributions', ''],
      ...s.employer,
      [],
      ['Year to date gross', y.gross],
      ['Year to date deductions', y.ded],
      ['Year to date net', y.net],
    ])
    toast(out.name)
  }

  const facts: [string, string | number][] = [
    ['Name', person.n],
    ['Employee ID', person.id.toUpperCase()],
    ['Department', person.dep.join(', ') || '—'],
    ['Role', roleName(person.r)],
    ['Days in month', s.a.days],
    ['Working days', s.a.working],
    ['Paid leave', s.a.paidLeave],
    ['Unpaid days', s.a.lop],
  ]

  return (
    <>
      <PageHead
        parent={mine ? { to: '/mypay', label: 'My payslips' } : { to: '/payroll', label: 'Payroll' }}
        title="Payslip"
        sub={`${person.n} · ${month}`}
        actions={
          <>
            <Btn variant="ghost" onClick={() => window.print()}>
              Print
            </Btn>
            <Btn variant="ghost" onClick={download}>
              Download
            </Btn>
          </>
        }
      />

      <Card padded style={{ maxWidth: 940 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: 20,
            flexWrap: 'wrap',
            paddingBottom: 16,
            borderBottom: '2px solid var(--ink)',
          }}
        >
          <div>
            <div style={{ fontSize: '17px', fontWeight: 700 }}>{tenant.name}</div>
            <div className="gr" style={{ fontSize: '12.5px' }}>
              Payslip for {month}
              {run.at ? ` · approved ${run.at}` : ''}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="gr" style={{ fontSize: '12.5px' }}>
              Net pay
            </div>
            <div className="mono" style={{ fontSize: '26px', fontWeight: 700 }}>
              {inr(s.net)}
            </div>
          </div>
        </div>

        <div className="frm" style={{ margin: '16px 0 4px' }}>
          {facts.map(([label, v]) => (
            <div className="fld" key={label}>
              <label>{label}</label>
              <div className="ro">{String(v)}</div>
            </div>
          ))}
        </div>

        <div className="two" style={{ marginTop: 18 }}>
          <div>
            <Label>Earnings</Label>
            {s.earn.map(([label, v]) => (
              <Row key={label} label={label} value={v} />
            ))}
            {s.a.lop ? (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '7px 0',
                  fontSize: '12.5px',
                  color: 'var(--warn)',
                }}
              >
                <span>
                  Reduced for {s.a.lop} unpaid day{s.a.lop === 1 ? '' : 's'} at {inr2(s.perDay)} a day
                </span>
                <b className="mono">−{inr2(s.lopAmt)}</b>
              </div>
            ) : null}
            <Total label="Gross earnings" value={s.gross} />
          </div>
          <div>
            <Label>Deductions</Label>
            {s.ded.map(([label, v]) => (
              <Row key={label} label={label} value={v} tone="warn" />
            ))}
            <Total label="Total deductions" value={s.totalDed} tone="warn" />
          </div>
        </div>

        {s.reimb.length ? (
          <Card padded style={{ background: 'var(--tint)', marginTop: 16 }}>
            <Label>Reimbursed on top of salary</Label>
            {s.reimb.map(([label, v]) => (
              <Row key={label} label={label} value={v} tone="ok" />
            ))}
            <p className="gr" style={{ fontSize: '12.5px', marginTop: 10 }}>
              Paid back at cost and not taxed, which is why it sits outside earnings rather than inside
              them.
            </p>
          </Card>
        ) : null}

        <div
          className="rw"
          style={{ background: 'var(--oktint)', borderRadius: 9, padding: '14px 16px', marginTop: 18 }}
        >
          <span className="ok" style={{ fontSize: '14.5px' }}>
            ✓
          </span>
          <span>
            <b style={{ fontSize: '14.5px' }}>Net pay {inr2(s.net)}</b>
            <div className="sd">
              Rupees {words(s.net)} · credited to the account on file on the {PAYCFG.payDay}
              {PAYCFG.payDay === 1 ? 'st' : 'th'}
            </div>
          </span>
          <span />
        </div>

        <div className="two" style={{ marginTop: 18 }}>
          <Card padded style={{ background: 'var(--tint)' }}>
            <Label>Paid by the company on top of your salary</Label>
            {s.employer.map(([label, v]) => (
              <Row key={label} label={label} value={v} />
            ))}
            <p className="gr" style={{ fontSize: '12.5px', marginTop: 10 }}>
              These do not come out of your pay. They are part of your cost to company, which is why the
              CTC on your letter is higher than twelve times the gross above.
            </p>
          </Card>
          <Card padded style={{ background: 'var(--tint)' }}>
            <Label>Year to date — {PAYMONTHS[0].split(' ')[1]} onward</Label>
            <Row label="Gross earnings" value={y.gross} />
            <Row label="Deductions" value={y.ded} tone="warn" />
            <Row label="Tax deducted" value={y.tds} tone="warn" />
            <Total label="Net received" value={y.net} tone="ok" />
          </Card>
        </div>

        <div className="lb" style={{ marginTop: 20 }}>
          How these figures were arrived at
        </div>
        <div className="rows" style={{ border: 'none', borderRadius: 0 }}>
          <Why
            head={`Basic is ${PAYCFG.basicPct}% of your monthly cost to company`}
            detail="Set by the labour codes, which require basic to be at least half. Everything statutory is calculated from it."
          />
          <Why
            head={`Provident fund is ${PAYCFG.pfPct}% of ${PAYCFG.pfOnFullBasic ? 'basic' : `basic, capped at a ${inr(PAYCFG.pfWageCeiling)} wage`}`}
            detail={`Deducted from you, and matched by the company at ${inr(s.st.epfEr)}.`}
          />
          <Why
            head={
              s.esi
                ? `ESI at ${PAYCFG.esiPct}% applies because gross is under ${inr(PAYCFG.esiGrossLimit)}`
                : `ESI does not apply — gross is above ${inr(PAYCFG.esiGrossLimit)}`
            }
            detail="The threshold is statutory, not a company choice."
          />
          {s.emi && s.loan ? (
            <Why
              head={`${inr(s.emi)} recovered against your advance`}
              detail={`${inr(s.loan.paid)} of ${inr(s.loan.amt)} repaid so far. ${Math.ceil((s.loan.amt - s.loan.paid) / s.loan.emi)} instalments left.`}
            />
          ) : null}
          {s.arr ? (
            <Why
              head={`Arrears of ${inr(s.arr)} for an earlier month`}
              detail="Taxed in the month it is paid, which is this one."
            />
          ) : null}
          <Why
            head="Tax is this year’s estimate, spread evenly"
            detail="Computed on the new regime with the standard deduction, then divided by twelve. It moves if your declarations change."
          />
        </div>

        <Assumption title="Tax here is illustrative">
          The slabs are the new-regime rates and the arithmetic is right, but a real payroll takes
          account of declarations, other income and prior employment.{' '}
          <b>Confirm the numbers with whoever files your returns before anyone is paid on them.</b>
        </Assumption>

        <p className="gr" style={{ fontSize: '11.5px', marginTop: 14 }}>
          Computer-generated. No signature is required.
        </p>
      </Card>
    </>
  )
}
