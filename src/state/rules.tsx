import { createContext, use, useCallback, useMemo, useState, type ReactNode } from 'react'
import { ENGINE, ENGINEOPTS, RULES } from '@/data/org'
import { board as sharedBoard, computeBoard, resetBoard, type AssignmentBoard } from '@/lib/engine'
import type { EngineConfig, Rule } from '@/data/types'
import type { RuleDraft } from '@/lib/ruleText'

interface RulesValue {
  rules: Rule[]
  engine: EngineConfig
  board: AssignmentBoard
  version: number
  toggle: (id: string) => void
  save: (draft: RuleDraft, id: string | null) => void
  remove: (id: string) => Rule | null
  setEngine: <K extends keyof EngineConfig>(k: K, v: EngineConfig[K]) => string
  rerun: () => void
  dryRun: (draft?: RuleDraft) => { placed: number; unplaced: number }
}

const RulesContext = createContext<RulesValue | null>(null)

const insertAt = (rules: Rule[]) => {
  const i = rules.findIndex((x) => x.k === 'prefer')
  return i < 0 ? rules.length : i
}

export function RulesProvider({ children }: { children: ReactNode }) {
  const [version, setVersion] = useState(0)
  const [engine, setEngineState] = useState<EngineConfig>(() => ({ ...ENGINE }))

  const changed = useCallback(() => {
    resetBoard()
    setVersion((v) => v + 1)
  }, [])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const rules = useMemo(() => [...RULES], [version])

  const toggle = useCallback(
    (id: string) => {
      const r = RULES.find((x) => x.id === id)
      if (!r || r.lock) return
      r.on = !r.on
      changed()
    },
    [changed],
  )

  const save = useCallback(
    (draft: RuleDraft, id: string | null) => {
      const existing = id ? RULES.find((x) => x.id === id) : undefined
      if (existing) {
        if (existing.lock) {
          Object.assign(existing, { n: draft.n.trim(), cond: draft.cond, pool: draft.pool })
        } else {
          Object.assign(existing, {
            n: draft.n.trim(),
            k: draft.k,
            on: draft.on,
            cond: draft.cond,
            pool: draft.pool,
            when: undefined,
            then: undefined,
          })
        }
      } else {
        RULES.splice(insertAt(RULES), 0, {
          id: `ru${RULES.length}${draft.n.trim().toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8)}`,
          n: draft.n.trim(),
          k: draft.k,
          on: draft.on,
          cond: draft.cond,
          pool: draft.pool,
        })
      }
      changed()
    },
    [changed],
  )

  const remove = useCallback(
    (id: string) => {
      const i = RULES.findIndex((x) => x.id === id)
      if (i < 0 || RULES[i].lock) return null
      const [gone] = RULES.splice(i, 1)
      changed()
      return gone
    },
    [changed],
  )

  const setEngine = useCallback(
    <K extends keyof EngineConfig>(k: K, v: EngineConfig[K]) => {
      setEngineState((e) => ({ ...e, [k]: v }))
      if (k === 'onChange' && v === 'all') changed()
      return ENGINEOPTS[k].find((o) => o[0] === v)?.[1] ?? String(v)
    },
    [changed],
  )

  const dryRun = useCallback(
    (draft?: RuleDraft) => {
      let against = RULES
      if (draft?.n) {
        against = [...RULES]
        against.splice(insertAt(against), 0, {
          id: '__draft',
          n: draft.n,
          k: draft.k,
          on: true,
          cond: draft.cond,
          pool: draft.pool,
        })
      }
      const r = computeBoard({ rules: against }).run
      return {
        placed: r.assigns.filter((a) => a.today).length,
        unplaced: r.exc.filter((e) => e.today).length,
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [version],
  )

  const value = useMemo<RulesValue>(
    () => ({
      rules,
      engine,
      get board() {
        return sharedBoard()
      },
      version,
      toggle,
      save,
      remove,
      setEngine,
      rerun: changed,
      dryRun,
    }),
    [rules, engine, version, toggle, save, remove, setEngine, changed, dryRun],
  )

  return <RulesContext value={value}>{children}</RulesContext>
}

export function useRules(): RulesValue {
  const ctx = use(RulesContext)
  if (!ctx) throw new Error('useRules must be used inside <RulesProvider>')
  return ctx
}
