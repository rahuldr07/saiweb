import { QC_RULES } from '@/lib/quality'
import { createStore, useStore } from '@/lib/store'
import type { QcRule } from '@/lib/quality'

/**
 * How work is checked, and what a score is allowed to mean.
 *
 * These are company settings rather than one screen's checkboxes, and one of
 * them — "Scores are visible to the person rated" — decides whether two other
 * screens will show a person their own ratings at all. Held in the Quality
 * report's local state it could not do that: the box moved, the panel redrew,
 * and My work and How I'm doing carried on showing scores the company had just
 * said to withhold.
 *
 * The seed array is the starting value and is never written to; every change
 * produces a new one, which is what `useSyncExternalStore` needs to see.
 */

const store = createStore<QcRule[]>(QC_RULES)

export const useQcRules = (): QcRule[] => useStore(store)

/** For the plain reads that are not inside a component. */
export const ruleOn = (key: string): boolean => store.get().find((r) => r.k === key)?.on ?? false

export function setQcRule(key: string, on: boolean): void {
  store.update((rules) => rules.map((r) => (r.k === key ? { ...r, on } : r)))
}

/** @see Store.reset in @/lib/store */
export const resetQcRules = store.reset
