import { useState } from 'react'
import { Banner, Btn, Card, CardHead, Label, SecHead, Tabs } from '@/components/ui'
import { useUi } from '@/state/ui'
import { useNavigate } from '@tanstack/react-router'
import { StatusForm, StatusDelete } from './forms/StatusForm'
import { ORDERS } from '@/data/production'
import { csvName, downloadCSV } from '@/lib/csv'
import { moveStatus, setNaming, useNaming, useStatuses } from '@/state/company'

/**
 * The stages an order moves through, and what each is called.
 *
 * The naming table is the smaller half and the more important one: one name per
 * concept, used on every screen and every export. Two names for one thing is how
 * a report counts 8,746 of something the board counts 8,747 of.
 */

const WTABS = ['Stages', 'Naming'] as const
type WTab = (typeof WTABS)[number]

/** The first seven statuses are the main line; the rest are exception branches. */
const MAIN_LINE = 7

export function WorkflowTab() {
  const { openModal, closeModal, toast } = useUi()
  const navigate = useNavigate()
  const statuses = useStatuses()
  const naming = useNaming()
  const [tab, setTab] = useState<WTab>('Stages')

  const editStatus = (k?: string) =>
    openModal({
      title: k ? `Edit ${statuses.find(([x]) => x === k)?.[1][0] ?? ''}` : 'Add a status',
      body: (
        <StatusForm
          statusKey={k}
          onCancel={closeModal}
          onDone={(m) => { closeModal(); toast(m) }}
        />
      ),
    })

  const deleteStatus = (k: string, name: string, used: number) =>
    openModal({
      title: used ? 'That status is in use' : `Delete ${name}?`,
      body: (
        <StatusDelete
          statusKey={k}
          name={name}
          used={used}
          onCancel={closeModal}
          onSee={() => { closeModal(); navigate({ to: '/orders' }) }}
          onDone={(m) => { closeModal(); toast(m) }}
        />
      ),
    })

  const exportStatuses = () =>
    downloadCSV(csvName('statuses'), [
      ['Status', 'Key', 'Where', 'Orders here now'],
      ...statuses.map(([k, v], i) => [
        v[0],
        k,
        i < MAIN_LINE ? `Main line · position ${i + 1}` : 'Exception branch',
        ORDERS.filter((o) => o.stt === k).length,
      ]),
    ])

  return (
    <>
      <SecHead
        sub="The stages an order moves through, and what each is called."
        actions={
          <Btn
            variant="ghost"
            onClick={() => {
              const out = exportStatuses()
              toast(`${out.name} — ${out.rows.length - 1} statuses`)
            }}
          >
            Export
          </Btn>
        }
      />
      <Tabs tabs={[...WTABS]} value={tab} onChange={setTab} />

      {tab === 'Stages' ? (
        <>
          <Card>
            <CardHead
              title="Stages and statuses"
              actions={
                <Btn small onClick={() => editStatus()}>
                  ＋ Add status
                </Btn>
              }
            />
            <div className="rows" style={{ border: 'none', borderRadius: 0 }}>
              {statuses.map(([k, v], i) => {
                const used = ORDERS.filter((o) => o.stt === k).length
                return (
                  <div className="rw" key={k}>
                    <span
                      style={{ width: 12, height: 12, borderRadius: 5, background: v[1] }}
                      aria-hidden="true"
                    />
                    <span>
                      <b>{v[0]}</b>
                      <div className="sd">
                        {i < MAIN_LINE ? `Main line · position ${i + 1}` : 'Exception branch'}
                        {used ? ` · ${used} order${used === 1 ? '' : 's'} here now` : ''}
                      </div>
                    </span>
                    <span style={{ display: 'flex', gap: 5 }}>
                      <Btn
                        variant="ghost"
                        small
                        disabled={i === 0}
                        aria-label={`Move ${v[0]} up`}
                        onClick={() => moveStatus(k, -1)}
                      >
                        ↑
                      </Btn>
                      <Btn
                        variant="ghost"
                        small
                        disabled={i === statuses.length - 1}
                        aria-label={`Move ${v[0]} down`}
                        onClick={() => moveStatus(k, 1)}
                      >
                        ↓
                      </Btn>
                      <Btn
                        variant="ghost"
                        small
                        onClick={() => editStatus(k)}
                      >
                        Edit
                      </Btn>
                      <Btn
                        variant="danger"
                        small
                        onClick={() => deleteStatus(k, v[0], used)}
                      >
                        Delete
                      </Btn>
                    </span>
                  </div>
                )
              })}
            </div>
          </Card>

          <Banner kind="b" icon="⚑" title="A status in use cannot be deleted" style={{ marginTop: 16 }}>
            Deleting a status that live orders point at would orphan them, so the delete is refused
            with a count rather than allowed.
          </Banner>
        </>
      ) : (
        <Card padded>
          <Label>Names used across the product</Label>
          <p className="gr" style={{ fontSize: '12.5px', marginBottom: 14 }}>
            One name per concept, used on every screen and every export. Renaming here renames it
            everywhere.
          </p>
          <div className="tsc">
            <table className="mat">
              <thead>
                <tr>
                  <th>Concept</th>
                  <th>Display name</th>
                  <th>Short code</th>
                  <th>Used on</th>
                </tr>
              </thead>
              <tbody>
                {naming.map((r) => (
                  <tr key={r.concept}>
                    <td>{r.concept}</td>
                    <td>
                      <input
                        className="inp"
                        style={{ maxWidth: 190 }}
                        aria-label={`Display name for ${r.concept}`}
                        defaultValue={r.name}
                        key={`${r.concept}-${r.name}`}
                        onBlur={(e) => setNaming(r.concept, e.target.value)}
                      />
                    </td>
                    <td className="mono">{r.short}</td>
                    <td className="gr">{r.used}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Banner
            kind="r"
            icon="⚑"
            title={'“Sent” and “Completed” were two names for one thing'}
            style={{ marginTop: 16 }}
          >
            Reports counted 8,746 Completed while the board counted 8,747 Sent. There is now one
            name.
          </Banner>
        </Card>
      )}
    </>
  )
}
