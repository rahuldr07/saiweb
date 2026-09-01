/**
 * The delivery history — 767 orders, what each stage cost, and whether it beat
 * the SLA. It is the only bulk dataset in the application, and it is loaded
 * differently from everything else for two reasons.
 *
 * **It is JSON, not TypeScript.** As a module it was a 348 KB object literal
 * that the engine had to parse as source. Vite is configured with
 * `json: { stringify: true }`, so this file is emitted as a single `JSON.parse`
 * call instead — the parser has a far cheaper job, and V8 is much faster at it
 * than at an equivalent literal.
 *
 * **It is fetched on demand.** Three screens read it and twenty do not. A static
 * import puts it in the critical path of whichever route pulls it in; a dynamic
 * one means the bytes are requested when a screen that reports on them is opened,
 * and never otherwise.
 *
 * The dates are ISO strings on the wire and `Date`s in memory, revived once on
 * first load rather than on every read — as the design's own wall clock, for the
 * reason `reviveDate` gives below.
 */

export interface Delivery {
  id: string
  d: Date
  dk: string
  cl: string
  pr: string
  /** SLA in hours for this product. */
  slaH: number
  /** Hours spent in each stage. */
  st: Record<string, number>
  /** Person id who did each stage. */
  by: Record<string, string>
  byName: Record<string, string>
  /** Total hours end to end. */
  hrs: number
  late: boolean
}

/** The same shape as it sits in the JSON file, before the dates are revived. */
type RawDelivery = Omit<Delivery, 'd'> & { d: string }

/**
 * One promise, shared. Concurrent callers get the same in-flight request rather
 * than each starting their own, and the revive runs once for the whole session.
 */
let pending: Promise<Delivery[]> | null = null

/**
 * The design's clock, read as the reader's own.
 *
 * The seed is the design's world, and the design was authored in IST — so the
 * wire format holds `2026-05-06T08:30:00.000Z`, which is 2pm on the 6th where it
 * was written. Revived as a bare instant it becomes 10.30pm on the *5th* in
 * Honolulu, and the figures a screen derives from it stop being the design's:
 * all 767 rows disagreed with their own `dk` display date there, and the 30-day
 * on-time window enclosed a different set of rows in Sydney than in New York.
 *
 * Every other seed date is written as a local-time construction for exactly this
 * reason. These arrive as strings, so the same thing is done here instead: the
 * IST wall clock is read off the instant and rebuilt in the reader's zone, which
 * is what makes one figure come out of one dataset everywhere.
 */
const IST_OFFSET_MS = 5.5 * 3600_000

const reviveDate = (iso: string): Date => {
  const ist = new Date(new Date(iso).getTime() + IST_OFFSET_MS)
  return new Date(
    ist.getUTCFullYear(),
    ist.getUTCMonth(),
    ist.getUTCDate(),
    ist.getUTCHours(),
    ist.getUTCMinutes(),
  )
}

export function loadDeliveries(): Promise<Delivery[]> {
  pending ??= import('./deliveries.json').then((m) =>
    (m.default as RawDelivery[]).map((r) => ({ ...r, d: reviveDate(r.d) })),
  )
  return pending
}

/** Drops the cache, so a test can load against a different fixture. */
export function resetDeliveries(): void {
  pending = null
}
