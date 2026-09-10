import { useGo } from '@/lib/nav'
import { useSession } from '@/state/session'
import { useUi } from '@/state/ui'
import { visibleNav } from '@/lib/permissions'
import { initials } from '@/lib/format'
import { pastDueCount, brokenLinks, followUpCount } from '@/lib/derived'
import { TENANTS } from '@/data/org'
import { Chip, Row, Rows } from '@/components/ui'

function badgeFor(route: string) {
  const overdue = pastDueCount()
  if (route === 'dash' && overdue) return { n: overdue, warn: false }
  const fu = followUpCount()
  if (route === 'leads' && fu) return { n: fu, warn: true }
  const bl = brokenLinks().length
  if (route === 'linkcheck' && bl) return { n: bl, warn: false }
  return null
}

export function Sidebar({ current }: { current: string }) {
  const { me, tenant, switchTenant, roleLabel, setNavOpen, memberships } = useSession()
  const { openModal, closeModal } = useUi()
  const navigate = useGo()

  const groups = visibleNav(me)

  const go = (route: string) => {
    setNavOpen(false)
    navigate({ to: `/${route}` })
  }

  const workspaces = memberships.length
    ? memberships.map((m) => ({ id: m.id, name: m.name, plan: m.plan }))
    : TENANTS.map((t) => ({ id: t.id, name: t.name, plan: t.plan }))

  const openTenantPicker = () =>
    openModal({
      title: 'Switch company',
      body: (
        <>
          <p className="gr" style={{ fontSize: '12.5px', marginBottom: 14 }}>
            Each company is a separate workspace. Staff, orders, clients, counties and quality data are
            private to it — nothing is shared between companies.
          </p>
          <Rows>
            {workspaces.map((t) =>
              t.id === 'new' ? (
                <Row
                  key={t.id}
                  icon={<span className="br">＋</span>}
                  title={<span className="br">Add a company</span>}
                  detail="Set up a new workspace"
                  onClick={() => {
                    closeModal()
                    go('onboard')
                  }}
                />
              ) : (
                <Row
                  key={t.id}
                  icon={<span className="ava">{initials(t.name)}</span>}
                  title={t.name}
                  detail={t.plan}
                  right={t.id === tenant.id ? <Chip kind="b">Current</Chip> : null}
                  onClick={() => {
                    switchTenant(t.id)
                    closeModal()
                    go('dash')
                  }}
                />
              ),
            )}
          </Rows>
        </>
      ),
    })

  return (
    <aside className="side">
      <div className="logo">
        <i>◧</i> Title CRM
      </div>

      <div
        className="tenant"
        role="button"
        tabIndex={0}
        onClick={openTenantPicker}
        onKeyDown={(e) => {
          if (e.key === 'Enter') openTenantPicker()
        }}
      >
        <span className="av">{initials(tenant.name)}</span>
        <span className="nm">
          <b>{tenant.name}</b>
          <span>{tenant.plan}</span>
        </span>
        <span className="cx">⇅</span>
      </div>

      <nav>
        {groups.map((g) => (
          <div key={g.l}>
            <div className="navlbl">{g.l}</div>
            {g.t.map(([label, route, glyph]) => {
              const badge = badgeFor(route)
              return (
                <button
                  key={route}
                  type="button"
                  className={route === current ? 'on' : ''}
                  aria-current={route === current ? 'page' : undefined}
                  onClick={() => go(route)}
                >
                  <i>{glyph}</i>
                  {label}
                  {badge ? (
                    <span className="bdg" style={badge.warn ? { background: 'var(--warn)' } : undefined}>
                      {badge.n}
                    </span>
                  ) : null}
                </button>
              )
            })}
          </div>
        ))}
      </nav>

      <div className="me">
        <span className="av">{initials(me.n)}</span>
        <span>
          <b>{me.n}</b>
          <span>{roleLabel}</span>
        </span>
        <button
          type="button"
          className="lo"
          aria-label="Sign out"
          title="Sign out"
          onClick={() => go('signin')}
        >
          ⏻
        </button>
      </div>
    </aside>
  )
}
