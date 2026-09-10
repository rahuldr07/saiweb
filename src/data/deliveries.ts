export interface Delivery {
  id: string
  d: Date
  dk: string
  cl: string
  pr: string
  slaH: number
  st: Record<string, number>
  by: Record<string, string>
  byName: Record<string, string>
  hrs: number
  late: boolean
}

type RawDelivery = Omit<Delivery, 'd'> & { d: string }

let pending: Promise<Delivery[]> | null = null

const IST_OFFSET_MS = 5.5 * 3600_000

const reviveDate = (iso: string): Date => {
  const ist = new Date(new Date(iso).getTime() + IST_OFFSET_MS)
  return new Date(
    ist.getUTCFullYear(),
    ist.getUTCMonth(),
    ist.getUTCDate(),
    ist.getUTCHours(),
    ist.getUTCMinutes(),
  )
}

export function loadDeliveries(): Promise<Delivery[]> {
  pending ??= import('./deliveries.json').then((m) =>
    (m.default as RawDelivery[]).map((r) => ({ ...r, d: reviveDate(r.d) })),
  )
  return pending
}

export function resetDeliveries(): void {
  pending = null
}
