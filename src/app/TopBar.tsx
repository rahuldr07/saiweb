import { useNavigate } from '@tanstack/react-router'
import { useSession } from '@/state/session'
import { useUi } from '@/state/ui'
import { fmtTime, initials, NOW, TZ, TZ2 } from '@/lib/format'
import { alerts } from '@/lib/derived'
import { LINKCHECK } from '@/data/catalog'
import { ROUTE_LABEL } from './nav'
import { Empty, Row, Rows } from '@/components/ui'

/** The operator's zone runs 9h30m ahead of the client's. */
const LOCAL_OFFSET_H = 9.5

export function TopBar({ current }: { current: string }) {
  const { me, tenant, theme, toggleTheme, navOpen, setNavOpen, roleLabel } = useSession()
  const { openModal, closeModal } = useUi()
  const navigate = useNavigate()

  const list = alerts()
  const worst = list.some((a) => a.sev === 'bad') ? 'var(--bad)' : 'var(--warn)'
  const label = ROUTE_LABEL[current]
  const crumb = label ? `${tenant.name} · ${label}` : tenant.name

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
            Going to {LINKCHECK.notify === 'admins' ? 'company admins' : LINKCHECK.notify}. Change who under
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

      <span className="gr" style={{ fontSize: '12.5px' }}>
        {crumb}
      </span>

      <div className="clock">
        <b>
          {fmtTime(NOW)} {TZ}
        </b>{' '}
        <span>
          · {fmtTime(new Date(NOW.getTime() + LOCAL_OFFSET_H * 3600000))} {TZ2}
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
        aria-label="Account — switch who you are signed in as"
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
