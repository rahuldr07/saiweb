import { useState, type FormEvent } from 'react'
import { useNavigate, useRouterState } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { Banner, Btn, Card } from '@/components/ui'
import { useSession } from '@/state/session'
import { useUi } from '@/state/ui'
import { STAFF } from '@/data/people'
import { COMPANY_GLYPH, COMPANY_NAME, LOGO_HEIGHT, LOGO_URL } from '@/data/brand'
import { can as capabilityOf, mayVisit, roleName } from '@/lib/permissions'
import { DEMO_IDENTITY } from '@/lib/demo'
import { ADMIN_EMAIL, checkCredentials } from '@/lib/credentials'
import { ApiError, startSession } from '@/lib/api'

/**
 * The one public screen: a mark, an email, a password.
 *
 * Which of the two is actually verified depends on what is behind the
 * application. With a database, Better Auth checks both and a wrong password is
 * a wrong password. Without one there is nothing to check a password against, so
 * the email only decides which account you land in — `hari@gmail.com` is the
 * administrator, a seeded person's own address is that person, and anything else
 * is a member of production staff.
 *
 * The roster of seeded people that used to sit under this form is gone. It made
 * the screen a picker with a form attached; a sign-in screen should ask for
 * credentials and nothing else.
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
  const [logoBroken, setLogoBroken] = useState(false)

  /* Where somebody lands depends on what they can see. Two ways to get this
     wrong, and the seeded roles hit both: sending production staff to the
     dashboard drops them on a refusal page one second after a successful sign
     in, and so does honouring a `next` they were only redirected off because
     they were not allowed there in the first place. */
  const landing = (personId: string) => {
    const person = STAFF.find((s) => s.id === personId)
    const wanted = next?.split('/').filter(Boolean)[0]
    if (next && wanted && mayVisit(person, wanted)) return next
    return capabilityOf(person, 'all') ? '/dash' : '/mywork'
  }

  /**
   * A real server refusing a real password is not the same as there being no
   * server. Only the second falls through to the local check — otherwise a
   * deployment with a database could be entered by failing authentication.
   */
  const noServiceBehind = (e: unknown) =>
    !(e instanceof ApiError) || e.status === 404 || e.status === 0 || e.status >= 500

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
      if (!noServiceBehind(err)) {
        setError(err instanceof ApiError ? err.message : 'That email and password did not match.')
        setBusy(false)
        return
      }

      /* Statically false in a build with the flag off, which is what lets the
         bundler drop everything below it — the seeded roster check, the admin
         address, the whole local sign-in — rather than shipping an unreachable
         way in and trusting a runtime argument to keep it unreachable. */
      if (!DEMO_IDENTITY) {
        setError('This build signs in against the database. The sign-in service is not reachable.')
        setBusy(false)
        return
      }

      const check = checkCredentials(email, password, { passwordChecked: false })
      if (!check.ok) {
        setError(check.error)
        setBusy(false)
        return
      }
      signInAs(check.person.id)
      toast(`Signed in as ${check.person.n} — ${roleName(check.person.r)}`)
      navigate({ to: landing(check.person.id), replace: true })
    } finally {
      setBusy(false)
    }
  }

  const mark = (
    <div style={{ textAlign: 'center', marginBottom: 26 }}>
      {LOGO_URL && !logoBroken ? (
        <img
          src={LOGO_URL}
          alt={COMPANY_NAME}
          height={LOGO_HEIGHT}
          style={{ height: LOGO_HEIGHT, width: 'auto', maxWidth: '100%' }}
          /* Hot-linked from somebody else's host, so a failure is a real
             possibility rather than a theoretical one. The wordmark takes over
             instead of leaving a broken-image glyph on the front door. */
          onError={() => setLogoBroken(true)}
        />
      ) : (
        <div style={{ fontSize: '23px', fontWeight: 650, letterSpacing: '-0.02em' }}>
          <span style={{ color: 'var(--brand)', marginRight: 8 }}>{COMPANY_GLYPH}</span>
          {COMPANY_NAME}
        </div>
      )}
    </div>
  )

  const form = (
    <Card padded>
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
        <div className="fld">
          <label htmlFor="si-email">Email</label>
          <input
            className="inp"
            id="si-email"
            type="email"
            autoComplete="username"
            required
            autoFocus
            placeholder="you@company.com"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value)
              setError(null)
            }}
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
            onChange={(e) => {
              setPassword(e.target.value)
              setError(null)
            }}
          />
        </div>
        {error ? (
          <Banner kind="d" icon="⚠" style={{ margin: 0 }} title="Could not sign you in">
            {error}
          </Banner>
        ) : null}
        <Btn type="submit" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </Btn>
      </form>
    </Card>
  )

  /* Already signed in: this becomes the account screen rather than offering the
     form again to somebody who has just used it. */
  if (authState !== 'anonymous') {
    return (
      <div className="authcol">
        {mark}
        <Card padded>
          <div style={{ fontSize: '15px', fontWeight: 600 }}>{me.n}</div>
          <div className="gr" style={{ fontSize: '12.5px', marginTop: 2 }}>
            {roleName(me.r)} · {me.dep.join(', ') || 'No department'}
          </div>
          <p className="gr" style={{ fontSize: '12.5px', marginTop: 12 }}>
            You {can('all') ? 'can' : 'cannot'} see every order, and{' '}
            {can('pricing') ? 'can' : 'cannot'} see pricing and invoices. Your role decides which
            screens exist at all.
          </p>
          <div style={{ marginTop: 16 }}>
            <Btn
              variant="ghost"
              onClick={async () => {
                await signOut()
                setEmail('')
                setPassword('')
                navigate({ to: '/signin', replace: true })
              }}
            >
              Sign out
            </Btn>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="authcol">
      {mark}
      {form}
      {DEMO_IDENTITY ? (
        <p className="gr" style={{ fontSize: '12.5px', marginTop: 14, textAlign: 'center' }}>
          There is no database behind this build yet, so the password is asked for but not checked.{' '}
          <b className="mono">{ADMIN_EMAIL}</b> signs in as the administrator; any other address
          signs in as staff.
        </p>
      ) : null}
    </div>
  )
}
