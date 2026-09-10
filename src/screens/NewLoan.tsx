import { useState } from 'react'
import { Btn, Card, Form, Label, PageHead } from '@/components/ui'
import { useSession } from '@/state/session'
import { useUi } from '@/state/ui'
import { LOAN_POLICY, policyCheck } from '@/lib/loans'
import { inr, payslipOf, structureOf } from '@/lib/payroll'
import { useGo } from '@/lib/nav'
import { PAYMONTHS } from '@/data/hrms'
import { requestLoan, useLoans } from '@/state/loans'
import type { LoanKind } from '@/data/types'

function NewLoan() {
  const go = useGo()
  const { me } = useSession()
  const { toast } = useUi()
  const { loans } = useLoans()

  const [kind, setKind] = useState<LoanKind>('loan')
  const [amt, setAmt] = useState('')
  const [emi, setEmi] = useState('')
  const [note, setNote] = useState('')
  const [touched, setTouched] = useState(false)

  const latestMonth = PAYMONTHS[PAYMONTHS.length - 1]
  const monthlyGross = structureOf(me).gross
  const monthlyNet = latestMonth ? payslipOf(me, latestMonth).net : monthlyGross

  const amount = Number(amt)
  const instalment = Number(emi)
  const existing = loans.filter((l) => l.who === me.id)

  const policy =
    amt && amount > 0 ? policyCheck(kind, amount, monthlyGross, monthlyNet, existing) : { ok: true as const }

  const errors: string[] = []
  if (touched) {
    if (!amt || amount <= 0) errors.push('Enter an amount greater than zero.')
    if (!emi || instalment <= 0) errors.push('Enter an EMI greater than zero.')
    if (amt && emi && instalment > amount) errors.push('The EMI cannot be more than the amount itself.')
    if (!note.trim()) errors.push('Say what it is for — the person deciding this will ask otherwise.')
  }
  if (!policy.ok) errors.push(policy.reason)

  const submit = () => {
    setTouched(true)
    if (!amt || amount <= 0 || !emi || instalment <= 0 || instalment > amount || !note.trim() || !policy.ok) {
      return
    }
    const loan = requestLoan({ who: me.id, kind, amt: amount, emi: instalment, note: note.trim() })
    toast(`${kind === 'loan' ? 'Staff loan' : 'Salary advance'} request sent`)
    go({ to: '/loans/$loanId', params: { loanId: loan.id } })
  }

  const instalments = amount > 0 && instalment > 0 ? Math.ceil(amount / instalment) : null

  return (
    <>
      <PageHead
        parent={{ to: '/loans', label: 'Loans & advances' }}
        title="New request"
        sub="Checked against policy before it goes to whoever decides it."
      />

      <div className="two">
        <div>
          <Card padded>
            <Label>What you need</Label>
            <Form>
              <div className="fld">
                <label htmlFor="ln-kind">Type</label>
                <select
                  className="inp"
                  id="ln-kind"
                  value={kind}
                  onChange={(e) => setKind(e.target.value as LoanKind)}
                >
                  <option value="loan">Staff loan</option>
                  <option value="advance">Salary advance</option>
                </select>
              </div>
              <div className="fld">
                <label htmlFor="ln-amt">Amount</label>
                <input
                  className="inp"
                  id="ln-amt"
                  type="number"
                  min={0}
                  value={amt}
                  onChange={(e) => setAmt(e.target.value)}
                />
              </div>
              <div className="fld">
                <label htmlFor="ln-emi">Monthly instalment (EMI)</label>
                <input
                  className="inp"
                  id="ln-emi"
                  type="number"
                  min={0}
                  value={emi}
                  onChange={(e) => setEmi(e.target.value)}
                />
              </div>
            </Form>
            {instalments ? (
              <p className="gr" style={{ fontSize: '12.5px', marginTop: 10 }}>
                {instalments} instalment{instalments === 1 ? '' : 's'}, the last one adjusted so it never
                overshoots the balance.
              </p>
            ) : null}
          </Card>

          <Card padded style={{ marginTop: 16 }}>
            <Label>What it's for</Label>
            <textarea
              className="inp"
              id="ln-note"
              value={note}
              placeholder="e.g. Medical expenses, a family event, home repairs"
              onChange={(e) => setNote(e.target.value)}
            />
          </Card>
        </div>

        <aside>
          <Card padded style={{ position: 'sticky', top: 76 }}>
            <div className="lb">Your numbers</div>
            <div style={{ display: 'grid', gap: 8, marginTop: 10, fontSize: '12.5px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Monthly gross</span>
                <b className="mono">{inr(monthlyGross)}</b>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Monthly net</span>
                <b className="mono">{inr(monthlyNet)}</b>
              </div>
            </div>

            <div className="lb" style={{ marginTop: 20 }}>
              Policy
            </div>
            <div style={{ display: 'grid', gap: 6, marginTop: 8, fontSize: '12.5px' }}>
              <div>Advance ≤ {LOAN_POLICY.advancePctOfNet}% of monthly net</div>
              <div>Loan ≤ {LOAN_POLICY.loanMultipleOfGross}× monthly gross</div>
              <div>One loan and one advance at a time</div>
            </div>

            {errors.length ? (
              <div className="bnr d" style={{ marginTop: 16 }}>
                <span className="bi">⚑</span>
                <div style={{ fontSize: '12.5px' }}>
                  {errors.map((e) => (
                    <div key={e}>{e}</div>
                  ))}
                </div>
              </div>
            ) : null}

            <Btn style={{ width: '100%', marginTop: 18 }} onClick={submit}>
              Send request
            </Btn>
            <Btn variant="ghost" style={{ width: '100%', marginTop: 8 }} onClick={() => go({ to: '/loans' })}>
              Cancel
            </Btn>
          </Card>
        </aside>
      </div>
    </>
  )
}

export default function NewLoanRoute() {
  return <NewLoan />
}
