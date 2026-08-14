import { useNavigate } from '@tanstack/react-router'
import { Btn, Card, Empty, PageHead } from '@/components/ui'
import { useSession } from '@/state/session'

/** The design's "that thing is not here" page, reused for any unmatched path. */
export function NotFound() {
  const navigate = useNavigate()
  const { can } = useSession()
  const home = can('all') ? 'dash' : 'mywork'
  const homeLabel = can('all') ? 'dashboard' : 'my work'

  return (
    <>
      <Btn variant="ghost" small style={{ marginBottom: 14 }} onClick={() => navigate({ to: `/${home}` })}>
        ← Back to {homeLabel}
      </Btn>
      <PageHead
        title="That page is not here"
        sub="It may have been removed, or the link may be out of date."
      />
      <Card>
        <Empty
          icon="·"
          action={
            <Btn small onClick={() => navigate({ to: `/${home}` })}>
              Back to {homeLabel}
            </Btn>
          }
        >
          Nothing to show. If you reached this from a link, what it pointed at no longer exists.
        </Empty>
      </Card>
    </>
  )
}

export default NotFound
