import type { Connector } from './types'

const OAUTH = 'credentials and an OAuth round trip'

export const CONNECTORS: Connector[] = [
  {
    k: 'mail',
    icon: '✉',
    n: 'Gmail / Outlook',
    d: 'Watch a mailbox and turn incoming orders into drafts.',
    cta: 'Configure',
    connected: true,
    needs: OAUTH,
  },
  {
    k: 'titleflow',
    icon: '◧',
    n: 'Titleflow marketplace',
    d: 'Take orders from the Titleflow network straight into this workspace, and deliver back without re-keying.',
    cta: 'Connect',
    needs: OAUTH,
  },
  {
    k: 'quickbooks',
    icon: '$',
    n: 'QuickBooks',
    d: 'Push invoices and payments into your ledger.',
    cta: 'Connect',
    needs: OAUTH,
  },
  {
    k: 'zapier',
    icon: '⚡',
    n: 'Zapier',
    d: 'Triggers on order created, delivered and past due.',
    cta: 'Connect',
    needs: OAUTH,
  },
  {
    k: 'slack',
    icon: '💬',
    n: 'Slack',
    d: 'Past-due and delivery notices into a channel.',
    cta: 'Connect',
    needs: OAUTH,
  },
  {
    k: 'county',
    icon: '◈',
    n: 'County portal credentials',
    d: 'Store per-county logins so searchers do not keep their own list.',
    cta: 'Set up',
    needs: 'a secret store, and somewhere to audit who read from it',
  },
]
