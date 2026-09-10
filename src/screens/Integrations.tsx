import { Banner, Btn, Card, Chip, PageHead } from '@/components/ui'
import { ErrorBoundary } from '@/components/async'
import { RequireCap } from '@/components/RequireCap'
import { useNotBuilt } from '@/components/notBuilt'
import { CONNECTORS } from '@/data/integrations'
import { csvName, downloadCSV } from '@/lib/csv'

const VERB: Record<string, string> = {
  Connect: 'Connecting',
  Configure: 'Configuring',
  'Set up': 'Setting up',
}

function ConnectorIcon({ children }: { children: string }) {
  return (
    <span
      style={{
        width: 32,
        height: 32,
        borderRadius: 9,
        background: 'var(--brandsoft)',
        color: 'var(--brand)',
        display: 'grid',
        placeItems: 'center',
        fontSize: 'var(--t-lead)',
        flex: 'none',
      }}
    >
      {children}
    </span>
  )
}

function Integrations() {
  const notBuilt = useNotBuilt()

  const exportConnectors = () =>
    downloadCSV(csvName('integrations'), [
      ['Connector', 'What it does', 'Status', 'What connecting it needs'],
      ...CONNECTORS.map((c) => [c.n, c.d, c.connected ? 'Connected' : 'Not connected', c.needs]),
    ])

  return (
    <>
      <PageHead title="Integrations" sub="Connect what you already run. Everything is optional." />

      <div className="kpis" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))' }}>
        {CONNECTORS.map((c) => (
          <Card padded key={c.k}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 9 }}>
              <ConnectorIcon>{c.icon}</ConnectorIcon>
              <b style={{ fontSize: 'var(--t-lead)' }}>{c.n}</b>
              {c.connected ? <Chip kind="v">Connected</Chip> : null}
            </div>
            <p className="gr" style={{ fontSize: 'var(--t-small)', lineHeight: 1.55, minHeight: 38 }}>
              {c.d}
            </p>
            <Btn
              small
              variant={c.connected ? 'ghost' : 'primary'}
              style={{ marginTop: 10 }}
              onClick={() => notBuilt(`${VERB[c.cta] ?? 'Connecting'} ${c.n}`, c.needs, exportConnectors)}
            >
              {c.cta}
            </Btn>
          </Card>
        ))}
      </div>

      <Banner
        kind="b"
        icon="◧"
        title="The Titleflow connection is optional, both ways"
        style={{ marginTop: 18 }}
      >
        Title CRM works on its own for any abstracting firm. If you also take work from the Titleflow
        marketplace, connecting means an accepted order lands here ready to assign — and the finished
        report goes back without anyone re-typing it.
        <div className="bs">Not connecting costs you nothing; nothing here depends on it.</div>
      </Banner>
    </>
  )
}

export default function IntegrationsRoute() {
  return (
    <RequireCap cap="config">
      <ErrorBoundary what="Integrations">
        <Integrations />
      </ErrorBoundary>
    </RequireCap>
  )
}
