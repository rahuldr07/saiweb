import { ORDERS } from '@/data/production'
import { PRODUCTS } from '@/data/catalog'
import { slaHours } from '@/lib/sla'
import { now } from '@/lib/clock'
import { createStore, useStore } from '@/lib/store'
import type { Assignments, Order, OrderStatus } from '@/data/types'

/**
 * What an order picks up while somebody is working it.
 *
 * Edits, stage owners, pass-through costs, notes and QC ratings all belong to
 * one order, and all of them have to survive moving between its tabs — a note
 * that vanishes when you look at Costs is not a note. So they are held together
 * here rather than in the screen, keyed by order id.
 *
 * The seed array is read but never written to. Every screen that lists orders
 * reads `ORDERS`, and mutating it from a detail view is how a register and the
 * record it opens come to disagree.
 */

export interface OrderCost {
  id: string
  what: string
  amt: number
  by: string
  at: Date
}

export interface OrderNote {
  id: string
  at: Date
  by: string
  text: string
  /** Defects are notes too, and are marked so the log can colour them. */
  defect?: boolean
}

export interface OrderDoc {
  id: string
  kind: string
  recorded: string
  bookPage: string
  instrument: string
  /** Whether the original scan is on file. */
  image: boolean
  extraction: 'verified' | 'review' | 'none'
}

/** The fields the detail screen lets somebody change. */
export interface OrderEdits {
  pr?: string
  /* Narrower than `string` on purpose: the cast this type used to sit behind
     would have let any word through as a pipeline status, and every count that
     groups by stage reads it. */
  stt?: OrderStatus
  bw?: string
  ef?: string
  oe?: string
  pi?: string
  la?: string
  ad?: string
  nr?: string
}

interface Working {
  edits: OrderEdits
  /** Undefined until somebody touches the package, so the seed rows stand. */
  docs?: OrderDoc[]
  /** Undefined until somebody moves an owner, so the seed stays the default. */
  assign?: Assignments
  costs: OrderCost[]
  notes: OrderNote[]
  /** Every worked stage has been scored. Delivery is gated on it. */
  rated: boolean
}

const EMPTY: Working = { edits: {}, costs: [], notes: [], rated: false }

const store = createStore<Record<string, Working>>({})

export const useOrderState = (): Record<string, Working> => useStore(store)

export const workingOn = (id: string): Working => store.get()[id] ?? EMPTY

const change = (id: string, fn: (w: Working) => Working) =>
  store.update((state) => ({ ...state, [id]: fn(state[id] ?? EMPTY) }))

/**
 * What the package holds when nobody has touched it.
 *
 * The design carries these three instruments on every order, and they are what
 * makes the extraction column mean anything — "Verified" against a real
 * Book/Page reads differently from an empty table.
 */
export const SEED_DOCS: OrderDoc[] = [
  { id: 'd1', kind: 'Mortgage', recorded: '12/17/2025', bookPage: '736/935', instrument: '2025-002688', image: true, extraction: 'verified' },
  { id: 'd2', kind: 'Administrator’s Deed', recorded: '12/17/2025', bookPage: '736/932', instrument: '2025-002687', image: true, extraction: 'verified' },
  { id: 'd3', kind: 'Scrivener’s Affidavit', recorded: '01/14/2026', bookPage: '738/76', instrument: '2026-000096', image: true, extraction: 'review' },
]

export const docsOf = (id: string): OrderDoc[] => store.get()[id]?.docs ?? SEED_DOCS

export function addDoc(id: string): void {
  change(id, (w) => {
    const docs = w.docs ?? SEED_DOCS
    return {
      ...w,
      docs: [
        ...docs,
        { id: `d${docs.length + 1}`, kind: '', recorded: '', bookPage: '', instrument: '', image: false, extraction: 'none' },
      ],
    }
  })
}

export function setDoc<K extends keyof OrderDoc>(id: string, docId: string, key: K, value: OrderDoc[K]): void {
  change(id, (w) => ({
    ...w,
    docs: (w.docs ?? SEED_DOCS).map((d) => (d.id === docId ? { ...d, [key]: value } : d)),
  }))
}

/**
 * The order as it now stands: the seed record with this session's edits over it.
 *
 * Product is the one field that moves more than itself. It carries the fee, and
 * it re-reads the SLA — so the due date and every stage checkpoint move with it.
 * Deriving that here rather than at the call site is what stops the header
 * showing one deadline and the checkpoints another.
 */
/** The register's record plus whatever this session has typed over it. */
export type EditedOrder = Order & OrderEdits

export function orderAsEdited(base: Order, w: Working = workingOn(base.id)): EditedOrder {
  const merged: EditedOrder = { ...base, ...w.edits, a: w.assign ?? base.a }
  if (w.edits.pr && w.edits.pr !== base.pr) {
    merged.fee = PRODUCTS.find((p) => p.id === w.edits.pr)?.fee ?? base.fee
    merged.due = new Date(base.recv.getTime() + slaHours(merged) * 36e5)
  }
  if (w.edits.stt) merged.done = w.edits.stt === 'sent'
  return merged
}

export const setOrderField = <K extends keyof OrderEdits>(id: string, key: K, value: OrderEdits[K]) =>
  change(id, (w) => ({ ...w, edits: { ...w.edits, [key]: value } }))

export function setAssignee(id: string, stage: string, personId: string | null): void {
  const base = ORDERS.find((o) => o.id === id)
  change(id, (w) => ({
    ...w,
    assign: { ...(w.assign ?? base?.a ?? {}), [stage]: personId },
  }))
}

export function setAssignments(id: string, next: Assignments): void {
  change(id, (w) => ({ ...w, assign: next }))
}

export function addCost(id: string, what: string, amt: number, by: string): void {
  change(id, (w) => ({
    ...w,
    costs: [...w.costs, { id: `C${w.costs.length + 1}`, what, amt, by, at: now() }],
  }))
}

export function addNote(id: string, text: string, by: string, defect = false): void {
  change(id, (w) => ({
    ...w,
    notes: [{ id: `N${w.notes.length + 1}`, at: now(), by, text, defect }, ...w.notes],
  }))
}

export const markRated = (id: string) => change(id, (w) => ({ ...w, rated: true }))

/** @see Store.reset in @/lib/store */
export const resetOrders = store.reset
