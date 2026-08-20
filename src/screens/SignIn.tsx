import { useState, type FormEvent } from 'react'
import { useNavigate, useRouterState } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { Avatar, Assumption, Banner, Btn, Card, CardHead, Chip, PageHead } from '@/components/ui'
import { useSession } from '@/state/session'
import { useUi } from '@/state/ui'
import { STAFF, AVAIL } from '@/data/people'
import { ROLELIST } from '@/data/org'
import { roleName } from '@/lib/permissions'
import { DEMO_IDENTITY, DEMO_IDENTITY_NOTE } from '@/lib/demo'
import { ApiError, startSession } from '@/lib/api'

/**
 * The one public screen.
 *
 * Anonymous visitors get a credential form, which is the only way into the
 * application. Where `DEMO_IDENTITY` is on — development, or a build someone
 * deliberately flagged — the seeded people are also listed, because switching
 * identity is how the permission model is inspected: every role sees a different
 * sidebar and a different register. That list is a demonstration in development
 * and an impersonation anywhere else, so it is never in a default build.
 */
export default function SignIn() {
  const { me, authState, signInAs, signOut, can } = useSession()
  const { toast } = useUi()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const next = useRouterState({
    select: (s) => (s.location.search as { next?: string }).next,
  })

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await startSession(email, password)
      /* The session cookie is set; every cached "not signed in" answer has to go
         before the redirect, or the gate reads the stale one and bounces back. */
      await queryClient.resetQueries()
      navigate({ to: next ?? '/dash', replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not reach the sign-in service.')
    } finally {
      setBusy(false)
    }
  }

  const credentials = (
    <Card padded style={{ maxWidth: 420 }}>
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
        <div className="fld">
          <label htmlFor="si-email">Email</label>
          <input
            className="inp"
            id="si-email"
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="fld">
          <label htmlFor="si-password">Password</label>
          <input
            className="inp"
            id="si-password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {error ? (
          <Banner kind="d" icon="⚠" title="Could not sign you in">
            {error}
          </Banner>
        ) : null}
        <Btn type="submit" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </Btn>
      </form>
    </Card>
  )

  /* Signed in, no demo list: the account screen. */
  if (authState === 'authenticated' && !DEMO_IDENTITY) {
    return (
      <>
        <PageHead
          title="Signed in"
          sub={`${me.n} — ${roleName(me.r)}. Your role decides which screens exist at all.`}
          actions={
            <Btn
              variant="ghost"
              onClick={async () => {
                await signOut()
                navigate({ to: '/signin', replace: true })
              }}
            >
              Sign out
            </Btn>
          }
        />
        <Assumption title="Switching identity is a development affordance">{DEMO_IDENTITY_NOTE}</Assumption>
        <p className="gr" style={{ fontSize: '12.5px' }}>
          You {can('all') ? 'can' : 'cannot'} see every order, and {can('pricing') ? 'can' : 'cannot'} see
          pricing and invoices.
        </p>
      </>
    )
  }

  /* Anonymous: the credential form is the whole screen. */
  if (!DEMO_IDENTITY) {
    return (
      <>
        <PageHead title="Sign in to Title CRM" sub="Your role decides which screens exist at all." />
        {credentials}
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
        title={authState === 'anonymous' ? 'Sign in to Title CRM' : 'Who are you signed in as'}
        sub={
          authState === 'anonymous'
            ? 'Your role decides which screens exist at all.'
            : `Currently ${me.n} — ${roleName(me.r)}. Changing this changes which screens exist at all.`
        }
        actions={
          authState === 'anonymous' ? undefined : (
            <Btn
              variant="ghost"
              onClick={async () => {
                await signOut()
                navigate({ to: '/signin', replace: true })
              }}
            >
              Sign out
            </Btn>
          )
        }
      />

      <Assumption title="Demonstration sign-in">{DEMO_IDENTITY_NOTE}</Assumption>

      {/* Only when signed out. Offering a sign-in form to somebody already signed
          in asks them to do the one thing they have just done. */}
      {authState === 'anonymous' ? credentials : null}

      <h2 className="sec">
        {authState === 'anonymous' ? 'Or sign in as a seeded person' : 'Take the place of a seeded person'}
      </h2>

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
