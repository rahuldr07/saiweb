import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Btn, Card, Chip, Form, Label, PageHead } from '@/components/ui'
import { RequireCap } from '@/components/RequireCap'
import { useUi } from '@/state/ui'
import { LEADS } from '@/data/business'
import { LSTATUS } from '@/data/budget'
import { CLIENTS } from '@/data/catalog'
import { STAFF } from '@/data/people'
import { STALE_BAD, STALE_WARN } from '@/data/business'
import { whoName } from '@/lib/permissions'
import { money } from '@/lib/format'
import { now } from '@/lib/clock'
import { leadAge } from '@/lib/derived'
import type { Lead } from '@/data/types'

/**
 * Adding a lead.
 *
 * A company, someone to call, and what you already know. The note is not
 * optional politeness — the follow-up clock runs from it, so a lead with nothing
 * recorded is a lead nobody will ever be reminded about.
 */

/** Openings that cover most of how a lead actually arrives. */
const NOTE_STARTERS = [
  'Cold email sent — no reply yet.',
  'Inbound enquiry through the website.',
  'Referred by an existing client.',
  'Met at a conference — asked us to follow up.',
  'Called in. Spoke briefly, sending a sample.',
]

interface Draft {
  co: string
  loc: string
  st: Lead['st']
  own: string
  cn: string
  crole: string
  ce: string
  cp: string
  note: string
  flag: boolean
}

const blank = (): Draft => ({
  co: '',
  loc: '',
  st: 'new',
  own: 'hw',
  cn: '',
  crole: '',
  ce: '',
  cp: '',
  note: '',
  flag: false,
})

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

/** The next free `l…` id, so removing one does not strand the counter. */
const nextLeadId = () => {
  let n = 1
  while (LEADS.some((l) => l.id === `l${n}`)) n++
  return `l${n}`
}

/** One line of the live check panel. */
function Check({ ok, warn, children }: { ok: boolean; warn?: boolean; children: string }) {
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      <span className={warn ? 'warn' : ok ? 'ok' : 'gr'}>{warn ? '!' : ok ? '✓' : '○'}</span>
      <span>{children}</span>
    </div>
  )
}

function NewLead() {
  const navigate = useNavigate()
  const { toast } = useUi()
  const [f, setF] = useState<Draft>(blank)
  const [err, setErr] = useState<string | null>(null)

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => {
    setF((d) => ({ ...d, [k]: v }))
    setErr(null)
  }

  /* Three ways this may already exist, and they are not the same problem: an
     existing client must not be cold-called, an existing lead is somebody else's
     to chase, and a shared email is either a duplicate or one person at two firms. */
  const q = f.co.trim().toLowerCase()
  const dupeClient = q
    ? CLIENTS.find((c) => c.n.toLowerCase().includes(q) || q.includes(c.n.toLowerCase()))
    : undefined
  const dupeLead = q
    ? LEADS.find((l) => l.co.toLowerCase().includes(q) || q.includes(l.co.toLowerCase()))
    : undefined
  const mail = f.ce.trim().toLowerCase()
  const dupeMail = mail
    ? LEADS.find((l) => l.contacts.some((c) => (c.e || '').toLowerCase() === mail))
    : undefined

  const create = () => {
    if (!f.co.trim()) return setErr('A company name is required.')
    if (!f.cn.trim() && !f.ce.trim())
      return setErr('Give at least a name or an email — otherwise there is nobody to contact.')
    if (f.ce.trim() && !EMAIL.test(f.ce.trim())) return setErr('That email does not look right.')
    if (!f.note.trim())
      return setErr('Write a first note — it is what the follow-up clock runs from.')

    const id = nextLeadId()
    LEADS.unshift({
      id,
      co: f.co.trim(),
      loc: f.loc.trim() || '—',
      st: f.st,
      own: f.own,
      flag: f.flag,
      contacts: [
        {
          n: f.cn.trim() || '—',
          role: f.crole.trim() || 'Contact',
          e: f.ce.trim(),
          p: f.cp.trim(),
          main: true,
        },
      ],
      notes: [{ w: f.own, at: now(), t: f.note.trim() }],
    })
    toast(`${f.co.trim()} added`)
    navigate({ to: '/leads/$leadId', params: { leadId: id } })
  }

  return (
    <>
      <PageHead
        parent={{ to: '/leads', label: 'Leads' }}
        title="Add a lead"
        sub="A company, someone to call, and what you already know. The note starts the follow-up clock."
      />

      {err ? (
        <div className="bnr d">
          <span className="bi">⚑</span>
          <div>
            <div className="bt">{err}</div>
          </div>
        </div>
      ) : null}

      {dupeClient ? (
        <div className="bnr d">
          <span className="bi">⚑</span>
          <div>
            <div className="bt">{dupeClient.n} is already a client</div>
            {dupeClient.orders.toLocaleString()} orders, {money(dupeClient.total)} invoiced. Worth
            checking before anyone cold-calls them.
          </div>
          <div className="ba">
            <Btn
              variant="ghost"
              small
              onClick={() =>
                navigate({ to: '/clients/$clientCode', params: { clientCode: dupeClient.n } })
              }
            >
              Open the client
            </Btn>
          </div>
        </div>
      ) : dupeLead ? (
        <div className="bnr r">
          <span className="bi">⚑</span>
          <div>
            <div className="bt">{dupeLead.co} is already on the leads list</div>
            <Chip kind={LSTATUS[dupeLead.st][1]}>{LSTATUS[dupeLead.st][0]}</Chip> · owned by{' '}
            {whoName(dupeLead.own)} · last contact {leadAge(dupeLead)} days ago.
          </div>
          <div className="ba">
            <Btn
              variant="ghost"
              small
              onClick={() => navigate({ to: '/leads/$leadId', params: { leadId: dupeLead.id } })}
            >
              Open it
            </Btn>
          </div>
        </div>
      ) : null}

      {dupeMail && dupeMail !== dupeLead ? (
        <div className="bnr r">
          <span className="bi">✉</span>
          <div>
            <div className="bt">That email is already on {dupeMail.co}</div>
            The same person may work at both, or this is a duplicate.
          </div>
          <div className="ba">
            <Btn
              variant="ghost"
              small
              onClick={() => navigate({ to: '/leads/$leadId', params: { leadId: dupeMail.id } })}
            >
              Open it
            </Btn>
          </div>
        </div>
      ) : null}

      <div className="two">
        <div>
          <Card padded>
            <Label>Company</Label>
            <Form>
              <div className="fld" style={{ gridColumn: '1/-1' }}>
                <label htmlFor="nl-co">Name</label>
                <input
                  className="inp"
                  id="nl-co"
                  value={f.co}
                  placeholder="e.g. Ridgeline Title Services"
                  onChange={(e) => set('co', e.target.value)}
                />
              </div>
              <div className="fld">
                <label htmlFor="nl-loc">Location</label>
                <input
                  className="inp"
                  id="nl-loc"
                  value={f.loc}
                  placeholder="City, state"
                  onChange={(e) => set('loc', e.target.value)}
                />
              </div>
              <div className="fld">
                <label htmlFor="nl-st">Status</label>
                <select
                  className="inp"
                  id="nl-st"
                  value={f.st}
                  onChange={(e) => set('st', e.target.value as Lead['st'])}
                >
                  {/* Won and lost are outcomes, not starting points. */}
                  {Object.entries(LSTATUS)
                    .filter(([k]) => !['won', 'lost'].includes(k))
                    .map(([k, v]) => (
                      <option key={k} value={k}>
                        {v[0]}
                      </option>
                    ))}
                </select>
              </div>
            </Form>
          </Card>

          <Card padded style={{ marginTop: 16 }}>
            <Label>Someone to contact</Label>
            <Form>
              <div className="fld">
                <label htmlFor="nl-cn">Name</label>
                <input
                  className="inp"
                  id="nl-cn"
                  value={f.cn}
                  onChange={(e) => set('cn', e.target.value)}
                />
              </div>
              <div className="fld">
                <label htmlFor="nl-cr">Role</label>
                <input
                  className="inp"
                  id="nl-cr"
                  value={f.crole}
                  placeholder="e.g. places the orders"
                  onChange={(e) => set('crole', e.target.value)}
                />
              </div>
              <div className="fld">
                <label htmlFor="nl-ce">Email</label>
                <input
                  className="inp"
                  id="nl-ce"
                  type="email"
                  value={f.ce}
                  onChange={(e) => set('ce', e.target.value)}
                />
              </div>
              <div className="fld">
                <label htmlFor="nl-cp">Phone</label>
                <input
                  className="inp"
                  id="nl-cp"
                  type="tel"
                  value={f.cp}
                  onChange={(e) => set('cp', e.target.value)}
                />
              </div>
            </Form>
            <p className="gr" style={{ fontSize: '12.5px', marginTop: 10 }}>
              One is enough to start. You can add the rest — the orders desk, whoever signs — once you
              know who they are.
            </p>
          </Card>

          <Card padded style={{ marginTop: 16 }}>
            <Label>What you know so far</Label>
            <textarea
              className="inp"
              id="nl-note"
              value={f.note}
              placeholder="How you came across them, what was said, what you promised"
              onChange={(e) => set('note', e.target.value)}
            />
            <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginTop: 10 }}>
              {NOTE_STARTERS.map((s) => (
                <button
                  key={s}
                  type="button"
                  className="pill"
                  style={{ border: '1px solid var(--hair)' }}
                  onClick={() => set('note', s)}
                >
                  {s.split('—')[0].split('.')[0].trim()}
                </button>
              ))}
            </div>
            <p className="gr" style={{ fontSize: '12.5px', marginTop: 10 }}>
              This becomes the first note. The follow-up clock runs from it, so a lead with nothing
              recorded is a lead nobody will chase.
            </p>
          </Card>
        </div>

        <aside>
          <Card padded style={{ position: 'sticky', top: 76 }}>
            <Label>Owner</Label>
            <select
              className="inp"
              id="nl-own"
              aria-label="Lead owner"
              value={f.own}
              onChange={(e) => set('own', e.target.value)}
            >
              {STAFF.filter((s) => s.active !== false).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.n}
                </option>
              ))}
            </select>
            <p className="gr" style={{ fontSize: '11.5px', marginTop: 7 }}>
              Whoever will actually chase it.
            </p>

            <div className="lb" style={{ marginTop: 20 }}>
              Follow-up
            </div>
            <label
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 9,
                fontSize: '12.5px',
                padding: '10px 12px',
                border: '1px solid var(--hair)',
                borderRadius: 9,
                background: f.flag ? 'var(--flag)' : 'var(--tint)',
              }}
            >
              <input
                type="checkbox"
                checked={f.flag}
                onChange={(e) => set('flag', e.target.checked)}
                style={{ marginTop: 2 }}
              />
              <span>
                <b>Flag it now</b>
                <div className="sd gr" style={{ fontSize: '11.5px' }}>
                  Surfaces it immediately rather than waiting for it to go quiet.
                </div>
              </span>
            </label>
            <p className="gr" style={{ fontSize: '11.5px', marginTop: 9 }}>
              Otherwise it turns amber on its own after {STALE_WARN} days with no note, red after{' '}
              {STALE_BAD}. Nothing to schedule.
            </p>

            <div className="lb" style={{ marginTop: 20 }}>
              Check
            </div>
            <div style={{ display: 'grid', gap: 6, fontSize: '12.5px' }}>
              <Check ok={!!f.co.trim()}>Company named</Check>
              <Check ok={!!(f.cn.trim() || f.ce.trim())}>Someone to reach</Check>
              <Check ok={!!f.note.trim()}>First note written</Check>
              <Check ok={!dupeClient && !dupeLead} warn={!!(dupeClient || dupeLead)}>
                {dupeClient ? 'Already a client' : dupeLead ? 'Already a lead' : 'Not a duplicate'}
              </Check>
            </div>

            <Btn style={{ width: '100%', marginTop: 18 }} onClick={create}>
              Add lead
            </Btn>
            <Btn
              variant="ghost"
              style={{ width: '100%', marginTop: 8 }}
              onClick={() => navigate({ to: '/leads' })}
            >
              Cancel
            </Btn>
          </Card>
        </aside>
      </div>
    </>
  )
}

export default function NewLeadRoute() {
  return (
    <RequireCap cap="pricing">
      <NewLead />
    </RequireCap>
  )
}
