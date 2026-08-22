import { useNavigate } from '@tanstack/react-router'
import { useSession } from '@/state/session'
import { useUi } from '@/state/ui'
import { fmtTime, initials, TZ, TZ2 } from '@/lib/format'
import { now } from '@/lib/clock'
import { alerts } from '@/lib/derived'
import { DEMO_IDENTITY } from '@/lib/demo'
import { useCoverage } from '@/state/coverage'
import { ROUTE_LABEL } from './nav'
import { Empty, Row, Rows } from '@/components/ui'

/** The operator's zone runs 9h30m ahead of the client's. */
const LOCAL_OFFSET_H = 9.5

export function TopBar({ current }: { current: string }) {
  const { me, tenant, theme, toggleTheme, navOpen, setNavOpen, roleLabel, can } = useSession()
  const { openModal, closeModal } = useUi()
  const { check } = useCoverage()
  const navigate = useNavigate()

  const list = alerts()
  const worst = list.some((a) => a.sev === 'bad') ? 'var(--bad)' : 'var(--warn)'
  const label = ROUTE_LABEL[current]
  const crumb = label ? `${tenant.name} · ${label}` : tenant.name

  /* Back goes to the dashboard from every screen — except for someone who cannot
     see every order, since the dashboard is gated on that capability and would
     only show them a refusal. They go to My work, which is their equivalent. */
  const hasDash = can('all')
  const target = hasDash ? '/dash' : '/mywork'
  const targetLabel = hasDash ? 'dashboard' : 'my work'
  const atTarget = target === `/${current}`

  const openAlerts = () =>
    openModal({
      title: 'Notifications',
      body: list.length ? (
        <>
          <Rows>
            {list.map((a, i) => (
              <Row
                key={i}
                icon={
                  <span className={a.sev === 'bad' ? 'bad' : 'warn'} style={{ fontSize: '14.5px' }}>
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
          <p className="gr" style={{ fontSize: '11.5px', marginTop: 12 }}>
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

  return (
    <header className="top">
      <button
        className="ic burger"
        type="button"
        aria-label="Open navigation"
        aria-expanded={navOpen}
        onClick={() => setNavOpen(!navOpen)}
      >
        ☰
      </button>

      {atTarget ? null : (
        <button
          className="btn g sm backbtn"
          type="button"
          aria-label={`Back to ${targetLabel}`}
          title={`Back to ${targetLabel}`}
          onClick={() => navigate({ to: target })}
        >
          ←<span className="lbl">{hasDash ? 'Dashboard' : 'My work'}</span>
        </button>
      )}

      <span className="gr crumb" style={{ fontSize: '12.5px' }}>
        {crumb}
      </span>

      <div className="clock">
        <b>
          {fmtTime(now())} {TZ}
        </b>{' '}
        <span>
          · {fmtTime(new Date(now().getTime() + LOCAL_OFFSET_H * 3600000))} {TZ2}
        </span>
      </div>

      <button
        className="ic"
        type="button"
        aria-label={
          list.length ? `Notifications — ${list.length} need attention` : 'Notifications — nothing outstanding'
        }
        onClick={openAlerts}
      >
        🔔
        {list.length ? <span className="dot" style={{ background: worst }} /> : null}
      </button>

      <button
        className="ic"
        type="button"
        aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        aria-pressed={theme === 'dark'}
        onClick={toggleTheme}
      >
        ◐
      </button>

      <button
        className="who"
        type="button"
        aria-label={DEMO_IDENTITY ? 'Account — switch who you are signed in as' : 'Account'}
        onClick={() => navigate({ to: '/signin' })}
      >
        <span className="ava" style={{ width: 26, height: 26, fontSize: '9.5px' }}>
          {initials(me.n)}
        </span>
        <span
          style={{
            textAlign: 'left',
            lineHeight: 1.3,
            display: 'flex',
            flexDirection: 'column',
            minWidth: 0,
          }}
        >
          <b style={{ fontSize: '12.5px', whiteSpace: 'nowrap' }}>{me.n}</b>
          <span className="gr" style={{ fontSize: '10.5px', whiteSpace: 'nowrap' }}>
            {roleLabel}
          </span>
        </span>
      </button>
    </header>
  )
}
