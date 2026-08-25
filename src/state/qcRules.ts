import { useSyncExternalStore } from 'react'
import { QC_RULES } from '@/lib/quality'
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

let rules: QcRule[] = QC_RULES

const listeners = new Set<() => void>()
const emit = () => {
  for (const l of listeners) l()
}
const subscribe = (fn: () => void) => {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
const snapshot = () => rules

export const useQcRules = (): QcRule[] => useSyncExternalStore(subscribe, snapshot, snapshot)

/** For the plain reads that are not inside a component. */
export const ruleOn = (key: string): boolean => rules.find((r) => r.k === key)?.on ?? false

export function setQcRule(key: string, on: boolean): void {
  rules = rules.map((r) => (r.k === key ? { ...r, on } : r))
  emit()
}

/** Puts the seed back. For tests, which must not inherit each other's settings. */
export function resetQcRules(): void {
  rules = QC_RULES
  emit()
}
