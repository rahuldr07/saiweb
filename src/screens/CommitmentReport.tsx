import { useState } from 'react'
import { Btn, Card, CardHead, Chip, Field, Form, KeyValues, PageHead, Rows, SectionHead, Tabs } from '@/components/ui'
import { useUi } from '@/state/ui'
import { ORDERS } from '@/data/production'
import { PRODUCTS } from '@/data/catalog'
import { STAGES } from '@/data/org'
import { TZ, fmtDT, money } from '@/lib/format'
import { whoName } from '@/lib/permissions'

const TABS = ['Capture', 'Preview', 'Documents'] as const
type Tab = (typeof TABS)[number]

/** Produce the client deliverable from a completed order. */
export default function CommitmentReport() {
  const { toast } = useUi()
  const [tab, setTab] = useState<Tab>('Capture')
  const [orderId, setOrderId] = useState(ORDERS[ORDERS.length - 1].id)
  const [vesting, setVesting] = useState('Sara J. Bahorik and Michael Bahorik, husband and wife')
  const [legal, setLegal] = useState('Lot 14, Block 3, Ridgeview Plan, as recorded in Plat Book 22, Page 41')

  const o = ORDERS.find((x) => x.id === orderId) ?? ORDERS[0]
  const prod = PRODUCTS.find((p) => p.id === o.pr)

  const docs = [
    ['Search package', true],
    ['Vesting deed', true],
    ['Open mortgages', true],
    ['Judgment and lien report', !!o.a['Search QC']],
    ['Tax status', !!o.a['Typing']],
    ['Cover letter', !!o.done],
  ] as [string, boolean][]

  return (
    <>
      <PageHead
        title="Commitment report"
        sub="The commitment a client receives, built from the completed order’s own fields."
        actions={
          <>
            <Btn variant="ghost" onClick={() => toast(`${o.id} — DOCX queued`)}>
              Export DOCX
            </Btn>
            <Btn onClick={() => toast(`${o.id} — PDF queued`)}>Export PDF</Btn>
          </>
        }
      />

      <Tabs tabs={[...TABS]} value={tab} onChange={setTab} />

      {tab === 'Capture' ? (
        <Card padded>
          <CardHead title="Which order" />
          <Form>
            <Field label="Order">
              <select className="inp mono" value={orderId} onChange={(e) => setOrderId(e.target.value)}>
                {ORDERS.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.id} — {x.pr} — {x.prop}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Product">
              <input className="inp" readOnly value={`${prod?.id} — ${prod?.n}`} />
            </Field>
            <div className="fld" style={{ gridColumn: '1/-1' }}>
              <label htmlFor="rg-vest">Vesting</label>
              <input className="inp" id="rg-vest" value={vesting} onChange={(e) => setVesting(e.target.value)} />
            </div>
            <div className="fld" style={{ gridColumn: '1/-1' }}>
              <label htmlFor="rg-legal">Legal description</label>
              <textarea className="inp" id="rg-legal" value={legal} onChange={(e) => setLegal(e.target.value)} />
            </div>
          </Form>
        </Card>
      ) : null}

      {tab === 'Preview' ? (
        <Card padded>
          <CardHead title={`${o.pr} — ${o.id}`} actions={<Chip kind="b">{o.cl}</Chip>} />
          <div style={{ marginTop: 16 }}>
            <KeyValues
              rows={[
                ['Order number', <span className="mono">{o.id}</span>],
                ['Client', o.cl],
                ['Product', `${prod?.id} — ${prod?.n}`],
                ['Property', o.prop],
                ['County', `${o.co} County, ${o.st}`],
                ['Received', <span className="mono">{`${fmtDT(o.recv)} ${TZ}`}</span>],
                ['Due', <span className="mono">{`${fmtDT(o.due)} ${TZ}`}</span>],
                ['Fee', <span className="mono">{money(o.fee)}</span>],
                ['Vesting', vesting],
                ['Legal description', legal],
              ]}
            />
          </div>

          <SectionHead>Who worked it</SectionHead>
          <Rows>
            {STAGES.filter((s) => o.a[s]).map((s) => (
              <div className="rw" key={s}>
                <span className="ok">✓</span>
                <span>
                  <b>{s}</b>
                  <div className="sd">{whoName(o.a[s]!)}</div>
                </span>
                <span />
              </div>
            ))}
          </Rows>
        </Card>
      ) : null}

      {tab === 'Documents' ? (
        <Card>
          <CardHead title="Documents in the package" />
          <Rows>
            {docs.map(([name, ready]) => (
              <div className="rw" key={name}>
                <span className={ready ? 'ok' : 'gr'} style={{ fontSize: '14.5px' }}>
                  {ready ? '✓' : '·'}
                </span>
                <span>
                  <b>{name}</b>
                  <div className="sd">{ready ? 'Ready to send' : 'Waiting on an earlier stage'}</div>
                </span>
                <span>
                  <Chip kind={ready ? 'v' : 'n'}>{ready ? 'Ready' : 'Pending'}</Chip>
                </span>
              </div>
            ))}
          </Rows>
        </Card>
      ) : null}
    </>
  )
}
