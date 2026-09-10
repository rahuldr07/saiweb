import { useState } from 'react'
import { useGo } from '@/lib/nav'
import { Btn, PageHead, Tabs } from '@/components/ui'
import { RequireCap } from '@/components/RequireCap'
import { useUi } from '@/state/ui'
import { useTimeclock } from '@/state/timeclock'
import { ATT, PAYMONTHS, TIMECFG } from '@/data/hrms'
import { AVAIL, STAFF } from '@/data/people'
import { hm, worked } from '@/lib/workingDay'
import { whoName } from '@/lib/permissions'
import { fmtDate } from '@/lib/format'
import { now } from '@/lib/clock'
import { csvName, downloadCSV } from '@/lib/csv'
import type { Person } from '@/data/types'
import { onLeaveOn } from './onLeave'
import { TodayTab } from './tabs/TodayTab'
import { RosterTab } from './tabs/RosterTab'
import { MonthTab } from './tabs/MonthTab'
import { LateTab } from './tabs/LateTab'
import { PatternsTab } from './tabs/PatternsTab'
import { HowTab } from './tabs/HowTab'

type Tab = 'Today' | 'Roster' | 'This month' | 'Late logins' | 'Patterns' | 'How it works'

const rostered = () => STAFF.filter((p) => p.dep.length && p.active !== false)

function Attendance() {
  const navigate = useGo()
  const { toast } = useUi()
  const clock = useTimeclock()

  const [tab, setTab] = useState<Tab>('Today')
  const [month, setMonth] = useState(PAYMONTHS[PAYMONTHS.length - 1])
  const [lateFilter, setLateFilter] = useState('all')

  const list = rostered()
  const roll = ATT[month] ?? {}
  const today = now()

  const openPerson = (id: string) => navigate({ to: '/staff/$personId', params: { personId: id } })

  const openLate = clock.late.filter((x) => !x.waived)

  const inNow = list.filter((p) => {
    const m = clock.markOf(p.id)
    return m && m.in && !m.out
  }).length
  const awayToday = list.filter((p) => onLeaveOn(p.id, today)).length

  const TABS: [Tab, number | null][] = [
    ['Today', clock.waiting || null],
    ['Roster', null],
    ['This month', null],
    ['Late logins', openLate.length || null],
    ['Patterns', null],
    ['How it works', null],
  ]

  const sub =
    tab === 'Today'
      ? `${fmtDate(today)} · ${inNow} of ${list.length} working right now`
      : tab === 'This month'
        ? `${month} · ${list.length} people`
        : tab === 'Roster'
          ? 'The next seven days, with holidays, leave and swaps already in it'
          : tab === 'Late logins'
            ? `Last 30 days · ${TIMECFG.lateGraceMins} minutes of grace before a punch counts as late`
            : tab === 'Patterns'
              ? 'Absence worth a conversation, rather than absence in total'
              : 'Sites, shifts, and the rules a day is judged against'

  const exportMonth = () => {
    const out = downloadCSV(csvName(`attendance-${month.replace(' ', '-')}`), [
      ['Employee', 'Department', 'Days in month', 'Working days', 'Present', 'Paid leave', 'Unpaid'],
      ...list.map((p) => {
        const x = roll[p.id]
        return [p.n, p.dep[0] ?? '', x?.days, x?.working, x?.present, x?.paidLeave, x?.lop]
      }),
    ])
    toast(`${out.name} — ${out.rows.length - 1} people`)
  }

  const exportLate = () => {
    const out = downloadCSV(csvName('late-logins'), [
      ['Date', 'Who', 'Shift', 'Due in', 'Punched', 'Late by (min)', 'Reason', 'Waived'],
      ...clock.late.map((x) => [
        x.dk,
        whoName(x.who),
        x.shift,
        x.due,
        x.at,
        x.mins,
        x.why ?? '',
        x.waived ? 'yes' : '',
      ]),
    ])
    toast(`${out.name} — ${out.rows.length - 1} marks`)
  }

  const stateOf = (p: Person): [string, 'v' | 'b' | 'r' | 'n'] => {
    const m = clock.markOf(p.id)
    if (onLeaveOn(p.id, today)) return ['On leave', 'r']
    if (m && m.in && !m.out) return [`In — since ${m.in}`, 'v']
    if (m && m.out) return [`Done — ${hm(worked(m))}`, 'b']
    if (p.avail !== 'ok') return [AVAIL[p.avail][0], 'n']
    return ['Not marked', 'n']
  }

  return (
    <>
      <PageHead
        title="Attendance and time"
        sub={sub}
        actions={
          tab === 'This month' ? (
            <Btn variant="ghost" onClick={exportMonth}>
              Export
            </Btn>
          ) : tab === 'Late logins' ? (
            <Btn variant="ghost" onClick={exportLate}>
              Export
            </Btn>
          ) : undefined
        }
      />

      <Tabs tabs={TABS} value={tab} onChange={setTab} />

      {tab === 'Today' ? (
        <TodayTab
          list={list}
          today={today}
          inNow={inNow}
          awayToday={awayToday}
          stateOf={stateOf}
          openPerson={openPerson}
        />
      ) : null}

      {tab === 'Roster' ? <RosterTab list={list} today={today} /> : null}

      {tab === 'This month' ? (
        <MonthTab list={list} month={month} onMonth={setMonth} openPerson={openPerson} />
      ) : null}

      {tab === 'Late logins' ? (
        <LateTab
          list={list}
          today={today}
          filter={lateFilter}
          onFilter={setLateFilter}
          openPerson={openPerson}
        />
      ) : null}

      {tab === 'Patterns' ? <PatternsTab list={list} openPerson={openPerson} /> : null}

      {tab === 'How it works' ? <HowTab /> : null}
    </>
  )
}

export default function AttendanceRoute() {
  return (
    <RequireCap cap="all">
      <Attendance />
    </RequireCap>
  )
}
