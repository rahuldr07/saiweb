/**
 * What this workspace can be connected to.
 *
 * All of it is optional, and the screen says so twice — once in the subtitle and
 * once about Titleflow specifically, because that is the one a reader is most
 * likely to assume is required. Nothing on the board depends on any of these.
 */
import type { Connector } from './types'

/** What every OAuth-style connector would need before it could do anything. */
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
    /* Not OAuth — county recorder sites issue plain logins, so what this needs
       is somewhere to keep a secret, not a consent screen. */
    needs: 'a secret store, and somewhere to audit who read from it',
  },
]
