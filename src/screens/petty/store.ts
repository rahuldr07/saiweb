import { useSyncExternalStore } from 'react'
import { COUNTS, PETTY, PETTYCFG } from '@/data/hrms'
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

let box: Box = { entries: PETTY, counts: COUNTS, cfg: PETTYCFG }

const listeners = new Set<() => void>()
const emit = () => {
  for (const l of listeners) l()
}
const subscribe = (fn: () => void) => {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
const snapshot = () => box

export const useBox = (): Box => useSyncExternalStore(subscribe, snapshot, snapshot)

/** Next free id in a `P1, P2, …` series, so a recorded entry cannot collide. */
const nextId = (prefix: string, ids: string[]) =>
  prefix + (ids.reduce((max, id) => Math.max(max, Number(id.replace(/\D/g, '')) || 0), 0) + 1)

export function recordEntry(e: Omit<PettyEntry, 'id'>): PettyEntry {
  const entry: PettyEntry = { ...e, id: nextId('P', box.entries.map((x) => x.id)) }
  box = { ...box, entries: [...box.entries, entry] }
  emit()
  return entry
}

export function recordCount(c: Omit<PettyCount, 'id'>): void {
  box = {
    ...box,
    counts: [{ ...c, id: nextId('C', box.counts.map((x) => x.id)) }, ...box.counts],
  }
  emit()
}

/** Changes one setting. The caller has already decided the value is usable. */
export function setConfig<K extends keyof PettyConfig>(key: K, value: PettyConfig[K]): void {
  box = { ...box, cfg: { ...box.cfg, [key]: value } }
  emit()
}

/** Puts the seed back. For tests, which must not inherit each other's entries. */
export function resetBox(): void {
  box = { entries: PETTY, counts: COUNTS, cfg: PETTYCFG }
  emit()
}
