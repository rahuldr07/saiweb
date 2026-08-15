import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import {
  Btn,
  Card,
  CardBody,
  CardHead,
  Chip,
  Field,
  Form,
  PageHead,
} from '@/components/ui'
import { RequireCap } from '@/components/RequireCap'
import { useSession } from '@/state/session'
import { useUi } from '@/state/ui'
import { LEADS } from '@/data/business'
import { STAFF } from '@/data/people'
import { LSTATUS } from '@/data/budget'
import { now } from '@/lib/clock'
import type { Lead } from '@/data/types'

type Status = Lead['st']

interface Draft {
  company: string
  location: string
  status: Status
  owner: string
  contactName: string
  contactRole: string
  contactEmail: string
  contactPhone: string
  note: string
}

type Errors = Partial<Record<keyof Draft, string>>

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

/**
 * Capturing a lead.
 *
 * The validation rule here is narrower than it looks: a lead is worth almost
 * nothing without a way to contact the people in it, so a name and one working
 * channel are required and everything else is not. Asking for more at this point
 * is how leads end up not being written down at all.
 *
 * The first note is part of the form rather than a follow-up step, because
 * staleness is derived from the notes — a lead created with no note is stale the
 * moment it is saved, which is both true and unhelpful.
 */
function NewLead() {
  const navigate = useNavigate()
  const { me } = useSession()
  const { toast } = useUi()

  const [draft, setDraft] = useState<Draft>({
    company: '',
    location: '',
    status: 'new',
    owner: me.id,
    contactName: '',
    contactRole: '',
    contactEmail: '',
    contactPhone: '',
    note: '',
  })
  const [errors, setErrors] = useState<Errors>({})
  const [touched, setTouched] = useState(false)

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((d) => ({ ...d, [key]: value }))
    if (touched) setErrors(validate({ ...draft, [key]: value }))
  }

  function validate(d: Draft): Errors {
    const e: Errors = {}
    if (!d.company.trim()) e.company = 'A lead needs a company name.'
    else if (LEADS.some((l) => l.co.toLowerCase() === d.company.trim().toLowerCase())) {
      e.company = 'There is already a lead for that company.'
    }
    if (!d.contactName.trim()) e.contactName = 'Somebody has to be the contact.'
    if (!d.contactEmail.trim() && !d.contactPhone.trim()) {
      e.contactEmail = 'An email address or a telephone number — one of the two.'
    }
    if (d.contactEmail.trim() && !EMAIL.test(d.contactEmail.trim())) {
      e.contactEmail = 'That does not look like an email address.'
    }
    return e
  }

  const save = () => {
    setTouched(true)
    const found = validate(draft)
    setErrors(found)
    if (Object.keys(found).length) {
      toast('Some details are still needed')
      return
    }

    const lead: Lead = {
      id: `l${LEADS.length + 1}`,
      co: draft.company.trim(),
      loc: draft.location.trim(),
      st: draft.status,
      own: draft.owner,
      contacts: [
        {
          n: draft.contactName.trim(),
          role: draft.contactRole.trim() || 'Contact',
          e: draft.contactEmail.trim(),
          p: draft.contactPhone.trim(),
          main: true,
        },
      ],
      notes: draft.note.trim()
        ? [{ w: me.id, at: now(), t: draft.note.trim() }]
        : [{ w: me.id, at: now(), t: 'Lead created.' }],
    }

    /* Appended to the register the screens read, so the new lead is on the list
       and openable straight away rather than appearing after a reload. */
    LEADS.push(lead)
    toast(`${lead.co} added`)
    navigate({ to: '/leads/$leadId', params: { leadId: lead.id } })
  }

  const owners = STAFF.filter((s) => s.active !== false)

  return (
    <>
      <PageHead
        parent={{ to: '/leads', label: 'Leads' }}
        title="New lead"
        sub="A company we might work for, and the person to speak to about it."
      />

      <Card>
        <CardHead title="Company" />
        <CardBody>
          <Form>
            <Field label="Company name" hint={errors.company}>
              <input
                className={`inp${errors.company ? ' bad' : ''}`}
                value={draft.company}
                autoFocus
                aria-invalid={!!errors.company}
                placeholder="Vanderbilt American Title"
                onChange={(e) => set('company', e.target.value)}
              />
            </Field>
            <Field label="Location" hint="City and state, as they would say it.">
              <input
                className="inp"
                value={draft.location}
                placeholder="Houston, TX"
                onChange={(e) => set('location', e.target.value)}
              />
            </Field>
            <Field label="Owner" hint="Who is following this up.">
              <select
                className="inp"
                value={draft.owner}
                onChange={(e) => set('owner', e.target.value)}
              >
                {owners.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.n}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Stage">
              <select
                className="inp"
                value={draft.status}
                onChange={(e) => set('status', e.target.value as Status)}
              >
                {Object.entries(LSTATUS).map(([key, [label]]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>
          </Form>
        </CardBody>
      </Card>

      <Card style={{ marginTop: 16 }}>
        <CardHead title="Main contact" actions={<Chip kind="n">Required</Chip>} />
        <CardBody>
          <Form>
            <Field label="Name" hint={errors.contactName}>
              <input
                className={`inp${errors.contactName ? ' bad' : ''}`}
                value={draft.contactName}
                aria-invalid={!!errors.contactName}
                placeholder="Dana Sterling"
                onChange={(e) => set('contactName', e.target.value)}
              />
            </Field>
            <Field label="Role">
              <input
                className="inp"
                value={draft.contactRole}
                placeholder="Orders desk"
                onChange={(e) => set('contactRole', e.target.value)}
              />
            </Field>
            <Field label="Email" hint={errors.contactEmail}>
              <input
                className={`inp${errors.contactEmail ? ' bad' : ''}`}
                type="email"
                value={draft.contactEmail}
                aria-invalid={!!errors.contactEmail}
                placeholder="orders@example.com"
                onChange={(e) => set('contactEmail', e.target.value)}
              />
            </Field>
            <Field label="Telephone">
              <input
                className="inp"
                value={draft.contactPhone}
                placeholder="281.895.1100"
                onChange={(e) => set('contactPhone', e.target.value)}
              />
            </Field>
          </Form>
        </CardBody>
      </Card>

      <Card style={{ marginTop: 16 }}>
        <CardHead title="First note" />
        <CardBody>
          <Field
            label="How this came in"
            hint="Optional, but a lead with no note is stale the day it is created — staleness is worked out from the notes."
          >
            <textarea
              className="inp"
              rows={3}
              value={draft.note}
              placeholder="Referred by an existing client; they run about 40 searches a month in TX."
              onChange={(e) => set('note', e.target.value)}
            />
          </Field>
        </CardBody>
      </Card>

      <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
        <Btn onClick={save}>Add lead</Btn>
        <Btn variant="ghost" onClick={() => navigate({ to: '/leads' })}>
          Cancel
        </Btn>
      </div>
    </>
  )
}

export default function Guarded() {
  return (
    <RequireCap cap="pricing">
      <NewLead />
    </RequireCap>
  )
}
