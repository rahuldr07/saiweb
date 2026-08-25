import { Row, Rows } from './ui'
import { useUi } from '@/state/ui'

/**
 * What "inside your budget" means.
 *
 * Asked from two places — a person's own report and their profile — and it has to
 * say the same thing in both, because the figure it explains is the one people
 * argue with. The point it exists to make is in the last paragraph: the
 * comparison is against others doing the *same stages*, since RTS finishes
 * inside budget almost every time and Search barely 60% of the time.
 */
export function useBudgetHelp() {
  const { openModal } = useUi()

  return () =>
    openModal({
      title: 'What “inside your budget” means',
      body: (
        <>
          <Rows>
            <Row
              title="The stage budget"
              detail="the share of the client promise this stage is allowed"
              right={<span className="gr">set per product</span>}
            />
            <Row title="Inside budget" detail="you finished the stage within that share" />
            <Row
              title="Compared against"
              detail="other people doing the same stages, not the company average"
            />
          </Rows>
          <p className="gr" style={{ fontSize: '12.5px', marginTop: 12 }}>
            Stages differ enormously — RTS finishes inside budget almost every time and Search barely
            60% of the time. Comparing you against the company average would say more about which
            stage you work on than about you.
          </p>
        </>
      ),
    })
}
