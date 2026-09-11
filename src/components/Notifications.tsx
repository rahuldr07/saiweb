import { useGo } from '@/lib/nav'
import { useUi } from '@/state/ui'
import { useCoverage } from '@/state/counties'
import { alerts } from '@/lib/derived'
import { Empty, Row, Rows } from '@/components/ui'

/** The same "what needs attention" list behind the top bar's bell and My Work's "Needs you" — one alert feed, opened as a popup wherever it is used. */
export function useNotifications() {
  const { openModal, closeModal } = useUi()
  const navigate = useGo()
  const { check } = useCoverage()
  const list = alerts()

  const open = () =>
    openModal({
      title: 'Notifications',
      body: list.length ? (
        <>
          <Rows>
            {list.map((a, i) => (
              <Row
                key={i}
                icon={
                  <span className={a.sev === 'bad' ? 'bad' : 'warn'} style={{ fontSize: 'var(--t-lead)' }}>
                    {a.sev === 'bad' ? '⚑' : '◷'}
                  </span>
                }
                title={a.t}
                detail={a.d}
                right={<span className="gr">→</span>}
                onClick={() => {
                  closeModal()
                  navigate({ to: `/${a.go}` })
                }}
              />
            ))}
          </Rows>
          <p className="gr" style={{ fontSize: 'var(--t-label)', marginTop: 12 }}>
            Going to {check.notify === 'admins' ? 'company admins' : check.notify}. Change who under
            Link monitor.
          </p>
        </>
      ) : (
        <div className="empty" style={{ padding: '26px 10px' }}>
          <Empty icon="✓">Nothing needs your attention.</Empty>
        </div>
      ),
    })

  return { list, open }
}
