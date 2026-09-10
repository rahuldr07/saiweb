import { CANDIDATES, HIRESTAGES, OPENINGS } from '@/data/hrms'
import { createStore, useStore } from '@/lib/store'
import type { Candidate, HireStage, Opening } from '@/data/types'

interface Board {
  candidates: Candidate[]
  openings: Opening[]
}

const store = createStore<Board>({ candidates: CANDIDATES, openings: OPENINGS })

export const useBoard = (): Board => useStore(store)

export const nextStage = (stage: HireStage): HireStage | null =>
  HIRESTAGES[HIRESTAGES.indexOf(stage) + 1] ?? null

export function moveCandidate(id: string): void {
  store.update((board) => ({
    ...board,
    candidates: board.candidates.map((c) => {
      if (c.id !== id) return c
      const next = nextStage(c.stage)
      return next ? { ...c, stage: next } : c
    }),
  }))
}

export function addOpening(opening: Opening): void {
  store.update((board) => ({ ...board, openings: [opening, ...board.openings] }))
}

export const resetHiringBoard = store.reset
