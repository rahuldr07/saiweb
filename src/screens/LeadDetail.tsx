import { useReducer, useState } from 'react'
import { useNavigate, useParams } from '@tanstack/react-router'
import {
  Btn,
  Card,
  CardBody,
  Chip,
  KeyValues,
  Label,
  NotFoundRecord,
  PageHead,
} from '@/components/ui'
import { RequireCap } from '@/components/RequireCap'
import { useSession } from '@/state/session'
import { useUi } from '@/state/ui'
import { LEADS } from '@/data/business'
import { LSTATUS } from '@/data/budget'
import { STAFF } from '@/data/people'
import { whoName } from '@/lib/permissions'
import { fmtDate, initials } from '@/lib/format'
import { now } from '@/lib/clock'
import { days, isStale, lastTouch, leadAge } from '@/lib/derived'
import type { Lead, LeadContact } from '@/data/types'

/**
 * One lead: who they are, who has spoken to them, and what was said.
 *
 * The notes are the record and everything else is derived from them — the age,
 * the amber, whether it needs chasing. That is why the composer sits at the top
 * of the card rather than the bottom: adding a note is the action this screen
 * exists for, and it is also the thing that resets the quiet clock.
 */

const blankContact = (): LeadContact => ({ n: '', role: '', e: '', p: '' })

/**
 * The fields inside the edit dialogs.
 *
 * They hold their own state and report upward on every keystroke, rather than
 * the dialog mutating a plain object from its JSX — which is both what the
 * compiler refuses and, in a modal that can be reopened, the thing that would
 * quietly keep last time's edits.
 */
const CONTACT_FIELDS: [id: string, label: string, key: 'n' | 'role' | 'e' | 'p', type: string, placeholder: string][] = [
  ['ct-n', 'Name', 'n', 'text', ''],
  ['ct-r', 'Role', 'role', 'text', 'e.g. places the orders'],
  ['ct-e', 'Email', 'e', 'email', ''],
  ['ct-p', 'Phone', 'p', 'tel', ''],
]

function ContactFields({
  initial,
  onChange,
}: {
  initial: LeadContact
  onChange: (d: LeadContact) => void
}) {
  const [d, setD] = useState(initial)
  const upd = (patch: Partial<LeadContact>) => {
    const next = { ...d, ...patch }
    setD(next)
    onChange(next)
  }
  return (
    <>
      <div className="frm">
        {CONTACT_FIELDS.map(([id, lbl, key, type, ph]) => (
          <div className="fld" key={id}>
            <label htmlFor={id}>{lbl}</label>
            <input
              className="inp"
              id={id}
              type={type}
              placeholder={ph}
              value={d[key]}
              onChange={(e) => upd({ [key]: e.target.value })}
            />
          </div>
        ))}
      </div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: '13.5px', marginTop: 14 }}>
        <input type="checkbox" checked={!!d.main} onChange={(e) => upd({ main: e.target.checked })} />{' '}
        Main contact for this company
      </label>
    </>
  )
}

interface LeadFields {
  co: string
  loc: string
  st: Lead['st']
  own: string
}

function LeadDetailFields({
  initial,
  onChange,
}: {
  initial: LeadFields
  onChange: (d: LeadFields) => void
}) {
  const [d, setD] = useState(initial)
  const upd = (patch: Partial<LeadFields>) => {
    const next = { ...d, ...patch }
    setD(next)
    onChange(next)
  }
  return (
    <div className="frm">
      <div className="fld" style={{ gridColumn: '1/-1' }}>
        <label htmlFor="ld-c">Company</label>
        <input className="inp" id="ld-c" value={d.co} onChange={(e) => upd({ co: e.target.value })} />
      </div>
      <div className="fld">
        <label htmlFor="ld-l">Location</label>
        <input
          className="inp"
          id="ld-l"
          placeholder="City, state"
          value={d.loc}
          onChange={(e) => upd({ loc: e.target.value })}
        />
      </div>
      <div className="fld">
        <label htmlFor="ld-s">Status</label>
        <select
          className="inp"
          id="ld-s"
          value={d.st}
          onChange={(e) => upd({ st: e.target.value as Lead['st'] })}
        >
          {Object.entries(LSTATUS).map(([k, v]) => (
            <option key={k} value={k}>
              {v[0]}
            </option>
          ))}
        </select>
      </div>
      <div className="fld" style={{ gridColumn: '1/-1' }}>
        <label htmlFor="ld-o">Owner</label>
        <select className="inp" id="ld-o" value={d.own} onChange={(e) => upd({ own: e.target.value })}>
          {STAFF.filter((s) => s.active !== false).map((s) => (
            <option key={s.id} value={s.id}>
              {s.n}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}

function LeadDetail() {
  const { leadId } = useParams({ from: '/leads/$leadId' })
  const navigate = useNavigate()
  const { me } = useSession()
  const { toast, openModal, closeModal } = useUi()

  /* The lead is edited in place so the register and this screen cannot disagree
     about where it stands; `version` is what tells React the record moved. */
  const [, changed] = useReducer((n: number) => n + 1, 0)
  const [draft, setDraft] = useState('')

  /**
   * Every write goes through here, and it looks up the record again rather than
   * closing over the one this render is drawing. The record outlives the render;
   * the binding does not, and mutating the binding is how a handler ends up
   * editing a lead the screen has already navigated away from.
   */
  const edit = (fn: (l: Lead) => void) => {
    const target = LEADS.find((l) => l.id === leadId)
    if (!target) return
    fn(target)
    changed()
  }

  const lead = LEADS.find((l) => l.id === leadId)
  if (!lead) return <NotFoundRecord what="lead" backTo="/leads" backLabel="Leads" />

  const age = leadAge(lead)
  const stale = isStale(lead)
  const notes = [...lead.notes].sort((a, b) => b.at.getTime() - a.at.getTime())
  const [label, kind] = LSTATUS[lead.st]

  const setStatus = (v: Lead['st']) => {
    edit((l) => {
      l.st = v
      /* Won and lost are not waiting on anybody, so the flag comes off with them. */
      if (v === 'won' || v === 'lost') l.flag = false
    })
    toast(`${lead.co} — ${LSTATUS[v][0]}`)
  }

  const toggleFlag = () => {
    let on = false
    edit((l) => {
      l.flag = !l.flag
      on = !!l.flag
    })
    toast(on ? 'Flagged for follow-up' : 'Flag cleared')
  }

  const addNote = () => {
    const t = draft.trim()
    if (!t) {
      toast('A note needs something in it')
      return
    }
    edit((l) => l.notes.push({ w: me.id, at: now(), t }))
    setDraft('')
    toast('Note added — the quiet clock resets')
  }

  /* ── the three dialogs ─────────────────────────────────────────────────── */

  const copyDetails = () =>
    openModal({
      title: 'Details to carry over',
      body: (
        <>
          <p className="gr" style={{ fontSize: '12.5px', marginBottom: 14 }}>
            Create the client record under Clients, then paste these in.
          </p>
          <Card padded style={{ fontFamily: 'var(--mono)', fontSize: '11.5px', lineHeight: 1.9 }}>
            <div>Company&nbsp;&nbsp; {lead.co}</div>
            <div>Location&nbsp; {lead.loc}</div>
            {lead.contacts.map((c) => (
              <div key={`${c.n}-${c.e}`}>
                Contact&nbsp;&nbsp; {c.n} — {c.role} — {c.e}
                {c.p ? ` — ${c.p}` : ''}
              </div>
            ))}
            <div>Notes&nbsp;&nbsp;&nbsp;&nbsp; {lead.notes.length} on the lead record</div>
          </Card>
        </>
      ),
      footer: (
        <>
          <Btn variant="ghost" onClick={closeModal}>
            Close
          </Btn>
          <Btn
            onClick={() => {
              closeModal()
              navigate({ to: '/company' })
            }}
          >
            Go to clients
          </Btn>
        </>
      ),
    })

  const editContact = (index: number) => {
    const initial = index >= 0 ? { ...lead.contacts[index] } : blankContact()
    /* The dialog's live values, read when Save is pressed. A ref rather than
       state: the footer needs them, and re-rendering this screen per keystroke
       would rebuild the modal underneath the cursor. */
    const held = { ...initial }
    const save = () => {
      if (!held.n.trim() && !held.e.trim()) {
        toast('A name or an email — one of the two')
        return
      }
      edit((l) => {
        if (held.main) l.contacts.forEach((c) => (c.main = false))
        if (index >= 0) Object.assign(l.contacts[index], held)
        else l.contacts.push({ ...held })
      })
      closeModal()
      toast(index >= 0 ? `${held.n || held.e} saved` : `${held.n || held.e} added`)
    }
    openModal({
      title: index >= 0 ? 'Edit contact' : `Add a contact at ${lead.co}`,
      body: <ContactFields initial={initial} onChange={(d) => Object.assign(held, d)} />,
      footer: (
        <>
          <Btn variant="ghost" onClick={closeModal}>
            Cancel
          </Btn>
          <Btn onClick={save}>Save contact</Btn>
        </>
      ),
    })
  }

  const editLead = () => {
    const initial: LeadFields = { co: lead.co, loc: lead.loc, st: lead.st, own: lead.own }
    const held = { ...initial }
    const save = () => {
      if (!held.co.trim()) {
        toast('A company name is required')
        return
      }
      edit((l) => {
        Object.assign(l, {
          co: held.co.trim(),
          loc: held.loc.trim() || '—',
          st: held.st,
          own: held.own,
        })
        if (['won', 'lost'].includes(l.st)) l.flag = false
      })
      closeModal()
      toast(`${held.co.trim()} saved`)
    }
    openModal({
      title: `Edit ${lead.co}`,
      body: <LeadDetailFields initial={initial} onChange={(d) => Object.assign(held, d)} />,
      footer: (
        <>
          <Btn variant="ghost" onClick={closeModal}>
            Cancel
          </Btn>
          <Btn onClick={save}>Save changes</Btn>
        </>
      ),
    })
  }

  const firstContact = lead.notes.reduce((m, n) => (n.at < m ? n.at : m), lead.notes[0].at)

  return (
    <>
      <PageHead
        parent={{ to: '/leads', label: 'Leads' }}
        title={lead.co}
        sub={`${lead.loc} · ${lead.contacts.length} contact${lead.contacts.length === 1 ? '' : 's'} · owned by ${whoName(lead.own)}`}
        actions={
          <>
            <select
              className="inp"
              style={{ minWidth: 150 }}
              aria-label="Status"
              value={lead.st}
              onChange={(e) => setStatus(e.target.value as Lead['st'])}
            >
              {Object.entries(LSTATUS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v[0]}
                </option>
              ))}
            </select>
            <Btn variant={lead.flag ? 'primary' : 'ghost'} onClick={toggleFlag}>
              {lead.flag ? '✓ Flagged for follow-up' : 'Flag for follow-up'}
            </Btn>
          </>
        }
      />

      {lead.st === 'won' ? (
        <div className="bnr v">
          <span className="bi">✓</span>
          <div>
            <div className="bt">Won</div>
            Create the client record separately when you are ready — this lead stays here as the history
            of how it was won.
          </div>
          <div className="ba">
            <Btn variant="ghost" small onClick={copyDetails}>
              Copy details
            </Btn>
            <Btn small onClick={() => navigate({ to: '/company' })}>
              Go to clients
            </Btn>
          </div>
        </div>
      ) : lead.st === 'lost' ? (
        <div className="bnr d">
          <span className="bi">✕</span>
          <div>
            <div className="bt">Lost</div>
            Kept so the reason is on record. Reopen by changing the status.
          </div>
        </div>
      ) : lead.flag || stale ? (
        <div className="bnr r">
          <span className="bi">◷</span>
          <div>
            <div className="bt">{lead.flag ? 'Flagged for follow-up' : 'This lead has gone quiet'}</div>
            {lead.flag
              ? `Someone marked this one to come back to.${stale ? ` It has also had no contact for ${age} days.` : ''}`
              : `No contact for ${age} days. Nothing is scheduled — it turned amber on its own.`}
            <div className="bs">
              Adding a note below clears the quiet flag, because the clock runs from the last thing you
              recorded.
            </div>
          </div>
          {lead.flag ? (
            <div className="ba">
              <Btn variant="ghost" small onClick={toggleFlag}>
                Clear flag
              </Btn>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="two">
        <div>
          <Card>
            <div className="ch">
              <h2>Notes</h2>
              <div className="r gr" style={{ fontSize: '12.5px' }}>
                {lead.notes.length} · last {age} day{age === 1 ? '' : 's'} ago
              </div>
            </div>
            <CardBody>
              <textarea
                className="inp"
                id="lead-note"
                aria-label="Add a note"
                placeholder="What happened — what they said, what you quoted, what you agreed"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault()
                    addNote()
                  }
                }}
              />
              <div
                style={{
                  display: 'flex',
                  gap: 9,
                  marginTop: 10,
                  alignItems: 'center',
                  flexWrap: 'wrap',
                }}
              >
                <Btn small onClick={addNote} disabled={!draft.trim()}>
                  Add note
                </Btn>
                <label
                  style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: '12.5px' }}
                  className="gr"
                >
                  <input type="checkbox" checked={!!lead.flag} onChange={toggleFlag} /> Keep flagged for
                  follow-up
                </label>
                <span className="gr" style={{ fontSize: '11.5px', marginLeft: 'auto' }}>
                  Adding a note resets the quiet clock
                </span>
              </div>
            </CardBody>
            <div className="rows" style={{ border: 'none', borderRadius: 0 }}>
              {notes.map((n, i) => (
                <div
                  className="rw"
                  key={`${n.at.getTime()}-${i}`}
                  style={{ gridTemplateColumns: '32px 1fr auto', alignItems: 'flex-start' }}
                >
                  <span className="ava" style={{ width: 28, height: 28, fontSize: '9.5px' }}>
                    {initials(whoName(n.w ?? n.who ?? ''))}
                  </span>
                  <span>
                    <div style={{ fontSize: '13.5px' }}>{n.t}</div>
                    <div className="sd">{whoName(n.w ?? n.who ?? '')}</div>
                  </span>
                  <span style={{ textAlign: 'right' }}>
                    <div className="mono gr" style={{ fontSize: '11.5px' }}>
                      {fmtDate(n.at)}
                    </div>
                    <div className="sd">
                      {days(n.at)} day{days(n.at) === 1 ? '' : 's'} ago
                    </div>
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <aside>
          <Card padded>
            <Label>Contacts</Label>
            {lead.contacts.map((c, i) => (
              <div
                key={`${c.n}-${c.e}-${i}`}
                style={{ padding: '11px 0', borderTop: i ? '1px solid var(--hair)' : undefined }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <b style={{ fontSize: '13.5px' }}>{c.n}</b>
                  {c.main ? <Chip kind="b">Main</Chip> : null}
                  <Btn
                    variant="ghost"
                    small
                    style={{ marginLeft: 'auto', padding: '4px 9px' }}
                    onClick={() => editContact(i)}
                  >
                    Edit
                  </Btn>
                </div>
                <div className="gr" style={{ fontSize: '12.5px', marginTop: 3 }}>
                  {c.role}
                </div>
                {c.e ? (
                  <div style={{ fontSize: '12.5px', marginTop: 4 }}>
                    <a href={`mailto:${c.e}`} className="br">
                      {c.e}
                    </a>
                  </div>
                ) : null}
                {c.p ? (
                  <div className="gr mono" style={{ fontSize: '11.5px', marginTop: 2 }}>
                    {c.p}
                  </div>
                ) : null}
              </div>
            ))}
            <Btn
              variant="ghost"
              small
              style={{ width: '100%', marginTop: 12 }}
              onClick={() => editContact(-1)}
            >
              ＋ Add contact
            </Btn>
            <p className="gr" style={{ fontSize: '11.5px', marginTop: 10 }}>
              A firm usually has an orders desk, a manager and someone who signs. Keep them separate.
            </p>
          </Card>

          <Card padded style={{ marginTop: 16 }}>
            <Label>Lead</Label>
            <KeyValues
              rows={[
                ['Status', <Chip kind={kind}>{label}</Chip>],
                ['Owner', whoName(lead.own)],
                ['Location', lead.loc],
                ['First contact', <span className="mono">{fmtDate(firstContact)}</span>],
                ['Last contact', <span className="mono">{fmtDate(lastTouch(lead))}</span>],
                ['Notes', String(lead.notes.length)],
              ]}
            />
            <Btn variant="ghost" small style={{ width: '100%', marginTop: 12 }} onClick={editLead}>
              Edit details
            </Btn>
          </Card>
        </aside>
      </div>
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
