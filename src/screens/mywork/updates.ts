import { UPDATES } from '@/data/production'
import { now } from '@/lib/clock'
import { createStore, useStore } from '@/lib/store'
import type { Update } from '@/data/types'

/**
 * The shift log — handover notes, blockers, decisions.
 *
 * Held outside React because two panels on My work read it (yours and your
 * department's) and the Attendance handover reads it too; a copy per panel is
 * how two of them come to disagree about what was written.
 *
 * Nothing here can be edited or removed once posted, which is the whole reason
 * anyone reads one back. So there is no `editUpdate` to leave out — the absence
 * is the rule.
 */

const store = createStore<Update[]>(UPDATES)

export const useUpdates = (): Update[] => useStore(store)

/** Newest first, so the seed array is never written to. */
export function postUpdate(who: string, kind: Update['kind'], body: string): Update {
  const entry: Update = { id: `U${9000 + store.get().length}`, who, d: now(), kind, b: body }
  store.update((prev) => [entry, ...prev])
  return entry
}

/** @see Store.reset in @/lib/store */
export const resetUpdates = store.reset
