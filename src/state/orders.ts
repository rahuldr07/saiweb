import { ORDERS } from '@/data/production'
import { PRODUCTS } from '@/data/catalog'
import { slaHours } from '@/lib/sla'
import { now } from '@/lib/clock'
import { createStore, useStore } from '@/lib/store'
import type { Assignments, Order, OrderStatus } from '@/data/types'

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
  defect?: boolean
}

export interface OrderDoc {
  id: string
  kind: string
  recorded: string
  bookPage: string
  instrument: string
  image: boolean
  extraction: 'verified' | 'review' | 'none'
}

export interface OrderEdits {
  pr?: string
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
  docs?: OrderDoc[]
  assign?: Assignments
  costs: OrderCost[]
  notes: OrderNote[]
  rated: boolean
}

const EMPTY: Working = { edits: {}, costs: [], notes: [], rated: false }

const store = createStore<Record<string, Working>>({})

export const useOrderState = (): Record<string, Working> => useStore(store)

export const workingOn = (id: string): Working => store.get()[id] ?? EMPTY

const change = (id: string, fn: (w: Working) => Working) =>
  store.update((state) => ({ ...state, [id]: fn(state[id] ?? EMPTY) }))

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

export const resetOrders = store.reset
