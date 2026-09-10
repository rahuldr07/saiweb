export const SEED_NOW = new Date(2026, 7, 3, 17, 30)

let source: () => Date = () => SEED_NOW

export const now = (): Date => source()

export const setClock = (fn: () => Date): void => {
  source = fn
}

export const resetClock = (): void => {
  source = () => SEED_NOW
}
