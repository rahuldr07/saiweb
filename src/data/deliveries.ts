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
 * first load rather than on every read.
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

export function loadDeliveries(): Promise<Delivery[]> {
  pending ??= import('./deliveries.json').then((m) =>
    (m.default as RawDelivery[]).map((r) => ({ ...r, d: new Date(r.d) })),
  )
  return pending
}

/** Drops the cache, so a test can load against a different fixture. */
export function resetDeliveries(): void {
  pending = null
}
