import { whoName } from '@/lib/permissions'
import { COVSTAGES, coversPlace, coversProduct } from '@/lib/qualification'
import { isDuplicateName } from '@/lib/forms'
import type { Exception } from '@/lib/engine'
import type { Rule, RuleCondition } from '@/data/types'

export const RULE_KIND: Record<Rule['k'], [label: string, chip: 'd' | 'b' | 'r' | 'n', note: string]> = {
  block: ['Blocks', 'd', 'removes people, and makes an exception if nobody is left'],
  route: ['Routes', 'b', 'narrows the pool for orders that match it'],
  cover: ['Covers', 'r', 'narrows to whoever is qualified for that place and product'],
  prefer: ['Prefers', 'n', 'only decides who gets picked first'],
}

export function ruleWhen(r: Pick<Rule, 'when' | 'cond'>): string {
  if (r.when) return r.when
  const c: RuleCondition = r.cond ?? {}
  const bits: string[] = []
  if (c.stage) bits.push(`stage is ${c.stage}`)
  if (c.product) bits.push(`product is ${c.product}`)
  if (c.state) bits.push(`state is ${c.state}`)
  return bits.length ? bits.join(' and ') : 'always'
}

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

type EffectParts = [before: string, emphasis: string, after: string]

export function ruleEffectParts(
  r: Rule,
  fired: number,
  narrowed: number | undefined,
): EffectParts {
  const n = fired.toLocaleString()
  if (r.id === 'r1') {
    const avg = fired ? ((narrowed ?? 0) / fired).toFixed(1) : '0'
    return [`built the pool ${n} times · `, avg, ' candidates on average']
  }
  if (r.k === 'prefer') return [`broke the tie ${n} ${fired === 1 ? 'time' : 'times'}`, '', '']
  if (narrowed === undefined) return [`${n} checks`, '', '']
  if (narrowed === 0)
    return fired ? [`checked ${n} times · `, 'changed nothing', ''] : ['never came up', '', '']
  return [
    'changed the answer ',
    narrowed.toLocaleString(),
    ` ${narrowed === 1 ? 'time' : 'times'} of ${n}`,
  ]
}

export function ruleEffect(r: Rule, fired: number, narrowed: number | undefined): string {
  return ruleEffectParts(r, fired, narrowed).join('')
}

export const UNREMOVABLE = ['r2', 'r3', 'r5', 'r6', 'r7']

export const canRemove = (r: Rule) => !r.lock && !UNREMOVABLE.includes(r.id)

export const covOK = (id: string, e: Exception): boolean =>
  !COVSTAGES.includes(e.stage) ||
  (coversPlace(id, e.o.st, e.o.co ?? null) && coversProduct(id, e.o.pr))

export interface RuleDraft {
  n: string
  k: Rule['k']
  on: boolean
  cond: RuleCondition
  pool: string[]
}

export function ruleProblem(d: RuleDraft, rules: Rule[], id: string | null): string | null {
  if (!d.n.trim()) {
    return 'A name — it is what appears in the trace when this rule decides something.'
  }
  if (isDuplicateName(rules, d.n, (x) => x.n, (x) => x.id === id)) {
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

