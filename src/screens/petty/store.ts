import { COUNTS, PETTY, PETTYCFG } from '@/data/hrms'
import { createStore, useStore } from '@/lib/store'
import type { PettyConfig, PettyCount, PettyEntry } from '@/data/types'

/**
 * The box, held outside React.
 *
 * Three things change on this screen and all three have to survive leaving it:
 * entries recorded, counts taken, and how the box is run. A ledger that forgets
 * an entry the moment you look at payroll is not a ledger.
 *
 * The seed arrays are the starting value and are never written to — every change
 * produces new ones, which is what `useSyncExternalStore` needs to see in order
 * to re-render, and what stops an edit here from silently altering what every
 * other importer of `PETTY` sees.
 */

interface Box {
  entries: PettyEntry[]
  counts: PettyCount[]
  cfg: PettyConfig
}

const store = createStore<Box>({ entries: PETTY, counts: COUNTS, cfg: PETTYCFG })

export const useBox = (): Box => useStore(store)

/** Next free id in a `P1, P2, …` series, so a recorded entry cannot collide. */
const nextId = (prefix: string, ids: string[]) =>
  prefix + (ids.reduce((max, id) => Math.max(max, Number(id.replace(/\D/g, '')) || 0), 0) + 1)

export function recordEntry(e: Omit<PettyEntry, 'id'>): PettyEntry {
  const entry: PettyEntry = { ...e, id: nextId('P', store.get().entries.map((x) => x.id)) }
  store.update((box) => ({ ...box, entries: [...box.entries, entry] }))
  return entry
}

export function recordCount(c: Omit<PettyCount, 'id'>): void {
  store.update((box) => ({
    ...box,
    counts: [{ ...c, id: nextId('C', box.counts.map((x) => x.id)) }, ...box.counts],
  }))
}

/** Changes one setting. The caller has already decided the value is usable. */
export function setConfig<K extends keyof PettyConfig>(key: K, value: PettyConfig[K]): void {
  store.update((box) => ({ ...box, cfg: { ...box.cfg, [key]: value } }))
}

/** @see Store.reset in @/lib/store */
export const resetBox = store.reset
