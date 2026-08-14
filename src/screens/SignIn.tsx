import { useNavigate } from '@tanstack/react-router'
import { Avatar, Assumption, Card, CardHead, Chip, PageHead } from '@/components/ui'
import { useSession } from '@/state/session'
import { useUi } from '@/state/ui'
import { STAFF, AVAIL } from '@/data/people'
import { ROLELIST } from '@/data/org'
import { roleName } from '@/lib/permissions'

/**
 * Switching identity is how the permission model is inspected: every role sees a
 * different sidebar and a different Orders register. Real sign-in is Better Auth
 * on the server; this screen chooses which of the seeded people you are.
 */
export default function SignIn() {
  const { me, signInAs, can } = useSession()
  const { toast } = useUi()
  const navigate = useNavigate()

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

      <Assumption title="Demonstration sign-in">
        Choosing a person here swaps the session without a password. The production build authenticates with
        Better Auth against the users table; permissions stay in our own tables either way, so what each role
        can reach is identical.
      </Assumption>

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
