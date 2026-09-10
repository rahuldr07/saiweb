import { CLIENTS } from '@/data/catalog'
import { createStore, useStore } from '@/lib/store'
import type { Client } from '@/data/types'

/**
 * Order-number prefixes, and which client each one resolves to.
 *
 * Incoming mail carries an order number rather than a client name, so this is
 * what turns `MJPA-40113` into Morris James without anybody matching it by hand.
 *
 * The overlap check is the whole point of holding them in one place. Two clients
 * with prefixes that share a leading run route mail to whichever happens to
 * match first — a decision nobody made, discovered weeks later. So a prefix that
 * overlaps any other client's is refused at the point of writing.
 *
 * The design materialises a client's default prefixes lazily, on first view, and
 * then checks new ones only against whatever had been materialised — so a clash
 * with a client nobody had opened yet passed. Every client is seeded up front
 * here, which is what makes the check mean anything.
 */

const defaultsFor = (c: Client) => [`${c.dn}MI-`, `${c.dn}PA-`, `${c.dn}FL-`, `${c.dn}WV-`]

const seed = (): Record<string, string[]> =>
  Object.fromEntries(CLIENTS.map((c) => [c.n, defaultsFor(c)]))

const store = createStore<Record<string, string[]>>(seed())

export const usePrefixes = (): Record<string, string[]> => useStore(store)

/**
 * Which client already claims a prefix that would collide with this one, or null.
 *
 * Collision is not equality: `MJP-` and `MJPA-` overlap because one is a prefix
 * of the other, and an order number matching the longer also matches the shorter.
 */
export function clashOf(value: string, exceptClient?: string): [client: string, prefix: string] | null {
  for (const [client, list] of Object.entries(store.get())) {
    for (const p of list) {
      if (client === exceptClient && p === value) continue
      if (p === value || p.startsWith(value) || value.startsWith(p)) return [client, p]
    }
  }
  return null
}

export function addPrefix(clientName: string, value: string): void {
  store.update((prefixes) => ({
    ...prefixes,
    [clientName]: [...(prefixes[clientName] ?? []), value],
  }))
}

export function removePrefix(clientName: string, value: string): void {
  store.update((prefixes) => ({
    ...prefixes,
    [clientName]: (prefixes[clientName] ?? []).filter((p) => p !== value),
  }))
}

/** @see Store.reset in @/lib/store */
export const resetPrefixes = store.reset
