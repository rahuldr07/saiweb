import type { ReactNode } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useSession } from '@/state/session'
import { Btn, Card, Empty, PageHead } from './ui'
import { roleName } from '@/lib/permissions'

/**
 * Nav items a person lacks are hidden, but a URL can still be typed or shared —
 * so a guarded screen says plainly which capability it needs and who has it,
 * rather than pretending the screen does not exist.
 */
export function RequireCap({ cap, children }: { cap: string; children: ReactNode }) {
  const { me, can } = useSession()
  const navigate = useNavigate()
  if (can(cap)) return <>{children}</>

  const home = can('all') ? 'dash' : 'mywork'
  return (
    <>
      <PageHead
        title="You do not have access to this"
        sub={`Signed in as ${me.n} — ${roleName(me.r)}.`}
      />
      <Card>
        <Empty
          icon="⊘"
          action={
            <Btn small onClick={() => navigate({ to: `/${home}` })}>
              Back to where you were
            </Btn>
          }
        >
          This screen needs the “{cap}” capability. Ask a company admin to change your role if you should
          be able to see it.
        </Empty>
      </Card>
    </>
  )
}
