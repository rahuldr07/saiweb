import { useState } from 'react'
import { Btn, PageHead, Tabs } from '@/components/ui'
import { RequireCap } from '@/components/RequireCap'
import { useUi } from '@/state/ui'
import { useLevels } from '@/state/levels'
import { useRules } from '@/state/rules'
import { LiveTab } from './assignment/LiveTab'
import { ExceptionsTab } from './assignment/ExceptionsTab'
import { CapacityTab } from './assignment/CapacityTab'
import { RulesTab } from './assignment/RulesTab'
import { LevelsTab } from './assignment/LevelsTab'

export type AssignTab = 'Live' | 'Exceptions' | 'Capacity' | 'Rules' | 'Levels'

/**
 * The routing engine, shown from five sides.
 *
 * The engine never silently skips a person, so every unplaced stage carries one
 * of five reasons — and the fix for each is different, which is why Exceptions
 * groups by cause rather than by order. The tabs are one screen rather than five
 * because they are five questions about a single run: what it did, what it could
 * not do, how much room is left, which rules produced that, and who is qualified.
 */
function Assignment() {
  const [tab, setTab] = useState<AssignTab>('Live')
  const { toast } = useUi()
  const { coverageGaps } = useLevels()
  const { board, rules, rerun } = useRules()

  const exc = board.run.exc.filter((e) => e.today)
  const gaps = coverageGaps().length

  return (
    <>
      <PageHead
        title="Assignment"
        sub={`Orders arrive through the day and are placed automatically. ${exc.length} need a person.`}
        actions={
          <Btn
            variant="ghost"
            onClick={() => {
              rerun()
              toast(
                `Re-run — ${board.run.assigns.filter((a) => a.today).length} placed, ${exc.length} exceptions`,
              )
            }}
          >
            Re-run
          </Btn>
        }
      />

      <Tabs
        tabs={[
          'Live',
          ['Exceptions', exc.length || null],
          'Capacity',
          'Rules',
          ['Levels', gaps || null],
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === 'Live' ? <LiveTab board={board} rules={rules} onTab={setTab} /> : null}
      {tab === 'Exceptions' ? <ExceptionsTab board={board} onTab={setTab} /> : null}
      {tab === 'Capacity' ? <CapacityTab board={board} /> : null}
      {tab === 'Rules' ? <RulesTab board={board} onTab={setTab} /> : null}
      {tab === 'Levels' ? <LevelsTab /> : null}
    </>
  )
}

export default function AssignmentRoute() {
  return (
    <RequireCap cap="assign">
      <Assignment />
    </RequireCap>
  )
}
