import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Btn, Card, CardHead, Field, Form, PageHead, Rows } from '@/components/ui'
import { RequireCap } from '@/components/RequireCap'
import { useUi } from '@/state/ui'
import { US_STATES } from '@/data/catalog'

const STEPS: [string, string][] = [
  ['The company', 'Name, home state and the plan it starts on.'],
  ['People', 'Invite the first admin and the department leads.'],
  ['Counties', 'The places it can take work in — intake validates against this.'],
  ['Products', 'What it sells, at what fee, against what turnaround.'],
]

/** Setting up a new workspace. Nothing is shared with the companies already here. */
function Onboard() {
  const { toast } = useUi()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [state, setState] = useState('PA')
  const [plan, setPlan] = useState('Starter · 4 seats')

  return (
    <>
      <Btn variant="ghost" small style={{ marginBottom: 14 }} onClick={() => navigate({ to: '/dash' })}>
        ← Back
      </Btn>

      <PageHead
        title="Add a company"
        sub="A separate workspace. Staff, orders, clients, counties and quality data are private to it."
      />

      <Card padded>
        <CardHead title="The company" />
        <Form>
          <Field label="Company name">
            <input
              className="inp"
              value={name}
              placeholder="Cascade Abstract"
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
          <Field label="Home state">
            <select className="inp" value={state} onChange={(e) => setState(e.target.value)}>
              {Object.entries(US_STATES).map(([k, v]) => (
                <option key={k} value={k}>
                  {k} — {v}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Plan" hint="Seats can change later; the plan sets the ceiling.">
            <select className="inp" value={plan} onChange={(e) => setPlan(e.target.value)}>
              <option>Starter · 4 seats</option>
              <option>Professional · 8 seats</option>
              <option>Professional · 12 seats</option>
            </select>
          </Field>
        </Form>
        <div style={{ marginTop: 16 }}>
          <Btn
            onClick={() => {
              if (!name.trim()) {
                toast('The company needs a name')
                return
              }
              toast(`${name.trim()} created — ${plan}`)
              navigate({ to: '/dash' })
            }}
          >
            Create the workspace
          </Btn>
        </div>
      </Card>

      <Card style={{ marginTop: 16 }}>
        <CardHead title="What happens next" />
        <Rows>
          {STEPS.map(([title, detail], i) => (
            <div className="rw" key={title}>
              <span className="stepn">
                <span className={`sn${i === 0 ? ' now' : ''}`}>{i + 1}</span>
              </span>
              <span>
                <b>{title}</b>
                <div className="sd">{detail}</div>
              </span>
              <span />
            </div>
          ))}
        </Rows>
      </Card>
    </>
  )
}

export default function OnboardRoute() {
  return (
    <RequireCap cap="people">
      <Onboard />
    </RequireCap>
  )
}
