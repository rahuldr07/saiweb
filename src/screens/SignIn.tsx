import { useState, type FormEvent } from 'react'
import { useRouterState } from '@tanstack/react-router'
import { useGo } from '@/lib/nav'
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

const handled =
  <A extends unknown[]>(fn: (...args: A) => Promise<void>) =>
  (...args: A): void => {
    fn(...args).catch((error: unknown) => {
      console.error('Sign-in:', error)
    })
  }

export default function SignIn() {
  const { me, authState, signInAs, signOut, can } = useSession()
  const { toast } = useUi()
  const navigate = useGo()
  const queryClient = useQueryClient()
  const next = useRouterState({
    select: (s) => (s.location.search as { next?: string }).next,
  })

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [logoBroken, setLogoBroken] = useState(false)

  const landing = (personId: string) => {
    const person = STAFF.find((s) => s.id === personId)
    const wanted = next?.split('/').filter(Boolean)[0]
    if (next && wanted && mayVisit(person, wanted)) return next
    return capabilityOf(person, 'all') ? '/dash' : '/mywork'
  }

  const noServiceBehind = (e: unknown) =>
    !(e instanceof ApiError) || e.status === 404 || e.status === 0 || e.status >= 500

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await startSession(email, password)
      await queryClient.resetQueries()
      navigate({ to: next ?? '/dash', replace: true })
    } catch (err) {
      if (!noServiceBehind(err)) {
        setError(err instanceof ApiError ? err.message : 'That email and password did not match.')
        setBusy(false)
        return
      }

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
          onError={() => setLogoBroken(true)}
        />
      ) : (
        <div style={{ fontSize: 'var(--t-h1)', fontWeight: 650, letterSpacing: '-0.02em' }}>
          <span style={{ color: 'var(--brand)', marginRight: 8 }}>{COMPANY_GLYPH}</span>
          {COMPANY_NAME}
        </div>
      )}
    </div>
  )

  const form = (
    <Card padded>
      <form onSubmit={handled(submit)} style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
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

  if (authState !== 'anonymous') {
    return (
      <div className="authcol">
        {mark}
        <Card padded>
          <div style={{ fontSize: 'var(--t-lead)', fontWeight: 600 }}>{me.n}</div>
          <div className="gr" style={{ fontSize: 'var(--t-small)', marginTop: 2 }}>
            {roleName(me.r)} · {me.dep.join(', ') || 'No department'}
          </div>
          <p className="gr" style={{ fontSize: 'var(--t-small)', marginTop: 12 }}>
            You {can('all') ? 'can' : 'cannot'} see every order, and{' '}
            {can('pricing') ? 'can' : 'cannot'} see pricing and invoices. Your role decides which
            screens exist at all.
          </p>
          <div style={{ marginTop: 16 }}>
            <Btn
              variant="ghost"
              onClick={handled(async () => {
                await signOut()
                setEmail('')
                setPassword('')
                navigate({ to: '/signin', replace: true })
              })}
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
        <p className="gr" style={{ fontSize: 'var(--t-small)', marginTop: 14, textAlign: 'center' }}>
          There is no database behind this build yet, so the password is asked for but not checked.{' '}
          <b className="mono">{ADMIN_EMAIL}</b> signs in as the administrator; any other address
          signs in as staff.
        </p>
      ) : null}
    </div>
  )
}
