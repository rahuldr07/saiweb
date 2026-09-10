import { Bar, Btn, Card, Label } from './ui'
import { LNKIND } from '@/data/loans'
import { inr } from '@/lib/payroll'
import { useGo } from '@/lib/nav'
import { outstanding, scheduleFor } from '@/lib/loans'
import { useLoans } from '@/state/loans'

export function LoanCard({ personId }: { personId: string }) {
  const go = useGo()
  const { loans, payments } = useLoans()
  const mine = loans.filter((l) => l.who === personId && (l.st === 'active' || l.st === 'paused'))

  if (!mine.length) return null

  return (
    <Card padded style={{ marginTop: 16 }}>
      <Label>My loan{mine.length > 1 ? 's' : ''}</Label>
      <div style={{ display: 'grid', gap: 16, marginTop: 10 }}>
        {mine.map((loan) => {
          const bal = outstanding(loan)
          const next = scheduleFor(loan, payments).find((r) => r.status === 'due')
          return (
            <div key={loan.id}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13.5px' }}>
                <b>{LNKIND[loan.kind][0]}</b>
                <span className="mono">{inr(loan.amt)}</span>
              </div>
              <Bar value={loan.paid} max={loan.amt} />
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '12.5px',
                  marginTop: 6,
                }}
                className="gr"
              >
                <span>Recovered {inr(loan.paid)}</span>
                <span>Balance {inr(bal)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
                <span className="s">
                  {loan.st === 'paused'
                    ? 'Paused'
                    : next
                      ? `Next EMI ${inr(next.amount)} · ${next.due}`
                      : 'Nothing due next run'}
                </span>
                <Btn
                  variant="ghost"
                  small
                  onClick={() =>
                    go({ to: '/loans/$loanId', params: { loanId: loan.id }, search: { tab: 'Schedule' } })
                  }
                >
                  View schedule
                </Btn>
              </div>
            </div>
          )
        })}
      </div>
    </Card>
  )
}
