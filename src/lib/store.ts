/**
 * A store that lives outside React.
 *
 * Nine modules held one of these — the county record, company settings, the QC
 * rules, the hiring board, order edits, my-work updates, the petty cash box,
 * client prefixes and the report builder. Each had written out the same
 * listener set, the same `emit`, the same `subscribe` and the same snapshot
 * getter, so the same ten lines existed nine times and a fix to one of them
 * would have reached only the copy it was made in.
 *
 * The shape they all share is here instead. What varies between them — what is
 * held, and what may be written to it — stays in the module that owns it, which
 * is the half worth reading.
 */
import { useSyncExternalStore } from 'react'

export interface Store<T> {
  /** The current value, for the plain functions that cannot use a hook. */
  get(): T
  /** Replaces it and tells every subscriber. */
  set(next: T): void
  /** The same, expressed against what is already there. */
  update(fn: (prev: T) => T): void
  /** Puts the initial value back. For tests, which must not inherit each other. */
  reset(): void
  subscribe(fn: () => void): () => void
}

export function createStore<T>(initial: T): Store<T> {
  let state = initial
  const listeners = new Set<() => void>()

  const set = (next: T) => {
    state = next
    for (const l of listeners) l()
  }

  return {
    get: () => state,
    set,
    update: (fn) => set(fn(state)),
    reset: () => set(initial),
    subscribe: (fn) => {
      listeners.add(fn)
      return () => {
        listeners.delete(fn)
      }
    },
  }
}

/** The whole value, re-rendering whenever it is replaced. */
export function useStore<T>(store: Store<T>): T {
  return useSyncExternalStore(store.subscribe, store.get, store.get)
}

/**
 * One part of it.
 *
 * The selector must return something already held rather than build a new
 * object each call — `(s) => s.depts` is what this is for, and `(s) => ({ ...s })`
 * would re-render forever, because React compares the result by identity.
 */
export function useStoreSlice<T, S>(store: Store<T>, select: (state: T) => S): S {
  const read = () => select(store.get())
  return useSyncExternalStore(store.subscribe, read, read)
}
