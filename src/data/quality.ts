export interface QcEntry {
  d: Date
  dk: string
  order: string
  cl: string
  pr: string
  stage: string
  on: string
  onName: string
  by: string
  byName: string
  acc: number
  comp: number
  fmt: number
  avg: number
  defect: boolean
  crit: string | null
  note: string | null
}

type RawQcEntry = Omit<QcEntry, 'd'> & { d: string }

export const QC_DAYS = 90

export const QC_FIX: Record<string, string> = {
  'Book/Page transposed from the index':
    'Read the reference off the recorded instrument itself, not the index entry. The index is a finding aid, keyed by hand, and transposition is the most common error in it.',
  'Grantee spelled from the deed, not the recorded index':
    'Where the deed and the index disagree on a name, the index governs what a searcher will find. Record the index spelling and note the variance.',
  'Consideration taken from the wrong instrument':
    'Check the instrument number on the page you are reading before copying a figure. Consecutive recordings on one page is where this happens.',
  'Mortgage amount out by a digit':
    'Read the amount twice — once from the figures, once from the words. Any instrument that states both gives you a free check.',
  'Instrument # belongs to the assignment, not the mortgage':
    'When a mortgage has been assigned, the original recording is the one that goes in the chain. Follow the assignment back before recording the number.',
  'Effective date read as the execution date':
    'Execution is when it was signed, effective is when it was recorded. Only the recording date affects priority.',
  'Open 2019 mortgage not reported':
    'Work the chain forward from the prior effective date and account for every mortgage you meet — an open one is only closed by a release you can point to.',
  'Judgment search missing for the co-borrower':
    'Run every name on the vesting deed separately, including middle initials and any former name shown.',
  'Prior effective date not carried forward on an update':
    'An update starts where the last search ended. Take the prior effective date from the previous report, never from the order.',
  'Current tax year not shown':
    'Report the most recent assessed year even when nothing is owed. Silence reads as "not checked".',
  'Legal description truncated at the metes call':
    'Copy the description to its close, including the point of beginning. A description that does not close cannot be relied on.',
  'Assignment chain stops before the current holder':
    'Follow assignments to the last one recorded. The chain ends at the current holder or it has not been searched.',
  'Dates entered DD/MM in a US report':
    'This company records dates MM/DD/YYYY everywhere. Set it once under Company and read it back on anything ambiguous below the 13th.',
  'Money written without cents':
    'Two decimal places always, even on a round figure. It is how a reader knows the cents were checked rather than dropped.',
  'Names in caps where this client wants Title Case':
    'Check the client format before typing. It is on the client record, and it is the cheapest defect on this list to avoid.',
  'Book/Page given where the client uses Instrument #':
    'Some counties give both; the client decides which is authoritative. Their preference is on their record.',
  'County name omitted from the property address':
    'A street address without a county is ambiguous in most states. Include it every time.',
  'Not Available written as N/A':
    'Write "Not Available" in full. N/A is read as "not applicable", which is a different claim.',
}

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

let pending: Promise<QcEntry[]> | null = null

export function loadQcLog(): Promise<QcEntry[]> {
  pending ??= import('./quality-log.json').then((m) =>
    (m.default as RawQcEntry[]).map((r) => ({ ...r, d: new Date(r.d) })),
  )
  return pending
}

export function resetQcLog(): void {
  pending = null
}
