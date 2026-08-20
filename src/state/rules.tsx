import { createContext, use, useCallback, useMemo, useState, type ReactNode } from 'react'
import { ENGINE, ENGINEOPTS, RULES } from '@/data/org'
import { board as sharedBoard, computeBoard, resetBoard, type AssignmentBoard } from '@/lib/engine'
import type { EngineConfig, Rule } from '@/data/types'
import type { RuleDraft } from '@/lib/rules'

/**
 * The rules the engine is running, and the run they produce.
 *
 * Rules are editable from the Assignment screen — turned off, retyped, added,
 * removed — and each of those has to change the board, not just the list.
 *
 * The edits go into the seed array itself rather than into a copy held here.
 * That looks like the wrong instinct in React, and for anything else it would be:
 * the reason is that `board()` is one memoised run and six screens read it. A
 * private copy would give Assignment a board where a rule is off while the
 * dashboard, the reports and My performance still counted it — two answers to
 * one question, differing by which screen you happened to open. So the array is
 * the single source, `resetBoard()` drops the stale run, and `version` is what
 * tells React any of it happened.
 */

interface RulesValue {
  rules: Rule[]
  engine: EngineConfig
  /** The shared run, rebuilt whenever the rules move. */
  board: AssignmentBoard
  version: number
  toggle: (id: string) => void
  save: (draft: RuleDraft, id: string | null) => void
  remove: (id: string) => Rule | null
  setEngine: <K extends keyof EngineConfig>(k: K, v: EngineConfig[K]) => string
  /** Re-run the engine against the rules as they stand. */
  rerun: () => void
  /** What a draft would do. Runs on a copy, so no queue is touched. */
  dryRun: (draft?: RuleDraft) => { placed: number; unplaced: number }
}

const RulesContext = createContext<RulesValue | null>(null)

/** New rules go in before the tie-break, which has to stay last. */
const insertAt = (rules: Rule[]) => {
  const i = rules.findIndex((x) => x.k === 'prefer')
  return i < 0 ? rules.length : i
}

export function RulesProvider({ children }: { children: ReactNode }) {
  const [version, setVersion] = useState(0)
  const [engine, setEngineState] = useState<EngineConfig>(() => ({ ...ENGINE }))

  /* Every change goes through here, so there is one place that both drops the
     stale run and tells React. Forgetting either half is the whole bug class. */
  const changed = useCallback(() => {
    resetBoard()
    setVersion((v) => v + 1)
  }, [])

  /* `version` is the dependency even though neither expression names it: the
     rules array is edited in place and the run is memoised inside the engine, so
     the counter is the only thing that can tell React either has moved. */
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const rules = useMemo(() => [...RULES], [version])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const board = useMemo(() => sharedBoard(), [version])

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
        /* Locked: the name and the condition may move, what it does may not. */
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
      /* Only one of these has anything to re-run: telling the engine to apply a
         change to work already placed is a request to actually do it. */
      if (k === 'onChange' && v === 'all') changed()
      return ENGINEOPTS[k].find((o) => o[0] === v)?.[1] ?? String(v)
    },
    [changed],
  )

  /**
   * What the rules would do, optionally with one unsaved rule spliced in.
   *
   * `computeBoard` takes its rules as an argument and returns a fresh run, so
   * this never reaches the memoised one — which is the whole promise the button
   * makes about not touching anybody's queue.
   */
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
      board,
      version,
      toggle,
      save,
      remove,
      setEngine,
      rerun: changed,
      dryRun,
    }),
    [rules, engine, board, version, toggle, save, remove, setEngine, changed, dryRun],
  )

  return <RulesContext value={value}>{children}</RulesContext>
}

export function useRules(): RulesValue {
  const ctx = use(RulesContext)
  if (!ctx) throw new Error('useRules must be used inside <RulesProvider>')
  return ctx
}
