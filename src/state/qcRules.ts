import { QC_RULES } from '@/lib/quality'
import { createStore, useStore } from '@/lib/store'
import type { QcRule } from '@/lib/quality'

const store = createStore<QcRule[]>(QC_RULES)

export const useQcRules = (): QcRule[] => useStore(store)

export const ruleOn = (key: string): boolean => store.get().find((r) => r.k === key)?.on ?? false

export function setQcRule(key: string, on: boolean): void {
  store.update((rules) => rules.map((r) => (r.k === key ? { ...r, on } : r)))
}

export const resetQcRules = store.reset
