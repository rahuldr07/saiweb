import { useNavigate } from '@tanstack/react-router'
import { Avatar, Assumption, Card, CardHead, Chip, PageHead } from '@/components/ui'
import { useSession } from '@/state/session'
import { useUi } from '@/state/ui'
import { STAFF, AVAIL } from '@/data/people'
import { ROLELIST } from '@/data/org'
import { roleName } from '@/lib/permissions'
import { DEMO_IDENTITY, DEMO_IDENTITY_NOTE } from '@/lib/demo'

/**
 * Switching identity is how the permission model is inspected: every role sees a
 * different sidebar and a different Orders register. Real sign-in is Better Auth
 * on the server; this screen chooses which of the seeded people you are.
 *
 * It is gated on `DEMO_IDENTITY`, because choosing a person without a password
 * is a demonstration in development and an impersonation anywhere else.
 */
export default function SignIn() {
  const { me, signInAs, can } = useSession()
  const { toast } = useUi()
  const navigate = useNavigate()

  if (!DEMO_IDENTITY) {
    return (
      <>
        <PageHead
          title="Signed in"
          sub={`${me.n} — ${roleName(me.r)}. Your role decides which screens exist at all.`}
        />
        <Assumption title="Switching identity is a development affordance">
          {DEMO_IDENTITY_NOTE}
        </Assumption>
        <p className="gr" style={{ fontSize: '12.5px' }}>
          You {can('all') ? 'can' : 'cannot'} see every order, and {can('pricing') ? 'can' : 'cannot'} see
          pricing and invoices.
        </p>
      </>
    )
  }

  const pick = (id: string) => {
    const person = STAFF.find((s) => s.id === id)
    signInAs(id)
    toast(`Signed in as ${person?.n} — ${roleName(person?.r ?? 'staff')}`)
    navigate({ to: person && ROLELIST.find((r) => r.id === person.r)?.p.includes('all') ? '/dash' : '/mywork' })
  }

  const byRole = ROLELIST.map((r) => ({
    role: r,
    people: STAFF.filter((s) => s.r === r.id && s.active !== false),
  })).filter((g) => g.people.length)

  return (
    <>
      <PageHead
        title="Who are you signed in as"
        sub={`Currently ${me.n} — ${roleName(me.r)}. Changing this changes which screens exist at all.`}
      />

      <Assumption title="Demonstration sign-in">{DEMO_IDENTITY_NOTE}</Assumption>

      {byRole.map(({ role, people }) => (
        <Card key={role.id} style={{ marginBottom: 16 }}>
          <CardHead
            title={
              <div>
                <h2>{role.n}</h2>
                <div className="gr" style={{ fontSize: '12.5px', marginTop: 3 }}>
                  {role.desc}
                </div>
              </div>
            }
            actions={<Chip kind="n">{role.p.length} capabilities</Chip>}
          />
          <div className="rows" style={{ border: 'none', borderRadius: 0 }}>
            {people.map((p) => (
              <button
                key={p.id}
                type="button"
                className="rw"
                style={{ width: '100%' }}
                onClick={() => pick(p.id)}
              >
                <span>
                  <Avatar name={p.n} />
                </span>
                <span>
                  <b>{p.n}</b>
                  <div className="sd">
                    {p.dep.length ? p.dep.join(', ') : 'No department'} · {p.e}
                  </div>
                </span>
                <span>
                  {p.id === me.id ? (
                    <Chip kind="b">Current</Chip>
                  ) : (
                    <Chip kind={AVAIL[p.avail][1]}>{AVAIL[p.avail][0]}</Chip>
                  )}
                </span>
              </button>
            ))}
          </div>
        </Card>
      ))}

      <p className="gr" style={{ fontSize: '12.5px' }}>
        You currently {can('all') ? 'can' : 'cannot'} see every order, and {can('pricing') ? 'can' : 'cannot'}{' '}
        see pricing and invoices.
      </p>
    </>
  )
}
