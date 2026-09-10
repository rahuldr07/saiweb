import { Btn } from '@/components/ui'
import { useSession } from '@/state/session'
import { useUi } from '@/state/ui'
import { LNKIND } from '@/data/loans'
import { inr } from '@/lib/payroll'
import { outstanding, statusAfter, type LoanAction } from '@/lib/loans'
import { whoName } from '@/lib/permissions'
import { decide } from '@/state/loans'
import type { LoanRecord } from '@/data/types'

const VERB: Record<LoanAction, string> = {
  approve: 'Approve',
  reject: 'Reject',
  pause: 'Pause',
  resume: 'Resume',
}

export function useLoanConfirm() {
  const { me } = useSession()
  const { toast, openModal, closeModal } = useUi()

  return (action: LoanAction, loan: LoanRecord) => {
    const result = statusAfter(loan, action, me.id)
    if (!result.ok) {
      toast(result.reason)
      return
    }
    const who = whoName(loan.who)
    openModal({
      title: `${VERB[action]} ${who}’s ${LNKIND[loan.kind][0].toLowerCase()}?`,
      body: (
        <p style={{ fontSize: 'var(--t-body)' }}>
          {inr(loan.amt)} principal, {inr(loan.emi)} EMI, {inr(outstanding(loan))} still outstanding.
          {action === 'approve' ? ' Becomes active and starts recovering from the next payroll run.' : null}
          {action === 'reject' ? ' The request is closed with no amount disbursed.' : null}
          {action === 'pause' ? ' Stops recovering until resumed — the balance owed does not change.' : null}
          {action === 'resume' ? ' Recovery starts again from the next payroll run.' : null}
        </p>
      ),
      footer: (
        <>
          <Btn variant="ghost" onClick={closeModal}>
            Cancel
          </Btn>
          <Btn
            variant={action === 'reject' ? 'danger' : 'primary'}
            onClick={() => {
              const outcome = decide(loan.id, action, me.id)
              closeModal()
              toast(outcome.ok ? `${who} — ${VERB[action].toLowerCase()}d` : outcome.reason)
            }}
          >
            {VERB[action]}
          </Btn>
        </>
      ),
    })
  }
}
