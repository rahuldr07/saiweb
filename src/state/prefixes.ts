import { CLIENTS } from '@/data/catalog'
import { createStore, useStore } from '@/lib/store'
import type { Client } from '@/data/types'

const defaultsFor = (c: Client) => [`${c.dn}MI-`, `${c.dn}PA-`, `${c.dn}FL-`, `${c.dn}WV-`]

const seed = (): Record<string, string[]> =>
  Object.fromEntries(CLIENTS.map((c) => [c.n, defaultsFor(c)]))

const store = createStore<Record<string, string[]>>(seed())

export const usePrefixes = (): Record<string, string[]> => useStore(store)

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

export const resetPrefixes = store.reset
