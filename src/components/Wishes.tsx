import { useGo } from '@/lib/nav'
import { Avatar, Banner, Card, Label, Rows } from './ui'
import {
  aboutOther,
  whenWord,
  wishFor,
  wishNote,
  type Celebration,
} from '@/lib/celebrations'
import { fmtDate } from '@/lib/format'

export function YourWish({
  celebrations,
  firstName,
}: {
  celebrations: Celebration[]
  firstName: string
}) {
  if (!celebrations.length) return null

  return (
    <>
      {celebrations.map((c) => (
        <Banner
          key={`${c.person.id}-${c.kind}`}
          kind="v"
          icon={c.kind === 'birthday' ? '🎂' : '🎉'}
          title={wishFor(c)}
        >
          {wishNote(c, firstName)}
        </Banner>
      ))}
    </>
  )
}

export function TeamWishes({
  celebrations,
  title = 'Birthdays and anniversaries',
  empty = 'Nothing in the next few days.',
}: {
  celebrations: Celebration[]
  title?: string
  empty?: string
}) {
  const navigate = useGo()
  const today = celebrations.filter((c) => c.inDays === 0)
  const soon = celebrations.filter((c) => c.inDays > 0)

  return (
    <Card padded>
      <Label>{title}</Label>

      {celebrations.length ? (
        <Rows bare>
          {[...today, ...soon].map((c) => (
            <button
              key={`${c.person.id}-${c.kind}`}
              type="button"
              className="rw"
              style={{ width: '100%', textAlign: 'left' }}
              title={`Open ${c.person.n}`}
              onClick={() =>
                navigate({ to: '/staff/$personId', params: { personId: c.person.id } })
              }
            >
              <span>
                <Avatar name={c.person.n} />
              </span>
              <span>
                <b style={{ fontSize: 'var(--t-body)' }}>{aboutOther(c)}</b>
                <div className="sd gr">
                  {c.person.dep.join(', ') || 'No department'} · {fmtDate(c.at)}
                </div>
              </span>
              <span>
                <span className={c.inDays === 0 ? 'ok' : 'gr'} style={{ fontSize: 'var(--t-small)' }}>
                  {whenWord(c.inDays)}
                </span>
              </span>
            </button>
          ))}
        </Rows>
      ) : (
        <p className="gr" style={{ fontSize: 'var(--t-small)', margin: 0 }}>
          {empty}
        </p>
      )}

      {today.length ? (
        <p className="gr" style={{ fontSize: 'var(--t-small)', marginTop: 12 }}>
          {today.length === 1 ? 'This one is today' : `${today.length} of these are today`} — worth a
          word before the day goes.
        </p>
      ) : null}
    </Card>
  )
}
