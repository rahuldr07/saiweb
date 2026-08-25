import { useNavigate } from '@tanstack/react-router'
import { Avatar, Banner, Card, Label } from './ui'
import {
  aboutOther,
  whenWord,
  wishFor,
  wishNote,
  type Celebration,
} from '@/lib/celebrations'
import { fmtDate } from '@/lib/format'

/**
 * Birthdays and service anniversaries, as two different things.
 *
 * A wish addressed to you and a nudge to wish somebody else are not the same
 * card and should not look like it — one is a greeting, the other is a to-do
 * with a name on it. So `YourWish` is a banner in the celebratory colour and
 * `TeamWishes` is a quiet list, and a person never appears in their own list.
 *
 * Upcoming days are included deliberately. A birthday you find out about on the
 * day is a birthday half the team misses; three days' notice is the whole
 * usefulness of showing it at all.
 */

/** The one addressed to the reader. */
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

/**
 * The ones belonging to everybody else.
 *
 * `title` differs by screen — a person sees their own team, an admin sees the
 * company — so the caller names it rather than this guessing from the list.
 */
export function TeamWishes({
  celebrations,
  title = 'Birthdays and anniversaries',
  empty = 'Nothing in the next few days.',
}: {
  celebrations: Celebration[]
  title?: string
  empty?: string
}) {
  const navigate = useNavigate()
  const today = celebrations.filter((c) => c.inDays === 0)
  const soon = celebrations.filter((c) => c.inDays > 0)

  return (
    <Card padded>
      <Label>{title}</Label>

      {celebrations.length ? (
        <div className="rows" style={{ border: 'none', borderRadius: 0 }}>
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
                <b style={{ fontSize: '13.5px' }}>{aboutOther(c)}</b>
                <div className="sd gr">
                  {c.person.dep.join(', ') || 'No department'} · {fmtDate(c.at)}
                </div>
              </span>
              <span>
                {/* Today is the one that needs saying out loud; the rest are
                    notice, and read as notice. */}
                <span className={c.inDays === 0 ? 'ok' : 'gr'} style={{ fontSize: '12.5px' }}>
                  {whenWord(c.inDays)}
                </span>
              </span>
            </button>
          ))}
        </div>
      ) : (
        <p className="gr" style={{ fontSize: '12.5px', margin: 0 }}>
          {empty}
        </p>
      )}

      {today.length ? (
        <p className="gr" style={{ fontSize: '12.5px', marginTop: 12 }}>
          {today.length === 1 ? 'This one is today' : `${today.length} of these are today`} — worth a
          word before the day goes.
        </p>
      ) : null}
    </Card>
  )
}
