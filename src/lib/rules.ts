/**
 * Reading a rule back in words.
 *
 * A rule is stored as a condition and a pool, which is what the engine needs and
 * not what a person needs. Everything here turns that back into the sentence the
 * Rules tab shows — "When stage is Typing and product is LIEN → Only Ashok S" —
 * so the screen never carries a hand-written description that can drift from the
 * condition actually being run.
 */
import { ASSIGN_STAGES } from '@/data/org'
import { whoName } from '@/lib/permissions'
import { COVSTAGES, coversPlace, coversProduct } from '@/lib/coverage'
import type { Exception } from '@/lib/engine'
import type { Rule, RuleCondition } from '@/data/types'

/** What each kind of rule does to the pool, and the chip that carries it. */
export const RULE_KIND: Record<Rule['k'], [label: string, chip: 'd' | 'b' | 'r' | 'n', note: string]> = {
  block: ['Blocks', 'd', 'removes people, and makes an exception if nobody is left'],
  route: ['Routes', 'b', 'narrows the pool for orders that match it'],
  cover: ['Covers', 'r', 'narrows to whoever is qualified for that place and product'],
  prefer: ['Prefers', 'n', 'only decides who gets picked first'],
}

/** The condition, as a phrase. `always` when nothing narrows it. */
export function ruleWhen(r: Pick<Rule, 'when' | 'cond'>): string {
  if (r.when) return r.when
  const c: RuleCondition = r.cond ?? {}
  const bits: string[] = []
  if (c.stage) bits.push(`stage is ${c.stage}`)
  if (c.product) bits.push(`product is ${c.product}`)
  if (c.state) bits.push(`state is ${c.state}`)
  return bits.length ? bits.join(' and ') : 'always'
}

/** What it then does. A routing rule with an empty pool says so — it is a trap. */
export function ruleThen(r: Pick<Rule, 'then' | 'k' | 'pool'>): string {
  if (r.then) return r.then
  if (r.k === 'route') {
    return r.pool?.length
      ? `Only ${r.pool.map(whoName).join(' · ')}`
      : 'Nobody — every matching order becomes an exception'
  }
  if (r.k === 'block') return 'Remove everyone this matches from consideration'
  return 'Prefer whoever this matches'
}

/**
 * What the rule actually did today.
 *
 * "Fired 2,160 times" was the same number for every always-rule and told you
 * nothing; what matters is how often it *changed the answer*. Two rules narrow
 * nothing by nature and need their own sentence: department membership builds
 * the pool, and the tie-break picks out of it.
 */
export function ruleEffect(r: Rule, fired: number, narrowed: number | undefined): string {
  const n = fired.toLocaleString()
  if (r.id === 'r1') {
    const avg = fired ? ((narrowed ?? 0) / fired).toFixed(1) : '0'
    return `built the pool ${n} times · ${avg} candidates on average`
  }
  if (r.k === 'prefer') return `broke the tie ${n} ${fired === 1 ? 'time' : 'times'}`
  if (narrowed === undefined) return `${n} checks`
  if (narrowed === 0) return fired ? `checked ${n} times · changed nothing` : 'never came up'
  return `changed the answer ${narrowed.toLocaleString()} ${narrowed === 1 ? 'time' : 'times'} of ${n}`
}

/** Rules that exist to stop the system doing something it must never do. */
export const UNREMOVABLE = ['r2', 'r3', 'r5', 'r6', 'r7']

export const canRemove = (r: Rule) => !r.lock && !UNREMOVABLE.includes(r.id)

/**
 * Whether this person is qualified for the order behind an exception.
 *
 * Only asked on the stages coverage governs — on Typing or RTS everybody in the
 * department is equally eligible, so annotating the picker there would be noise.
 */
export const covOK = (id: string, e: Exception): boolean =>
  !COVSTAGES.includes(e.stage) ||
  (coversPlace(id, e.o.st, e.o.co ?? null) && coversProduct(id, e.o.pr))

/** A draft from the rule editor, before it is given an id. */
export interface RuleDraft {
  n: string
  k: Rule['k']
  on: boolean
  cond: RuleCondition
  pool: string[]
}

/**
 * Why a draft cannot be saved, or null when it can.
 *
 * Each of these is a way to write a rule that looks reasonable and quietly sends
 * every matching order to the exception queue, so they are refused at the point
 * of writing rather than explained afterwards.
 */
export function ruleProblem(d: RuleDraft, rules: Rule[], id: string | null): string | null {
  if (!d.n.trim()) {
    return 'A name — it is what appears in the trace when this rule decides something.'
  }
  if (rules.some((x) => x.id !== id && x.n.toLowerCase() === d.n.trim().toLowerCase())) {
    return `${d.n.trim()} already exists. Two rules with one name makes a trace unreadable.`
  }
  if (d.k !== 'block' && !d.pool.length) {
    return 'Nobody is ticked, so every order this matches would become an exception. Tick at least one person, or make it a Blocks rule if that is what you mean.'
  }
  if (!Object.keys(d.cond).length && d.k !== 'prefer') {
    return 'No condition set, so this would apply to every order at every stage. Choose at least a stage, product or state.'
  }
  return null
}

/** Every stage a rule may be conditioned on. */
export const RULE_STAGES = ASSIGN_STAGES
