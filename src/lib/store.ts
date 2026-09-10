import { useSyncExternalStore } from 'react'

export interface Store<T> {
  get(): T
  set(next: T): void
  update(fn: (prev: T) => T): void
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

export function useStore<T>(store: Store<T>): T {
  return useSyncExternalStore(store.subscribe, store.get, store.get)
}

export function useStoreSlice<T, S>(store: Store<T>, select: (state: T) => S): S {
  const read = () => select(store.get())
  return useSyncExternalStore(store.subscribe, read, read)
}
