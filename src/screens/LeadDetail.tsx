import { useState } from 'react'
import { useParams } from '@tanstack/react-router'
import {
  Banner,
  Btn,
  Card,
  CardBody,
  CardHead,
  Chip,
  Empty,
  Field,
  KeyValues,
  NotFoundRecord,
  PageHead,
  Rows,
  Seg,
  Timeline,
} from '@/components/ui'
import { RequireCap } from '@/components/RequireCap'
import { useSession } from '@/state/session'
import { useUi } from '@/state/ui'
import { LEADS } from '@/data/business'
import { LSTATUS } from '@/data/budget'
import { whoName } from '@/lib/permissions'
import { fmtDT, daysSince } from '@/lib/format'
import { now } from '@/lib/clock'
import type { Lead, LeadNote } from '@/data/types'

type Status = Lead['st']

const ORDER: [Status, string][] = [
  ['new', 'New'],
  ['contacted', 'Contacted'],
  ['interested', 'Interested'],
  ['notnow', 'Not now'],
  ['won', 'Won'],
  ['lost', 'Lost'],
]

/** A lead nobody has touched in this long is stale, however good it looked. */
const STALE_DAYS = 14

/**
 * One lead: who they are, who has spoken to them, and what was said.
 *
 * Staleness is derived from the notes rather than stored, so a lead nobody has
 * touched cannot look fresh because somebody edited a field. The note timeline
 * is the record — the status is a summary of it, which is why moving the status
 * writes a note rather than silently changing a chip.
 */
function LeadDetail() {
  const { leadId } = useParams({ from: '/leads/$leadId' })
  const { me } = useSession()
  const { toast } = useUi()

  const found = LEADS.find((l) => l.id === leadId)

  /* Notes and status are edited on the record the screen is showing, so the
     register and this page cannot disagree about where a lead stands. */
  const [status, setStatus] = useState<Status>(found?.st ?? 'new')
  const [notes, setNotes] = useState<LeadNote[]>(() => [...(found?.notes ?? [])])
  const [draft, setDraft] = useState('')

  if (!found) {
    return <NotFoundRecord what="lead" backTo="/leads" backLabel="Leads" />
  }

  const sorted = [...notes].sort((a, b) => b.at.getTime() - a.at.getTime())
  const lastTouched = sorted[0]?.at ?? null
  const idle = lastTouched ? daysSince(lastTouched) : null
  const stale = idle !== null && idle >= STALE_DAYS && status !== 'won' && status !== 'lost'

  const [label, kind] = LSTATUS[status] ?? [status, 'n']

  const addNote = (body: string) => {
    const trimmed = body.trim()
    if (!trimmed) return
    setNotes((xs) => [...xs, { w: me.id, at: now(), t: trimmed }])
  }

  const submitNote = () => {
    if (!draft.trim()) {
      toast('A note needs something in it')
      return
    }
    addNote(draft)
    setDraft('')
    toast('Note added')
  }

  const moveTo = (next: Status) => {
    if (next === status) return
    const from = LSTATUS[status]?.[0] ?? status
    const to = LSTATUS[next]?.[0] ?? next
    setStatus(next)
    /* The status is a summary of the timeline, so moving it leaves a line in
       the timeline rather than only changing a chip. */
    addNote(`Moved from ${from} to ${to}.`)
    toast(`${found.co} — ${to}`)
  }

  const main = found.contacts.find((c) => c.main) ?? found.contacts[0]

  return (
    <>
      <PageHead
        parent={{ to: '/leads', label: 'Leads' }}
        title={found.co}
        sub={
          <>
            {found.loc} · owned by {whoName(found.own)}
            {lastTouched ? (
              <>
                {' '}
                · last touched <span className="mono">{fmtDT(lastTouched)}</span>
              </>
            ) : null}
          </>
        }
        actions={
          <>
            {found.flag ? <Chip kind="d">Flagged</Chip> : null}
            <Chip kind={kind}>{label}</Chip>
          </>
        }
      />

      {stale ? (
        <Banner kind="r" icon="◷" title={`Nothing recorded for ${idle} days`}>
          Staleness is worked out from the notes, so the way to clear it is to speak to them and say so
          below.
        </Banner>
      ) : null}

      <Card>
        <CardHead
          title="Where it stands"
          actions={<span className="gr" style={{ fontSize: '12.5px' }}>Moving this writes a note</span>}
        />
        <CardBody>
          <Seg options={ORDER} value={status} onChange={moveTo} />
        </CardBody>
      </Card>

      <Card style={{ marginTop: 16 }}>
        <CardHead
          title="Contacts"
          actions={<Chip kind="n">{found.contacts.length}</Chip>}
        />
        {found.contacts.length ? (
          <Rows>
            {found.contacts.map((c) => (
              <div className="rw" key={c.e}>
                <span>{c === main ? '★' : '·'}</span>
                <span>
                  <b>{c.n}</b>
                  <div className="sd">
                    {c.role} · <span className="mono">{c.e}</span> · <span className="mono">{c.p}</span>
                  </div>
                </span>
                <span>{c.main ? <Chip kind="b">Main</Chip> : null}</span>
              </div>
            ))}
          </Rows>
        ) : (
          <Empty>No contacts on file.</Empty>
        )}
      </Card>

      <Card style={{ marginTop: 16 }}>
        <CardHead
          title="Timeline"
          actions={<Chip kind="n">{sorted.length} note{sorted.length === 1 ? '' : 's'}</Chip>}
        />
        <CardBody>
          <Field label="Add a note" hint="Notes are the record. The status above is a summary of them.">
            <textarea
              className="inp"
              rows={3}
              value={draft}
              placeholder={`Spoke to ${main?.n ?? 'them'} about…`}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                /* Enter is a newline in a note; the shortcut takes the modifier. */
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault()
                  submitNote()
                }
              }}
            />
          </Field>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 10 }}>
            <Btn onClick={submitNote} disabled={!draft.trim()}>
              Add note
            </Btn>
            <span className="gr mono" style={{ fontSize: '11px' }}>
              ⌘↵
            </span>
          </div>
        </CardBody>

        {sorted.length ? (
          <CardBody style={{ paddingTop: 0 }}>
            <Timeline
              entries={sorted.map((n, i) => ({
                id: `${n.at.getTime()}-${i}`,
                when: fmtDT(n.at),
                who: whoName(n.w ?? n.who ?? ''),
                what: n.t,
                current: i === 0,
              }))}
            />
          </CardBody>
        ) : (
          <Empty icon="✎">Nothing has been recorded against this lead yet.</Empty>
        )}
      </Card>

      <Card style={{ marginTop: 16 }}>
        <CardHead title="Record" />
        <CardBody>
          <KeyValues
            rows={[
              ['Reference', <span className="mono">{found.id}</span>],
              ['Company', found.co],
              ['Location', found.loc],
              ['Owner', whoName(found.own)],
              ['Status', label],
              ['Notes', String(sorted.length)],
              [
                'Last touched',
                lastTouched ? `${fmtDT(lastTouched)} — ${idle} days ago` : 'Never',
              ],
            ]}
          />
        </CardBody>
      </Card>
    </>
  )
}

export default function Guarded() {
  return (
    <RequireCap cap="pricing">
      <LeadDetail />
    </RequireCap>
  )
}
