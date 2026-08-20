import { useMemo } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Btn, Card, CardBody, CardHead, Chip, Empty, KeyValues, Label, PageHead } from '@/components/ui'
import { RequireCap } from '@/components/RequireCap'
import { useSession } from '@/state/session'
import { useUi } from '@/state/ui'
import { MAILBOX, MAIL_STATE } from '@/data/intake'
import { TZ, fmtDT } from '@/lib/format'
import type { MailItem } from '@/data/types'

/**
 * Order intake — the mailbox, not a form.
 *
 * Orders arrive as email, so this starts with what landed. Each message is read
 * for the fields it obviously carries; nothing here creates anything. The two
 * ways out are the two ways an order really begins: settle what the mailbox
 * watches, or type one in by hand.
 */

/** The address the client actually writes to. */
const mailboxAddress = (tenantName: string) =>
  `orders@${tenantName.toLowerCase().replace(/[^a-z]/g, '')}.titlecrm.com`

function MailCard({ m }: { m: MailItem }) {
  const navigate = useNavigate()
  const { toast } = useUi()
  const [label, kind] = MAIL_STATE[m.st]

  /* Neither action creates an order, and both say what they did instead — the
     mailbox is the record, so "dismissed" has to mean it stayed there. */
  const keep = () => toast('Kept as a duplicate — no order created')
  const dismiss = () => toast('Dismissed — it stays in the mailbox, not in the queue')

  return (
    <Card style={{ marginBottom: 13 }}>
      <CardHead
        title={
          <div>
            <h2 style={{ fontSize: '14.5px', margin: 0 }}>{m.s}</h2>
            <div className="gr" style={{ fontSize: '12.5px', marginTop: 2 }}>
              {m.f} · {fmtDT(m.t)} {TZ}
            </div>
          </div>
        }
        actions={<Chip kind={kind}>{label}</Chip>}
      />

      {m.dupe ? (
        <div
          style={{
            padding: '11px 20px',
            background: 'var(--badsoft)',
            borderBottom: '1px solid #F3CFCF',
            fontSize: '12.5px',
            color: 'var(--bad)',
            fontWeight: 500,
          }}
        >
          ⚠ {m.dupe}
        </div>
      ) : null}

      <CardBody>
        {m.at.length ? (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 13 }}>
            {m.at.map((a) => (
              <span
                key={a}
                className="chip pl n"
                style={{ fontFamily: 'var(--mono)', fontSize: '11.5px' }}
              >
                📎 {a}
              </span>
            ))}
          </div>
        ) : null}

        <Label>Read from the message</Label>
        <KeyValues rows={m.x.map(([k, v]) => [k, v])} />

        <div style={{ display: 'flex', gap: 8, marginTop: 15, flexWrap: 'wrap' }}>
          {m.st === 'ready' ? (
            <Btn onClick={() => navigate({ to: '/orders/new' })}>Review &amp; create order</Btn>
          ) : m.st === 'attach' && m.match ? (
            <Btn
              variant="ghost"
              onClick={() => navigate({ to: '/orders/$orderId', params: { orderId: m.match! } })}
            >
              Attach to {m.match}
            </Btn>
          ) : (
            <Btn variant="ghost" onClick={keep}>
              Keep as duplicate
            </Btn>
          )}
          <Btn variant="ghost" onClick={dismiss}>
            Dismiss
          </Btn>
        </div>
      </CardBody>
    </Card>
  )
}

function Intake() {
  const { tenant } = useSession()
  const navigate = useNavigate()
  const mails = useMemo(() => MAILBOX(), [])

  return (
    <>
      <PageHead
        title="Order intake"
        sub={`Mail arriving at ${mailboxAddress(tenant.name)}`}
        actions={
          <>
            <Btn variant="ghost" onClick={() => navigate({ to: '/integ' })}>
              Mailbox settings
            </Btn>
            <Btn onClick={() => navigate({ to: '/orders/new' })}>＋ Manual order</Btn>
          </>
        }
      />

      {/* Written out rather than passed through `Banner`, which puts its body in
          the small grey sub-line. This one has a body *and* a sub, the way the
          design states the rule and then the reason for it. */}
      <div className="bnr b">
        <span className="bi">✉</span>
        <div>
          <div className="bt">Nothing is created automatically</div>
          We read the message and its attachments and fill the order for you. A person confirms before
          it becomes work.
          <div className="bs">
            An address misread from an email is the failure this step exists to prevent.
          </div>
        </div>
      </div>

      {mails.length ? (
        mails.map((m) => <MailCard key={m.s} m={m} />)
      ) : (
        <Card>
          <Empty icon="✓" action={<Btn small onClick={() => navigate({ to: '/orders/new' })}>Manual order</Btn>}>
            Nothing waiting. New mail to {mailboxAddress(tenant.name)} appears here.
          </Empty>
        </Card>
      )}
    </>
  )
}

export default function IntakeRoute() {
  return (
    <RequireCap cap="all">
      <Intake />
    </RequireCap>
  )
}
