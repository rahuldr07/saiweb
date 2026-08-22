import { useSyncExternalStore } from 'react'
import { CANDIDATES, HIRESTAGES, OPENINGS } from '@/data/hrms'
import type { Candidate, HireStage, Opening } from '@/data/types'

/**
 * The hiring board, held outside React.
 *
 * Moving a candidate on and raising an opening both have to survive leaving the
 * screen — a board that forgets where you put somebody the moment you look at
 * the roster is worse than one that cannot be moved at all. The design keeps
 * these in module globals for the same reason.
 *
 * What it does *not* do is write back into `CANDIDATES` and `OPENINGS`. Those
 * are the seed, imported by anything that wants them, and mutating an imported
 * array in place makes the edit invisible to every reader that already
 * memoised. So the seed is the starting value and every change produces a new
 * array, which is what lets `useSyncExternalStore` see it.
 *
 * When the API grows a write path for hiring, this is the one place that has to
 * change: the two mutators become mutations and the snapshot becomes a query.
 */

interface Board {
  candidates: Candidate[]
  openings: Opening[]
}

let board: Board = { candidates: CANDIDATES, openings: OPENINGS }

const listeners = new Set<() => void>()

const emit = () => {
  for (const l of listeners) l()
}

const subscribe = (fn: () => void) => {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

const snapshot = () => board

/** The board as it stands, re-rendering whoever reads it when it moves. */
export const useBoard = (): Board => useSyncExternalStore(subscribe, snapshot, snapshot)

/** The stage after this one, or null at the top of the ladder. */
export const nextStage = (stage: HireStage): HireStage | null =>
  HIRESTAGES[HIRESTAGES.indexOf(stage) + 1] ?? null

/** Moves one candidate one rung up. A no-op for anyone already at the end. */
export function moveCandidate(id: string): void {
  board = {
    ...board,
    candidates: board.candidates.map((c) => {
      if (c.id !== id) return c
      const next = nextStage(c.stage)
      return next ? { ...c, stage: next } : c
    }),
  }
  emit()
}

/** Adds an opening, newest first so a just-raised req is where the eye is. */
export function addOpening(opening: Opening): void {
  board = { ...board, openings: [opening, ...board.openings] }
  emit()
}

/** Puts the seed back. Exists for tests, which must not inherit each other's moves. */
export function resetBoard(): void {
  board = { candidates: CANDIDATES, openings: OPENINGS }
  emit()
}
