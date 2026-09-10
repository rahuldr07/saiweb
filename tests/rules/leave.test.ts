import { describe, expect, it } from 'vitest'
import { CLASHRULES, approvesFor, leaveCheck, managerOf } from '@/lib/leave'
import { leaveBalance, payTotals, payslipOf } from '@/lib/payroll'
import { ATT, LEAVE, LEAVEPOLICY } from '@/data/hrms'
import { STAFF } from '@/data/people'
import { now } from '@/lib/clock'
import type { Leave, Person } from '@/data/types'

/**
 * `leaveCheck` is the one place a leave request is judged, and the form, the
 * send and the approver's row all read it. Two of its answers cost money: the
 * days it counts beyond the balance become unpaid days, and an unpaid day is a
 * deduction on a payslip. So these tests pin the figures, not the shape.
 *
 * The fixtures they lean on, at the pinned clock of 08/03/2026 (month 8 of 12,
 * so casual leave has accrued 5 of its 8 days):
 *   sm  Sathya Moorthy — Search, eight strong. No casual leave taken: 5 left.
 *   vs  Vikki Sankar   — the only person in Doc Req, so any day he takes empties
 *                        the department. Three casual days taken: 2 left.
 *   gk  Gowthami K     — RTS, with Tara R and Neil Barrow to cover.
 *   ap  Asha P         — three days of paid leave still awaiting approval.
 */

/** Ninety-one days out: past the notice policy and clear of every seeded leave. */
const FAR = new Date(2026, 10, 2)
const FAR_END = new Date(2026, 10, 3)
const MONTH = 'Jul 2026'

const person = (id: string) => STAFF.find((p) => p.id === id)!

/* The policy object is what the Leave settings screen writes to, so a test that
   changes it must put it back or every later test reads the wrong rule. */
function withClashRule<T>(rule: string, fn: () => T): T {
  const saved = LEAVEPOLICY.clashRule
  LEAVEPOLICY.clashRule = rule
  try {
    return fn()
  } finally {
    LEAVEPOLICY.clashRule = saved
  }
}

function withLeave<T>(rows: Leave[], fn: () => T): T {
  LEAVE.push(...rows)
  try {
    return fn()
  } finally {
    rows.forEach((r) => LEAVE.splice(LEAVE.indexOf(r), 1))
  }
}

function withStaff<T>(rows: Person[], fn: () => T): T {
  STAFF.push(...rows)
  try {
    return fn()
  } finally {
    rows.forEach((r) => STAFF.splice(STAFF.indexOf(r), 1))
  }
}

function withUnpaidDays<T>(id: string, extra: number, fn: () => T): T {
  const row = ATT[MONTH][id]
  const saved = row.lop
  row.lop = saved + extra
  try {
    return fn()
  } finally {
    row.lop = saved
  }
}

const off = (id: string, st: Leave['st']): Leave => ({
  id: `TEST-${id}`,
  who: id,
  type: 'pl',
  from: FAR,
  to: FAR_END,
  days: 2,
  st,
  reason: 'injected by the test',
  by: null,
  at: null,
})

describe('the balance a request is judged against', () => {
  it('is derived from the register, not stored', () => {
    expect(leaveBalance('vs').cl).toEqual({ earned: 5, taken: 3, pending: 0, left: 2, annual: 8 })

    /* And the sentence the applicant reads quotes those same two figures, so the
       banner cannot drift from the arithmetic behind it. */
    const over = leaveCheck('vs', 'cl', 3, FAR, FAR_END)
    expect(over.notes[0].body).toContain('2 left of 5 earned')
  })

  it('counts a request still awaiting approval as already spent', () => {
    expect(leaveBalance('ap').pl).toEqual({ earned: 12, taken: 0, pending: 3, left: 9, annual: 18 })

    expect(leaveCheck('ap', 'pl', 9, FAR, FAR_END).overBalance).toBe(0)
    /* The counter-example: ten days sits inside the twelve she has earned, so if
       the three pending days were not held back this would read as free. */
    expect(leaveCheck('ap', 'pl', 10, FAR, FAR_END).overBalance).toBe(1)
  })

  it('says what would remain, and says nothing about unpaid days, while it fits', () => {
    const c = leaveCheck('sm', 'cl', 2, FAR, FAR_END)

    expect(c.overBalance).toBe(0)
    expect(c.blocked).toBe(false)
    expect(c.needReason).toBe(false)
    expect(c.notes).toEqual([{ kind: 'v', body: '3 days would remain.' }])
  })

  it('treats a request that exactly exhausts the balance as still inside it', () => {
    const exact = leaveCheck('vs', 'cl', 2, FAR, FAR_END)
    expect(exact.overBalance).toBe(0)
    expect(exact.notes[0]).toEqual({ kind: 'v', body: '0 days would remain.' })

    /* One day the other side of the boundary, which is what makes the equality
       above a decision rather than an accident. */
    const over = leaveCheck('vs', 'cl', 3, FAR, FAR_END)
    expect(over.overBalance).toBe(1)
    expect(over.notes[0].kind).toBe('d')
    expect(over.notes[0].title).toBe('1 day beyond your balance')

    /* Half days are the reason the excess is rounded rather than counted. */
    const half = leaveCheck('vs', 'cl', 2.5, FAR, FAR_END)
    expect(half.overBalance).toBe(0.5)
    expect(half.notes[0].title).toBe('0.5 days beyond your balance')
  })

  it('never reports an overdraft on a balance that was not touched', () => {
    expect(leaveCheck('sm', 'pl', 1, FAR, FAR_END).overBalance).toBe(0)

    /* Unclamped, the same subtraction runs backwards — and a negative overBalance
       reaches the leave record and the approver's row as a count of unpaid days. */
    expect(1 - leaveBalance('sm').pl.left).toBe(-11)
  })
})

describe('cover', () => {
  it('lets a request through when the department can spare the person', () => {
    const c = leaveCheck('gk', 'cl', 1, FAR, FAR_END)

    expect(c.cover).toEqual({ dep: 'RTS', team: 3, off: 1, left: 2 })
    expect(c.short).toBe(0)
    expect(c.blocked).toBe(false)
    expect(c.needReason).toBe(false)
    expect(c.notes).toHaveLength(1)
  })

  it('fires the moment the same request would empty the department', () => {
    /* The clean verdict above is worth nothing unless it can go the other way on
       the same person and the same dates, so break the input here: put the other
       two of RTS off across them — one approved, one still pending, because both
       count as cover already gone. */
    expect(leaveCheck('gk', 'cl', 1, FAR, FAR_END).needReason).toBe(false)

    const rows = [off('tr', 'pending'), off('nb', 'approved')]
    const broken = withLeave(rows, () => leaveCheck('gk', 'cl', 1, FAR, FAR_END))

    expect(broken.cover).toEqual({ dep: 'RTS', team: 3, off: 3, left: 0 })
    expect(broken.short).toBe(1)
    expect(broken.needReason).toBe(true)
    expect(broken.clash.map((x) => x.who)).toEqual(['tr', 'nb'])
    expect(broken.notes[1].title).toBe('RTS would have nobody working')
    expect(broken.notes[1].body).toContain('Already off across these dates: Tara R')
    expect(broken.notes[1].body).toContain('Neil Barrow')

    expect(leaveCheck('gk', 'cl', 1, FAR, FAR_END).needReason).toBe(false)
  })

  it('leaves the policy to decide how hard it pushes back', () => {
    const ask = () => leaveCheck('vs', 'cl', 2, FAR, FAR_END)

    const reason = ask()
    expect(reason.short).toBe(1)
    expect(reason.needReason).toBe(true)
    expect(reason.blocked).toBe(false)
    expect(reason.notes[1].body).toContain('You can still send it')

    const blocked = withClashRule('block', ask)
    expect(blocked.blocked).toBe(true)
    expect(blocked.needReason).toBe(false)
    expect(blocked.notes[1].body).toContain('This request cannot be sent while that is true')

    /* Warn only: no gate at all, but the applicant is still told — the note is
       the whole of what the setting does. */
    const warned = withClashRule('warn', ask)
    expect(warned.blocked).toBe(false)
    expect(warned.needReason).toBe(false)
    expect(warned.notes[1].title).toBe('Doc Req would have nobody working')
    expect(warned.notes[1].body).toContain('Worth agreeing cover before you send it')

    expect(LEAVEPOLICY.clashRule).toBe('reason')
  })

  it('offers exactly the three settings the check implements', () => {
    /* The Leave settings screen lists this map and indexes it by the policy value
       unguarded, so a key here with no branch in `leaveCheck` ships as a setting
       that silently does nothing, and a policy value with no key crashes the
       screen. Drive every key through the same request and read the verdict back. */
    const verdicts = Object.keys(CLASHRULES).map((rule) => {
      const c = withClashRule(rule, () => leaveCheck('vs', 'cl', 2, FAR, FAR_END))
      return [rule, `blocked=${c.blocked} needReason=${c.needReason}`] as const
    })

    expect(Object.fromEntries(verdicts)).toEqual({
      warn: 'blocked=false needReason=false',
      reason: 'blocked=false needReason=true',
      block: 'blocked=true needReason=false',
    })
    expect(Object.keys(CLASHRULES)).toContain(LEAVEPOLICY.clashRule)
  })
})

describe('who a request goes to', () => {
  /**
   * The roster carries one lead, so every branch of `managerOf` lands on Ashok S
   * and none of them can be told from another. Each assertion that depends on a
   * particular branch therefore builds the roster where that branch is the only
   * thing deciding, and puts it back.
   */
  const lead = (id: string, n: string, dep: string[]): Person => ({
    ...STAFF[0],
    id,
    n,
    dep,
    r: 'lead',
    active: true,
  })

  it('sends everyone to a named person, and the lead to the admin above them', () => {
    expect(managerOf(person('sm'))?.n).toBe('Ashok S')
    expect(managerOf(person('vs'))?.n).toBe('Ashok S')

    /* Ashok S leads Typing and is in it, so the department match would hand him
       his own requests — the id guard is the only thing that does not. */
    expect(managerOf(person('sk'))?.n).toBe('Harry Whitfield')
    expect(
      STAFF.find((x) => x.r === 'lead' && x.dep.some((d) => person('sk').dep.includes(d)))?.id,
      'the self-match this guards against no longer reproduces',
    ).toBe('sk')

    expect(managerOf(undefined)).toBeNull()
  })

  it('prefers a lead of the person’s own department over any other', () => {
    /* Sathya is in Search and currently routes to the Typing lead by fallback, so
       put a lead in Search and the preference becomes the only thing that could
       move him. */
    expect(managerOf(person('sm'))?.id).toBe('sk')

    withStaff([lead('sl', 'Search Lead', ['Search'])], () => {
      expect(managerOf(person('sm'))?.id).toBe('sl')
      /* A department the new lead has nothing to do with is untouched. */
      expect(managerOf(person('pn'))?.id).toBe('sk')
      /* And the new lead's own requests go to the other lead, not to herself. */
      expect(managerOf(person('sl'))?.id).toBe('sk')
    })

    expect(managerOf(person('sm'))?.id).toBe('sk')
  })

  it('will not route a request to someone who has left', () => {
    const gone: Person = { ...lead('xl', 'Departed Lead', ['Search']), active: false }

    withStaff([gone], () => {
      expect(managerOf(person('sm'))?.id, 'a departed lead was given live requests').toBe('sk')
    })

    /* The counter-example: the same lead, still on the roster, does take them —
       so the assertion above turns on `active` and nothing else. */
    withStaff([{ ...gone, active: true }], () => {
      expect(managerOf(person('sm'))?.id).toBe('xl')
    })
  })

  it('puts every person with a department in exactly one approver’s queue', () => {
    /* A request that reaches no queue is never approved, and one that reaches two
       is approved twice. Both are the same bug in `managerOf`, seen from the other
       side, so this pins the whole partition rather than a count. */
    const routed = STAFF.flatMap((approver) => approvesFor(approver.id).map((p) => p.id))
    const withDept = STAFF.filter((p) => p.dep.length).map((p) => p.id)

    expect([...routed].sort()).toEqual([...withDept].sort())

    expect(approvesFor('hw').map((p) => p.id)).toEqual(['sk'])
    expect(approvesFor('sk')).toHaveLength(26)
    expect(approvesFor('sk').map((p) => p.id)).not.toContain('sk')

    /* Harry has no department, so nobody approves for him — which is correct, and
       is why the partition is over people with one rather than over the roster. */
    expect(routed).not.toContain('hw')
  })
})

describe('notice', () => {
  it('counts whole days between midnights, so today is nought days rather than minus one', () => {
    const today = new Date(2026, 7, 3)
    const c = leaveCheck('sm', 'cl', 1, today, today)

    expect(c.notice).toBe(0)
    expect(c.notes[1]).toEqual({
      kind: 'r',
      title: 'Starting today, against 3 normally expected.',
      body: 'Allowed, and the approver will see that it was short notice.',
    })

    /* Measured against the instant instead of the midnight — the seed clock is
       5:30 PM — the same request reads as a day of notice already spent, which
       is the bug the midnight() call is there to prevent. */
    expect(Math.round((today.getTime() - now().getTime()) / 86400000)).toBe(-1)
  })

  it('counts up from there, and stops warning once the policy is met', () => {
    const tomorrow = new Date(2026, 7, 4)
    const soon = leaveCheck('sm', 'cl', 1, tomorrow, tomorrow)
    expect(soon.notice).toBe(1)
    expect(soon.notes[1].title).toBe('1 day notice, against 3 normally expected.')

    const later = leaveCheck('sm', 'cl', 1, FAR, FAR_END)
    expect(later.notice).toBe(91)
    expect(later.notes).toHaveLength(1)
  })

  it('warns about a long stretch above the policy maximum, without refusing it', () => {
    const long = leaveCheck('sm', 'pl', 11, FAR, new Date(2026, 10, 12))
    expect(long.notes[1].title).toBe('11 days at once, against a normal maximum of 10.')
    expect(long.blocked).toBe(false)

    /* Ten is the maximum, not the first offence. */
    expect(leaveCheck('sm', 'pl', 10, FAR, new Date(2026, 10, 11)).notes).toHaveLength(1)
  })
})

describe('the day beyond the balance, on the payslip', () => {
  it('costs exactly one working day of gross, wherever it lands', () => {
    const check = leaveCheck('sm', 'cl', 8, FAR, new Date(2026, 10, 9))
    expect(check.overBalance).toBe(3)
    expect(check.notes[0].title).toBe('3 days beyond your balance')
    expect(check.notes[0].body).toContain('shows on your payslip as a deduction')

    const p = person('sm')
    const before = payslipOf(p, MONTH)
    expect(before.unpaid).toBe(0)
    expect(before.lopAmt).toBe(0)
    expect(before.gross).toBe(23968)

    const after = withUnpaidDays('sm', check.overBalance, () => payslipOf(p, MONTH))
    expect(after.unpaid).toBe(3)
    expect(after.lopAmt).toBe(Math.round(before.perDay * check.overBalance))
    expect(after.lopAmt).toBe(2663)
    /* Earnings are rounded per component, so this identity is checked against the
       figures rather than assumed: the three unpaid days take the whole of the
       loss of pay off the gross and nothing else. */
    expect(before.gross - after.gross).toBe(2663)
    expect(after.net).toBe(20710)

    /* And the month's register picks him up as someone to look at before payroll
       is approved, which is the check that stops it being paid unnoticed. */
    const flagged = withUnpaidDays('sm', check.overBalance, () => payTotals(MONTH).lop.map((x) => x.p.id))
    expect(flagged).toContain('sm')
    expect(payTotals(MONTH).lop.map((x) => x.p.id)).not.toContain('sm')
  })

  /**
   * DEFECT — the two halves of that path are not joined.
   *
   * `overBalance` is computed, stamped on the leave record and shown to both the
   * applicant and the approver, and the note promises it "shows on your payslip
   * as a deduction". Nothing writes it anywhere the payslip reads: `payslipOf`
   * takes unpaid days from `ATT[month][id].lop` alone, and approving a request
   * only sets `st`. So the excess is deducted from the leave balance and never
   * from the pay. Test below documents the behaviour as it stands.
   */
  it('does not reach the payslip on its own — only the balance moves', () => {
    const rec: Leave = {
      id: 'TEST-over',
      who: 'sm',
      type: 'cl',
      from: new Date(2026, 6, 6),
      to: new Date(2026, 6, 13),
      days: 8,
      st: 'approved',
      reason: 'injected by the test',
      by: null,
      at: null,
      overBalance: 3,
    }

    withLeave([rec], () => {
      expect(leaveBalance('sm').cl.taken).toBe(8)
      expect(leaveBalance('sm').cl.left).toBe(0)

      const s = payslipOf(person('sm'), MONTH)
      expect(s.unpaid).toBe(0)
      expect(s.lopAmt).toBe(0)
      expect(s.gross).toBe(23968)
    })

    expect(leaveBalance('sm').cl.left).toBe(5)
  })

  /* The same three days, asserted the way they ought to behave. Marked `.fails`
     because they do not: this turns red the day something wires an approved
     over-balance request into the month's attendance, and should be unmarked
     then rather than deleted. */
  it.fails('should deduct an approved over-balance request from the pay', () => {
    const rec: Leave = {
      id: 'TEST-over-2',
      who: 'sm',
      type: 'cl',
      from: new Date(2026, 6, 6),
      to: new Date(2026, 6, 13),
      days: 8,
      st: 'approved',
      reason: 'injected by the test',
      by: null,
      at: null,
      overBalance: 3,
    }

    withLeave([rec], () => {
      expect(payslipOf(person('sm'), MONTH).unpaid).toBe(3)
    })
  })
})

describe('what it lets through in silence', () => {
  /**
   * DEFECT — a back-dated request draws no comment at all.
   *
   * The notice note is guarded by `notice >= 0`, so the one case that most needs
   * an approver's attention is the one case that arrives unannotated. The only
   * thing currently preventing it is the `min` attribute on the form's date
   * input; `leaveCheck` itself is happy.
   */
  it('says nothing about a request that started two days ago', () => {
    const back = new Date(2026, 7, 1)
    const c = leaveCheck('sm', 'cl', 1, back, back)

    expect(c.notice).toBe(-2)
    expect(c.notes.filter((n) => n.kind === 'r')).toEqual([])
  })

  /**
   * DEFECT — an id that is on no roster gets a full year's accrual.
   *
   * `leaveBalance` builds `earned` from the leave-type table without ever looking
   * the person up, so an unknown id reads as a member of staff with an untouched
   * balance rather than as nothing. `cover` is the only field that notices.
   */
  it('answers for a person who does not exist', () => {
    const c = leaveCheck('nobody', 'cl', 1, FAR, FAR_END)

    expect(c.cover).toBeNull()
    expect(c.overBalance).toBe(0)
    expect(c.notes).toEqual([{ kind: 'v', body: '4 days would remain.' }])
  })

  /**
   * DEFECT, minor — leave the applicant is already on does not register.
   *
   * `clashesWith` skips the applicant's own records, and nothing else looks for
   * an overlap, so a second request across dates already approved is judged as if
   * the first did not exist and spends the balance twice.
   */
  it('does not notice that the applicant is already off across those dates', () => {
    /* vs is approved off 06/17–06/18 on casual leave already. */
    const again = new Date(2026, 5, 17)
    const c = leaveCheck('vs', 'cl', 2, again, new Date(2026, 5, 18))

    expect(c.clash).toEqual([])
    expect(c.notes[0]).toEqual({ kind: 'v', body: '0 days would remain.' })
  })

  /**
   * DEFECT, minor — unpaid leave is stamped as an overdraft with nothing said.
   *
   * The balance note is only built for types that accrue, so choosing "Unpaid
   * leave" produces no note at all, while every day of it is counted into
   * `overBalance` and reaches the approver's row as "2 beyond balance — unpaid".
   */
  it('counts every day of an explicitly unpaid request as beyond the balance', () => {
    const c = leaveCheck('sm', 'lop', 2, FAR, FAR_END)

    expect(c.notes).toEqual([])
    expect(c.overBalance).toBe(2)
  })
})
