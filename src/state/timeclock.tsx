import { createContext, use, useCallback, useMemo, useReducer, type ReactNode } from 'react'
import { OT, type Overtime } from '@/data/hrms'
import { SWAPS } from '@/data/attendance'
import { makeLateLog, makeRegularisations } from '@/lib/attendance'
import { STAFF } from '@/data/people'
import { now } from '@/lib/clock'
import { fmtDate } from '@/lib/format'
import { hhmm, lateBy, mins, placeOf, shiftOf, withLocation, worked, type Fix } from '@/lib/timeclock'
import type { DayMark, LateMark, Punch, Regularisation, Swap } from '@/data/types'

/**
 * The clock, for this session.
 *
 * Punches are the one thing on the HR screens a person makes rather than reads,
 * so they live in state rather than in the seed: nothing here is pre-filled, and
 * the day starts unmarked the way a day does. Everything else — corrections,
 * late marks, swaps, overtime — is seeded but editable, because approving one is
 * the action those screens exist for.
 *
 * A decision is recorded rather than erased. Waiving a late mark leaves it in the
 * log and in the export and stops it counting; an approved correction sits on top
 * of the original punch instead of replacing it. Attendance figures whose
 * workings cannot be seen are the ones people stop trusting.
 */

interface TimeclockValue {
  /** Today's marks, by person. Empty until somebody punches. */
  marks: Record<string, DayMark>
  punches: Punch[]
  corrections: Regularisation[]
  swaps: Swap[]
  late: LateMark[]
  overtime: Overtime[]

  markOf: (id: string) => DayMark | null
  /** Everything waiting on a decision, across all three kinds. */
  waiting: number

  checkIn: (personId: string, done?: (msg: string) => void) => void
  checkOut: (personId: string, done?: (msg: string) => void) => void
  breakStart: (personId: string) => string
  breakEnd: (personId: string) => string

  decideCorrection: (id: string, st: 'approved' | 'rejected') => string
  decideSwap: (id: string, st: 'approved' | 'rejected') => string
  decideOvertime: (id: string, st: 'approved' | 'rejected') => string
  claimOvertime: (personId: string, d: string, minutes: number, why: string) => void
  setWaived: (id: string, waived: boolean) => void
}

const TimeclockContext = createContext<TimeclockValue | null>(null)

const nameOf = (id: string) => STAFF.find((s) => s.id === id)?.n ?? id

/**
 * One ledger, at module scope.
 *
 * Several screens read this — Attendance, My work, a person's record — and a copy
 * per screen is how two of them come to disagree about whether somebody is in.
 * It sits outside the component rather than in a ref so that reading it during a
 * render is legitimate; `changed()` is what tells React it moved.
 */
const ledger = {
  marks: {} as Record<string, DayMark>,
  punches: [] as Punch[],
  corrections: makeRegularisations(),
  swaps: SWAPS.map((s) => ({ ...s })) as Swap[],
  late: makeLateLog(),
  overtime: OT.map((o) => ({ ...o })) as Overtime[],
}

const log = (p: Punch) => ledger.punches.unshift(p)

export function TimeclockProvider({ children }: { children: ReactNode }) {
  const [version, changed] = useReducer((n: number) => n + 1, 0)

  const markOf = useCallback((id: string) => ledger.marks[id] ?? null, [])

  const checkIn = useCallback(
    (personId: string, done?: (msg: string) => void) => {
      const person = STAFF.find((s) => s.id === personId)
      if (!person) return
      withLocation((fix: Fix | null, err) => {
        const at = hhmm(now())
        const sh = shiftOf(person)
        const { where, inside } = placeOf(fix, err)
        const behind = lateBy(at, sh)
        ledger.marks[personId] = {
          in: at,
          out: null,
          late: behind,
          shift: sh.k,
          where,
          inside,
          acc: fix?.acc ?? null,
        }
        log({ who: personId, d: fmtDate(now()), t: at, kind: 'in', where, inside, acc: fix?.acc ?? null })
        changed()
        done?.(behind ? `Checked in ${behind} minutes after ${sh.from}` : 'Checked in')
      })
    },
    [],
  )

  const checkOut = useCallback((personId: string, done?: (msg: string) => void) => {
    const m = ledger.marks[personId]
    if (!m || !m.in) {
      done?.('Check in first')
      return
    }
    withLocation((fix: Fix | null, err) => {
      const at = hhmm(now())
      const { where, inside } = placeOf(fix, err)
      m.out = at
      m.outWhere = where
      log({ who: personId, d: fmtDate(now()), t: at, kind: 'out', where, inside, acc: fix?.acc ?? null })
      changed()
      const total = worked(m)
      done?.(`Checked out — ${Math.floor(total / 60)}h ${String(total % 60).padStart(2, '0')}m`)
    })
  }, [])

  const breakStart = useCallback((personId: string) => {
    const m = ledger.marks[personId]
    if (!m || !m.in) return 'Check in first'
    if (m.out) return 'The day is already closed'
    if (m.breakIn && !m.breakOut) return 'Already on a break'
    m.breakIn = hhmm(now())
    m.breakOut = null
    log({ who: personId, d: fmtDate(now()), t: m.breakIn, kind: 'break out', where: m.where, inside: m.inside })
    changed()
    return 'Break started'
  }, [])

  const breakEnd = useCallback((personId: string) => {
    const m = ledger.marks[personId]
    if (!m || !m.breakIn || m.breakOut) return 'Not on a break'
    m.breakOut = hhmm(now())
    m.breakMins = (m.breakMins ?? 0) + Math.max(0, mins(m.breakOut) - mins(m.breakIn))
    log({ who: personId, d: fmtDate(now()), t: m.breakOut, kind: 'break in', where: m.where, inside: m.inside })
    changed()
    return `Back — ${m.breakMins} minutes of break so far`
  }, [])

  const decideCorrection = useCallback((id: string, st: 'approved' | 'rejected') => {
    const r = ledger.corrections.find((x) => x.id === id)
    if (!r) return ''
    r.st = st
    changed()
    return st === 'approved' ? `${nameOf(r.who)} — day corrected` : 'Declined'
  }, [])

  const decideSwap = useCallback((id: string, st: 'approved' | 'rejected') => {
    const x = ledger.swaps.find((s) => s.id === id)
    if (!x) return ''
    x.st = st
    changed()
    return `Swap ${st}`
  }, [])

  const decideOvertime = useCallback((id: string, st: 'approved' | 'rejected') => {
    const o = ledger.overtime.find((x) => x.id === id)
    if (!o) return ''
    o.st = st
    changed()
    return `${nameOf(o.who)} — overtime ${st}`
  }, [])

  const claimOvertime = useCallback(
    (personId: string, d: string, minutes: number, why: string) => {
      ledger.overtime.unshift({
        id: `O${9000 + ledger.overtime.length}`,
        who: personId,
        d,
        mins: minutes,
        why,
        st: 'pending',
        by: null,
      })
      changed()
    },
    [],
  )

  const setWaived = useCallback((id: string, waived: boolean) => {
    const x = ledger.late.find((l) => l.id === id)
    if (!x) return
    x.waived = waived
    changed()
  }, [])

  const value = useMemo<TimeclockValue>(() => {
    const pendingCorrections = ledger.corrections.filter((r) => r.st === 'pending').length
    const pendingOt = ledger.overtime.filter((o) => o.st === 'pending').length
    const pendingSwaps = ledger.swaps.filter((s) => s.st === 'pending').length
    return {
      marks: ledger.marks,
      punches: ledger.punches,
      corrections: ledger.corrections,
      swaps: ledger.swaps,
      late: ledger.late,
      overtime: ledger.overtime,
      markOf,
      waiting: pendingCorrections + pendingOt + pendingSwaps,
      checkIn,
      checkOut,
      breakStart,
      breakEnd,
      decideCorrection,
      decideSwap,
      decideOvertime,
      claimOvertime,
      setWaived,
    }
    /* `version` is the dependency. The refs are stable and their contents are
       mutated in place, so the counter is the only thing that moves when a punch
       is made or a decision taken — counting lengths would miss every approval,
       which changes a status rather than the size of a list. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    version,
    markOf,
    checkIn,
    checkOut,
    breakStart,
    breakEnd,
    decideCorrection,
    decideSwap,
    decideOvertime,
    claimOvertime,
    setWaived,
  ])

  return <TimeclockContext value={value}>{children}</TimeclockContext>
}

export function useTimeclock(): TimeclockValue {
  const ctx = use(TimeclockContext)
  if (!ctx) throw new Error('useTimeclock must be used inside <TimeclockProvider>')
  return ctx
}
