import { UPDATES } from '@/data/production'
import { now } from '@/lib/clock'
import { createStore, useStore } from '@/lib/store'
import type { Update } from '@/data/types'

const store = createStore<Update[]>(UPDATES)

export const useUpdates = (): Update[] => useStore(store)

export function postUpdate(who: string, kind: Update['kind'], body: string): Update {
  const entry: Update = { id: `U${9000 + store.get().length}`, who, d: now(), kind, b: body }
  store.update((prev) => [entry, ...prev])
  return entry
}

export const resetUpdates = store.reset
