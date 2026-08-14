import { useState } from 'react'
import { Btn, Card, CardHead, Chip, PageHead, Rows } from '@/components/ui'
import { RequireCap } from '@/components/RequireCap'
import { useUi } from '@/state/ui'

interface Integration {
  k: string
  n: string
  d: string
  icon: string
  connected: boolean
  detail?: string
}

/** Connect what you already run. Everything here is optional. */
const INTEGRATIONS: Integration[] = [
  {
    k: 'email',
    n: 'Email intake',
    d: 'Orders arriving by email are read into intake instead of being retyped.',
    icon: '✉',
    connected: true,
    detail: 'orders@keystoneabstract.com',
  },
  {
    k: 'storage',
    n: 'Document storage',
    d: 'Search packages and scans go to your own bucket, not ours.',
    icon: '▤',
    connected: true,
    detail: 'S3 · keystone-title-docs',
  },
  {
    k: 'esign',
    n: 'E-sign',
    d: 'Send the typed report for signature without leaving the order.',
    icon: '✎',
    connected: false,
  },
  {
    k: 'accounting',
    n: 'Accounting',
    d: 'Invoices raised here appear in your ledger the same day.',
    icon: '$',
    connected: false,
  },
  {
    k: 'sso',
    n: 'Single sign-on',
    d: 'Staff sign in with your identity provider; roles stay in our tables.',
    icon: '⚯',
    connected: false,
  },
]

function Integrations() {
  const { toast } = useUi()
  const [state, setState] = useState<Record<string, boolean>>(
    Object.fromEntries(INTEGRATIONS.map((i) => [i.k, i.connected])),
  )

  const toggle = (i: Integration) => {
    const next = !state[i.k]
    setState((s) => ({ ...s, [i.k]: next }))
    toast(next ? `${i.n} connected` : `${i.n} disconnected`)
  }

  const on = INTEGRATIONS.filter((i) => state[i.k]).length

  return (
    <>
      <PageHead
        title="Integrations"
        sub={`Connect what you already run. ${on} of ${INTEGRATIONS.length} connected — everything here is optional.`}
      />

      <Card>
        <CardHead title="Available connections" />
        <Rows>
          {INTEGRATIONS.map((i) => (
            <div className="rw" key={i.k}>
              <span className={state[i.k] ? 'ok' : 'gr'} style={{ fontSize: '14.5px' }}>
                {i.icon}
              </span>
              <span>
                <b>{i.n}</b>
                <div className="sd">{i.d}</div>
                {state[i.k] && i.detail ? (
                  <div className="sd mono" style={{ fontSize: '11.5px' }}>
                    {i.detail}
                  </div>
                ) : null}
              </span>
              <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <Chip kind={state[i.k] ? 'v' : 'n'}>{state[i.k] ? 'Connected' : 'Not connected'}</Chip>
                <Btn small variant={state[i.k] ? 'ghost' : 'primary'} onClick={() => toggle(i)}>
                  {state[i.k] ? 'Disconnect' : 'Connect'}
                </Btn>
              </span>
            </div>
          ))}
        </Rows>
      </Card>

      <p className="gr" style={{ fontSize: '12.5px', marginTop: 12 }}>
        Nothing here is required to run the workspace. An integration that is off simply means that step is
        done by hand.
      </p>
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
