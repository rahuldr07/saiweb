import { useState } from 'react'
import { Avatar, Btn, Card, CardHead, Chip, Field, Form, KeyValues, PageHead, Rows, Tabs } from '@/components/ui'
import { RequireCap } from '@/components/RequireCap'
import { useSession } from '@/state/session'
import { useUi } from '@/state/ui'
import { COTABS, DEPTLIST, PERMS, ROLELIST, STAGES } from '@/data/org'
import { AVAIL, STAFF } from '@/data/people'
import { CLIENTS, PRODUCTS } from '@/data/catalog'
import { SLA } from '@/lib/sla'
import { BUDGET } from '@/data/quality'
import { money } from '@/lib/format'
import { covSummary } from '@/lib/coverage'
import { roleName } from '@/lib/permissions'

/** Tenant settings: profile, people, clients, departments, roles and turnaround. */
function Company() {
  const { tenant } = useSession()
  const { toast } = useUi()
  const [tab, setTab] = useState<string>(COTABS[0])

  return (
    <>
      <PageHead
        title="Company"
        sub={`${tenant.name} · ${tenant.plan}. Everything on this screen is private to this workspace.`}
      />

      <Tabs tabs={COTABS} value={tab} onChange={setTab} />

      {tab === 'Company' ? (
        <Card padded>
          <CardHead title="Profile" />
          <Form>
            <Field label="Company name">
              <input className="inp" defaultValue={tenant.name} />
            </Field>
            <Field label="Home state">
              <input className="inp" defaultValue={tenant.state} />
            </Field>
            <Field label="Plan">
              <input className="inp" readOnly defaultValue={tenant.plan} />
            </Field>
            <Field label="Date format" hint="One format company-wide; effective dates are legally material.">
              <select className="inp" defaultValue="MM/DD/YYYY">
                <option>MM/DD/YYYY</option>
                <option>DD/MM/YYYY</option>
              </select>
            </Field>
          </Form>
          <div style={{ marginTop: 16 }}>
            <Btn onClick={() => toast('Company profile saved')}>Save</Btn>
          </div>
        </Card>
      ) : null}

      {tab === 'Staff' ? (
        <Card>
          <CardHead title={`${STAFF.filter((s) => s.active !== false).length} people`} />
          <Rows>
            {STAFF.filter((s) => s.active !== false).map((p) => (
              <div className="rw" key={p.id}>
                <span>
                  <Avatar name={p.n} />
                </span>
                <span>
                  <b>{p.n}</b>
                  <div className="sd">
                    {roleName(p.r)} · {p.dep.join(', ') || 'No department'} · target {p.cap}/day
                  </div>
                  <div className="sd">{covSummary(p.id)}</div>
                </span>
                <span>
                  <Chip kind={AVAIL[p.avail][1]}>{AVAIL[p.avail][0]}</Chip>
                </span>
              </div>
            ))}
          </Rows>
        </Card>
      ) : null}

      {tab === 'Clients' ? (
        <Card padded>
          <CardHead title={`${CLIENTS.length} clients`} />
          <div className="tsc">
            <table className="mat">
              <thead>
                <tr>
                  <th>Client</th>
                  <th>Terms</th>
                  <th style={{ textAlign: 'right' }}>Orders</th>
                  <th style={{ textAlign: 'right' }}>Invoiced</th>
                  <th style={{ textAlign: 'right' }}>Paid</th>
                  <th style={{ textAlign: 'right' }}>Outstanding</th>
                </tr>
              </thead>
              <tbody>
                {CLIENTS.map((c) => (
                  <tr key={c.n}>
                    <td>
                      <b>{c.n}</b>
                      <div className="sd gr">{c.e || 'no email on file'}</div>
                    </td>
                    <td>{c.terms}</td>
                    <td className="n">{c.orders.toLocaleString('en-US')}</td>
                    <td className="n">{money(c.total)}</td>
                    <td className="n">{money(c.paid)}</td>
                    <td className="n" style={{ color: c.total - c.paid ? 'var(--warn)' : undefined }}>
                      {money(c.total - c.paid)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}

      {tab === 'Departments' ? (
        <Card>
          <CardHead title={`${DEPTLIST.length} departments`} />
          <Rows>
            {DEPTLIST.map((d) => {
              const members = STAFF.filter((s) => s.dep.includes(d.n) && s.active !== false)
              const free = members.filter((s) => s.avail === 'ok').length
              return (
                <div className="rw" key={d.id}>
                  <span className={free ? 'gr' : 'bad'} style={{ fontSize: '14.5px' }}>
                    {free ? '◱' : '⚑'}
                  </span>
                  <span>
                    <b>{d.n}</b>
                    <div className="sd">
                      {d.desc} · {members.length} member{members.length === 1 ? '' : 's'}, {free} available
                      {d.pair ? ` · QCs ${d.pair}` : ''}
                    </div>
                  </span>
                  <span>
                    <Chip kind={d.auto ? 'b' : 'n'}>{d.auto ? 'Auto-assigned' : 'On demand'}</Chip>
                  </span>
                </div>
              )
            })}
          </Rows>
        </Card>
      ) : null}

      {tab === 'Roles' ? (
        <Card padded>
          <CardHead title="What each role can do" />
          <div className="tsc">
            <table className="mat">
              <thead>
                <tr>
                  <th>Capability</th>
                  {ROLELIST.map((r) => (
                    <th key={r.id} style={{ textAlign: 'center' }}>
                      {r.n}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PERMS.map((p) => (
                  <tr key={p.k}>
                    <td>
                      <b>{p.n}</b>
                      <div className="sd gr mono" style={{ fontSize: '11.5px' }}>
                        {p.k}
                      </div>
                    </td>
                    {ROLELIST.map((r) => (
                      <td key={r.id} style={{ textAlign: 'center' }}>
                        {r.p.includes(p.k) ? <span className="ok">✓</span> : <span className="gr">·</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="gr" style={{ fontSize: '12.5px', marginTop: 12 }}>
            Nobody holds “override a blocking rule” by default — a rule that anybody can step around is not a
            rule.
          </p>
        </Card>
      ) : null}

      {tab === 'Workflow' ? (
        <Card>
          <CardHead title="How an order moves" />
          <Rows>
            {STAGES.map((s, i) => (
              <div className="rw" key={s}>
                <span className="stepn">
                  <span className="sn">{i + 1}</span>
                </span>
                <span>
                  <b>{s}</b>
                  <div className="sd">{DEPTLIST.find((d) => d.n === s)?.desc}</div>
                </span>
                <span className="mono gr" style={{ fontSize: '11.5px' }}>
                  {BUDGET.base[s] ? `${BUDGET.base[s]}%` : '—'}
                </span>
              </div>
            ))}
          </Rows>
        </Card>
      ) : null}

      {tab === 'Turnaround & SLA' ? (
        <>
          <Card padded>
            <CardHead title="What we promise" />
            <div className="tsc">
              <table className="mat">
                <thead>
                  <tr>
                    <th>Client</th>
                    <th>Product</th>
                    <th style={{ textAlign: 'right' }}>Hours</th>
                  </tr>
                </thead>
                <tbody>
                  {SLA.map((r, i) => (
                    <tr key={i}>
                      <td>{r.cl}</td>
                      <td>{r.pr}</td>
                      <td className="n">{r.h}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card padded style={{ marginTop: 16 }}>
            <CardHead title="Stage budgets" />
            <p className="gr" style={{ fontSize: '12.5px', margin: '6px 0 12px' }}>
              {BUDGET.buffer}% is held back as slack; the rest is divided between the departments. Hitting
              every checkpoint still leaves time before the client deadline.
            </p>
            <KeyValues
              rows={Object.entries(BUDGET.base).map(([stage, pct]) => [
                stage,
                <span className="mono">{pct}%</span>,
              ])}
            />
          </Card>
        </>
      ) : null}

      {tab === 'Payroll' ? (
        <Card padded>
          <CardHead title="Product catalog" />
          <div className="tsc">
            <table className="mat">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Product</th>
                  <th style={{ textAlign: 'right' }}>Fee</th>
                  <th style={{ textAlign: 'right' }}>SLA</th>
                </tr>
              </thead>
              <tbody>
                {PRODUCTS.map((p) => (
                  <tr key={p.id}>
                    <td className="mono">{p.id}</td>
                    <td>{p.n}</td>
                    <td className="n">{money(p.fee)}</td>
                    <td className="n">{p.h}h</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}
    </>
  )
}

export default function CompanyRoute() {
  return (
    <RequireCap cap="people">
      <Company />
    </RequireCap>
  )
}
