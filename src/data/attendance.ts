/**
 * Shift swaps on the board.
 *
 * Static because a swap is an agreement between two named people about one named
 * day — there is nothing to generate, and inventing more of them would not make
 * the screen truer.
 */
import type { Swap } from './types'

export const SWAPS: Swap[] = [
  { id: 'S1', from: 'us', to: 'sm', d: '08/07/2026', why: 'Family function in the evening', st: 'pending' },
  { id: 'S2', from: 'pn', to: 'bn', d: '08/05/2026', why: 'Doctor at 4pm', st: 'approved', by: 'Ashok S' },
]
