/**
 * The order mailbox.
 *
 * Most orders arrive as email, so intake starts with what landed rather than
 * with an empty form. Each message is read for the fields it obviously carries
 * and nothing is created from it: a person confirms before any of it becomes
 * work, because an address misread from an email is the failure this step
 * exists to prevent.
 *
 * A function rather than a constant so the arrival times move with the clock —
 * a fixture pinned at import would drift the moment `setClock` is called.
 */
import { hrs } from '@/lib/format'
import type { MailItem } from './types'

export const MAILBOX = (): MailItem[] => [
  {
    f: 'Heather Reller · CSS',
    s: 'Attached New Order — Update Search — HOLD for effective date to be at or after new DOT/MTG CSSWV-635007',
    t: hrs(-1.5),
    at: ['Update Search Order.pdf (292 KB)', 'CSSWV-635007.Doc1.PDF (856 KB)'],
    x: [
      ['Order no', 'CSSWV-635007'],
      ['Property', '1204 Ohio Ave, Dunbar WV'],
      ['County', 'Kanawha, WV'],
      ['Product', 'Update'],
      ['Instruction', 'Hold for effective date ≥ new DOT/MTG'],
    ],
    st: 'ready',
  },
  {
    f: 'Meadow Backus · CSS',
    s: 'FW: Attached new order — Search Package ***PLEASE READ REQUIREMENTS*** CSSSC-638312',
    t: hrs(-2.2),
    at: ['New Search Order_2.pdf (375 KB)'],
    x: [
      ['Order no', 'CSSSC-638312'],
      ['Property', '88 Palmetto Way, Greenville SC'],
      ['County', 'Greenville, SC'],
      ['Product', 'Full Search'],
    ],
    st: 'dupe',
    dupe: 'Already imported 2 minutes earlier as order CSSSC-638312 — this is the forwarded copy.',
  },
  {
    f: 'Priya Kulkarni · MGR',
    s: 'Question on 4192254-2',
    t: hrs(-4),
    at: [],
    x: [
      ['Order no', '4192254-2 — matches an existing order'],
      ['Property', 'not stated in the message'],
    ],
    st: 'attach',
    match: '4192254-2',
  },
]

/** What each status means on the card, and the chip that carries it. */
export const MAIL_STATE: Record<MailItem['st'], [string, 'v' | 'd' | 'r']> = {
  ready: ['Ready', 'v'],
  dupe: ['Duplicate', 'd'],
  attach: ['Matches an order', 'r'],
}
