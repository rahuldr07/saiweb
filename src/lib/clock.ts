/**
 * What "now" means.
 *
 * The design pins its clock: every countdown, overdue flag, SLA checkpoint and
 * payroll period in the seed data is measured against one instant, which is what
 * makes the figures on screen reproducible. That was the right call, and it is
 * still the default here.
 *
 * What was wrong was that the instant was a literal in `format.ts`, read
 * directly by forty-odd call sites across five modules. Pinned-by-default is a
 * decision; pinned-with-no-way-out is a live wire the day real orders arrive.
 * So the instant is now behind a function that can be swapped — once for the
 * whole application, at the point the screens start reading the API instead of
 * the seed data, and per test wherever a fixed date is needed.
 */

/** Mon 3 Aug 2026, 5:30 PM ET — the end of the working day the design shows. */
export const SEED_NOW = new Date(2026, 7, 3, 17, 30)

let source: () => Date = () => SEED_NOW

/** The current instant. Pinned to the seed clock until something says otherwise. */
export const now = (): Date => source()

/**
 * Point the clock at something else.
 *
 * Call it once, early — `setClock(() => new Date())` when the application is
 * running against real data, or a fixed date in a test. Anything already
 * computed from the old clock is not recomputed, which is why this belongs at
 * startup rather than in a render.
 */
export const setClock = (fn: () => Date): void => {
  source = fn
}

/** Puts the seed clock back. Used between tests. */
export const resetClock = (): void => {
  source = () => SEED_NOW
}
