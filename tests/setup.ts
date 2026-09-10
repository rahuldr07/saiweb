import { afterEach } from 'vitest'

import { resetClock } from '@/lib/clock'
import { resetBoard as resetAssignmentBoard } from '@/lib/engine'
import { resetCompany } from '@/state/company'
import { resetCoverage } from '@/state/coverage'
import { resetQcRules } from '@/state/qcRules'
import { resetPrefixes } from '@/screens/clients/prefixes'
import { resetUpdates } from '@/screens/mywork/updates'
import { resetBox } from '@/screens/petty/store'
import { resetOrders } from '@/screens/orders/store'
import { resetHiringBoard } from '@/screens/hiring/store'

/**
 * Puts every piece of module-level state back between tests.
 *
 * Ten modules hold something a test can write to — nine stores and the clock —
 * and `store.reset` says in as many words that it exists "for tests, which must
 * not inherit each other". Only `resetOrders` and `resetClock` were ever called,
 * and only by the two files that happened to need them, so a test that changed
 * the salary structure, the coverage matrix or the QC rules left it changed for
 * every test after it in the same file.
 *
 * Doing it here rather than per file is the point: a store added tomorrow needs
 * one line in this list, not a new `afterEach` in fifteen test files that nobody
 * remembers to write.
 *
 * `afterEach` rather than `beforeEach` so a test that fails still leaves the next
 * one a clean slate, and so the reset runs even for tests that never touched a
 * store.
 */
afterEach(() => {
  /* The clock first: several stores are seeded from values derived against it. */
  resetClock()

  resetCompany()
  resetCoverage()
  resetQcRules()
  resetPrefixes()
  resetUpdates()
  resetBox()
  resetOrders()
  resetHiringBoard()

  /* Not a store — the memoised assignment run. Dropped last, because it is
     computed from the roster and the rules the stores above have just restored,
     and a memo held over from a modified roster is the same bug in a different
     shape. */
  resetAssignmentBoard()
})

/*
 * Deliberately not reset here: `resetDeliveries` (src/data/deliveries.ts) and
 * `resetQcLog` (src/data/quality.ts). Both drop a promise cache around a static
 * JSON import rather than mutable state, so clearing them between tests would
 * re-parse both files a few hundred times and protect nothing. A test that wants
 * a different fixture still calls them itself.
 */
