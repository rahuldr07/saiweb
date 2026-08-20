import { Btn, Card, Chip, PageHead } from '@/components/ui'
import { RequireCap } from '@/components/RequireCap'
import { useNotBuilt } from '@/components/notBuilt'
import { CONNECTORS } from '@/data/integrations'
import { csvName, downloadCSV } from '@/lib/csv'

/**
 * Connect what you already run.
 *
 * Nothing here is required, and nothing on the board depends on any of it — an
 * integration that is off means that step is done by hand. None of them are
 * wired: each button says what connecting it would actually take rather than
 * toggling a switch that reaches nothing.
 */

/**
 * The button's verb, carried into the modal title.
 *
 * The design titled all six "Connecting X", which reads wrong under the one
 * button that says Set up — county recorders are not something you connect to.
 */
const VERB: Record<string, string> = {
  Connect: 'Connecting',
  Configure: 'Configuring',
  'Set up': 'Setting up',
}

/** The rounded glyph tile each connector leads with. */
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
        fontSize: '14.5px',
        flex: 'none',
      }}
    >
      {children}
    </span>
  )
}

function Integrations() {
  const notBuilt = useNotBuilt()

  /* What the screen knows, in the format that does work: which connectors exist,
     what each is for, whether it is on, and what turning it on would take. */
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
              <b style={{ fontSize: '14.5px' }}>{c.n}</b>
              {c.connected ? <Chip kind="v">Connected</Chip> : null}
            </div>
            <p className="gr" style={{ fontSize: '12.5px', lineHeight: 1.55, minHeight: 38 }}>
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

      {/* The one a reader is most likely to assume is required, said plainly. */}
      <div className="bnr b" style={{ marginTop: 18 }}>
        <span className="bi">◧</span>
        <div>
          <div className="bt">The Titleflow connection is optional, both ways</div>
          Title CRM works on its own for any abstracting firm. If you also take work from the Titleflow
          marketplace, connecting means an accepted order lands here ready to assign — and the finished
          report goes back without anyone re-typing it.
          <div className="bs">Not connecting costs you nothing; nothing here depends on it.</div>
        </div>
      </div>
    </>
  )
}

export default function IntegrationsRoute() {
  return (
    <RequireCap cap="config">
      <Integrations />
    </RequireCap>
  )
}
