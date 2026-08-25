import { useSyncExternalStore } from 'react'
import { UPDATES } from '@/data/production'
import { now } from '@/lib/clock'
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

let updates: Update[] = UPDATES

const listeners = new Set<() => void>()
const emit = () => {
  for (const l of listeners) l()
}
const subscribe = (fn: () => void) => {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
const snapshot = () => updates

export const useUpdates = (): Update[] => useSyncExternalStore(subscribe, snapshot, snapshot)

/** Newest first, so the seed array is never written to. */
export function postUpdate(who: string, kind: Update['kind'], body: string): Update {
  const entry: Update = { id: `U${9000 + updates.length}`, who, d: now(), kind, b: body }
  updates = [entry, ...updates]
  emit()
  return entry
}

/** Puts the seed back. For tests, which must not inherit each other's notes. */
export function resetUpdates(): void {
  updates = UPDATES
  emit()
}
