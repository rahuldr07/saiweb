/**
 * The QC log: 90 days of ratings, one row per stage that was reviewed.
 *
 * Kept apart from the deliveries and loaded the same lazy way, because only the
 * Reports screen reads it and it is 262 KB. `by` is the person who rated, `on`
 * is the person who did the work — a distinction the whole quality report turns
 * on, since a score means nothing without knowing it came from somebody else.
 *
 * About a third of delivered work is never rated, which is deliberate rather
 * than missing: the report has to be honest that its sample is partial.
 */

export interface QcEntry {
  d: Date
  dk: string
  /** The order the rated stage belonged to. */
  order: string
  cl: string
  pr: string
  /** The stage that was reviewed — never the QC stage itself. */
  stage: string
  /** Who did the work. */
  on: string
  onName: string
  /** Who rated it. Never the same person: QC independence is structural. */
  by: string
  byName: string
  acc: number
  comp: number
  fmt: number
  avg: number
  /** Any axis at 3 or below. */
  defect: boolean
  /** The weakest axis, named — a score below 5 with no reason teaches nobody. */
  crit: string | null
  note: string | null
}

type RawQcEntry = Omit<QcEntry, 'd'> & { d: string }

/** How far back the log goes. The range presets are bounded by it. */
export const QC_DAYS = 90

/** What a mark below 5 was actually for, by axis. */
export const QC_REASONS: Record<string, string[]> = {
  Accuracy: [
    'Book/Page transposed from the index',
    'Grantee spelled from the deed, not the recorded index',
    'Consideration taken from the wrong instrument',
    'Mortgage amount out by a digit',
    'Instrument # belongs to the assignment, not the mortgage',
    'Effective date read as the execution date',
  ],
  Completeness: [
    'Open 2019 mortgage not reported',
    'Judgment search missing for the co-borrower',
    'Prior effective date not carried forward on an update',
    'Current tax year not shown',
    'Legal description truncated at the metes call',
    'Assignment chain stops before the current holder',
  ],
  Formatting: [
    'Dates entered DD/MM in a US report',
    'Money written without cents',
    'Names in caps where this client wants Title Case',
    'Book/Page given where the client uses Instrument #',
    'County name omitted from the property address',
    'Not Available written as N/A',
  ],
}

/** The three axes every rating carries, in the order the design shows them. */
export const QC_AXES = ['Accuracy', 'Completeness', 'Formatting'] as const

let pending: Promise<QcEntry[]> | null = null

export function loadQcLog(): Promise<QcEntry[]> {
  pending ??= import('./quality-log.json').then((m) =>
    (m.default as RawQcEntry[]).map((r) => ({ ...r, d: new Date(r.d) })),
  )
  return pending
}

/** Drops the memo, so a test can load a different log. */
export function resetQcLog(): void {
  pending = null
}
