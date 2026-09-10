import { COUNTS, PETTY, PETTYCFG } from '@/data/hrms'
import { createStore, useStore } from '@/lib/store'
import type { PettyConfig, PettyCount, PettyEntry } from '@/data/types'

interface Box {
  entries: PettyEntry[]
  counts: PettyCount[]
  cfg: PettyConfig
}

const store = createStore<Box>({ entries: PETTY, counts: COUNTS, cfg: PETTYCFG })

export const useBox = (): Box => useStore(store)

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

export function setConfig<K extends keyof PettyConfig>(key: K, value: PettyConfig[K]): void {
  store.update((box) => ({ ...box, cfg: { ...box.cfg, [key]: value } }))
}

export const resetBox = store.reset
