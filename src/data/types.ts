/**
 * Domain types for Title CRM.
 *
 * Field names are kept short, exactly as the design defines them, so the seed
 * data and the screens read the same way the design does. Where a name is not
 * obvious the comment gives the long form.
 */

/* ── organisation ────────────────────────────────────────────────────────── */

export interface Tenant {
  id: string
  name: string
  plan: string
  /** Home state of the title company. */
  state: string
}

export interface Dept {
  id: string
  n: string
  desc: string
  /** Part of the automatic assignment pass (vs. an exception branch reached on demand). */
  auto: boolean
  /** If set, this department QCs that stage — which is what the self-review rule keys off. */
  pair: string | null
  qc: boolean
}

export interface Perm {
  k: string
  n: string
  sys: boolean
  /** Permissions nobody may hold by default. */
  never?: boolean
}

export interface Role {
  id: string
  n: string
  desc: string
  /** Built-in roles that cannot be deleted. */
  lock?: boolean
  p: string[]
}

/** status key → [label, colour] */
export type StatusMap = Record<string, [string, string]>
/** chip variant: n neutral · b brand · v good · r warning · d bad */
export type ChipKind = 'n' | 'b' | 'v' | 'r' | 'd'
/** key → [label, chip variant] */
export type LabelMap = Record<string, [string, ChipKind]>

/* ── people ─────────────────────────────────────────────────────────────── */

export type Availability = 'ok' | 'leave' | 'shift'

export interface Bank {
  acct: string
  ifsc: string
  name: string
}

export interface Emergency {
  n: string
  rel: string
  mob: string
}

export interface Person {
  id: string
  n: string
  /** Departments the person works in. */
  dep: string[]
  /** Role id. */
  r: string
  /** Orders they can hold in a day. */
  cap: number
  /** What they already carry. */
  open: number
  avail: Availability
  active: boolean
  /** Annual cost to company, in INR. Absent for people who are not on payroll. */
  ctc?: number
  shift: string
  mob: string
  addr: string
  emg: Emergency
  aadhaar: string
  /** Date of joining, MM/DD/YYYY. */
  doj: string
  /** Date of birth, MM/DD/YYYY. */
  dob: string
  pan: string
  uan: string
  esicNo: string
  bank: Bank
  e: string
  /** Coverage level id. */
  lvl?: string
  /** Works both a stage and its QC, so self-review has to be watched. */
  conflict?: boolean
  /** Last working day, when notice has been given. */
  leaving?: Date
}

export interface Shift {
  k: string
  n: string
  from: string
  to: string
  c: ChipKind
  d: string
}

export interface Holiday {
  /** MM/DD/YYYY */
  d: string
  n: string
  /** Optional (restricted) holiday. */
  opt: boolean
}

/* ── catalog and coverage ───────────────────────────────────────────────── */

export interface Product {
  id: string
  n: string
  /** Fee in USD. */
  fee: number
  /** SLA in hours. */
  h: number
}

export type LinkStatus = 'ok' | 'slow' | 'moved' | 'auth' | 'broken' | 'none' | 'unchecked'

export interface CountyLink {
  /** URL, empty when there is no link on file. */
  u: string
  s: LinkStatus
  /** What the last check reported, when it failed. */
  err?: string
  /** When it was first seen in this state. */
  since?: Date
}

export interface County {
  n: string
  st: string
  /** County index used on recorder sites; null where the county does not publish one. */
  idx: number | null
  links: Record<string, CountyLink>
}

/**
 * One thing this workspace can be connected to. All optional — an integration
 * that is off means that step is done by hand, not that anything is broken.
 */
export interface Connector {
  k: string
  /** Typographic glyph, as everywhere else in the shell. */
  icon: string
  n: string
  d: string
  /** The label on the button — Connect, Configure, or Set up. */
  cta: string
  connected?: boolean
  /** What connecting it would actually require, said out loud rather than faked. */
  needs: string
}

export interface LinkType {
  k: string
  n: string
  req: boolean
  note: string
}

/**
 * What can be given to somebody: which states, which counties inside them, and
 * which products. A level is one of these with a name on it, and it is also the
 * shape each person's coverage had before levels existed.
 */
export interface Coverage {
  /** 'all' or an explicit list of state codes. */
  states: 'all' | string[]
  /** state code → counties within it that are covered. Absent or empty means the whole state. */
  counties?: Record<string, string[]>
  /** 'all' or an explicit list of product ids. */
  products: 'all' | string[]
}

export interface Level extends Coverage {
  id: string
  n: string
  note: string
}

export interface Client {
  n: string
  dn: string
  orders: number
  inv: number
  total: number
  paid: number
  e: string
  p: string
  terms: string
  active: boolean
}

/* ── production ─────────────────────────────────────────────────────────── */

export type OrderStatus =
  | 'search'
  | 'wip'
  | 'sq'
  | 'typing'
  | 'tqc'
  | 'rts'
  | 'upload'
  | 'sent'
  | 'hold'
  | 'docreq'
  | 'fee'
  | 'eff'
  | 'clar'
  | 'canc'

/** stage name → person id, or null when the stage is unassigned. */
export type Assignments = Record<string, string | null>

export interface Order {
  id: string
  /** Client code. */
  cl: string
  /** Product id. */
  pr: string
  stt: OrderStatus
  st: string
  co: string
  /** Property address. */
  prop: string
  a: Assignments
  due: Date
  recv: Date
  fee: number
  /** Human-readable age, e.g. "6h in Search". */
  age: string
  /** Delivered. Done orders drop out of every "open" count. */
  done?: boolean
  /** Why the clock is paused, when it is. */
  flag?: string

  /* Taken at intake. Optional because the seeded register predates the form. */
  /** The client's own file number for this matter. */
  ref?: string
  buyer?: string
  seller?: string
  /** Instructions to the searcher, carried through verbatim. */
  instr?: string
  parcel?: string
  /** Effective date, MM/DD/YYYY. Legally material, so it is stored as typed. */
  eff?: string
}

/**
 * Turnaround tiers. Priority halves the SLA, rush quarters it, and each carries
 * an uplift on the fee — so the promise and the price move together.
 */
export interface Tier {
  id: string
  n: string
  /** Multiplier on the SLA hours. */
  mult: number
  /** Fee uplift in USD. */
  up: number
}

/**
 * One message in the order mailbox.
 *
 * Nothing here is an order yet. The reader fills what it can from the message
 * and its attachments; a person confirms before any of it becomes work.
 */
export interface MailItem {
  /** Sender, as "Name · CLIENT". */
  f: string
  /** Subject line, as it arrived. */
  s: string
  t: Date
  /** Attachment labels, filename and size as the mail client reports them. */
  at: string[]
  /** What was read out of the message: [field, value]. */
  x: [string, string][]
  st: 'ready' | 'dupe' | 'attach'
  /** Why this looks like a duplicate, when it does. */
  dupe?: string
  /** The order this message matches, for the "attach" case. */
  match?: string
}

export interface Update {
  id: string
  who: string
  d: Date
  kind: 'Handover' | 'Blocked' | 'Done' | 'Decision' | 'Note'
  b: string
}

/* ── business ───────────────────────────────────────────────────────────── */

export interface Invoice {
  id: string
  cl: string
  code: string
  /** Month label, e.g. "Mar 2026". */
  m: string
  /** Month index into PAYMONTHS. */
  mi: number
  amt: number
  paid: number
  orders: number
  issued: Date
  st: 'open' | 'part' | 'overdue' | 'paid'
}

export interface LeadContact {
  n: string
  role: string
  e: string
  p: string
  main?: boolean
}

export interface LeadNote {
  who?: string
  w?: string
  at: Date
  t: string
}

export interface Lead {
  id: string
  co: string
  loc: string
  st: 'new' | 'contacted' | 'interested' | 'notnow' | 'lost' | 'won'
  own: string
  flag?: boolean
  contacts: LeadContact[]
  notes: LeadNote[]
}

/* ── time and attendance ────────────────────────────────────────────────── */

/**
 * One person's marks for one day.
 *
 * Made by a person rather than generated, which is the point: a punch is a claim
 * about where somebody was, so it records the place and how sure the device was.
 */
export interface DayMark {
  /** HH:MM. */
  in: string
  out: string | null
  /** Minutes after the shift start, past the grace period. Zero when on time. */
  late: number
  shift: string
  where: string
  outWhere?: string
  /** Inside a known site's radius. */
  inside: boolean
  /** Metres of GPS accuracy, when the device gave one. */
  acc: number | null
  breakIn?: string | null
  breakOut?: string | null
  breakMins?: number
}

/** A claim that the clock got a day wrong. Approving one moves a payslip. */
export interface Regularisation {
  id: string
  who: string
  d: Date
  /** What the system recorded. */
  was: string
  /** What they say happened. */
  ask: string
  st: 'pending' | 'approved' | 'rejected'
}

export interface Swap {
  id: string
  from: string
  to: string
  /** MM/DD/YYYY */
  d: string
  why: string
  st: 'pending' | 'approved' | 'rejected'
  by?: string
}

export interface LateMark {
  id: string
  who: string
  d: Date
  dk: string
  shift: string
  /** Shift start, HH:MM. */
  due: string
  /** When they actually punched. */
  at: string
  mins: number
  why: string | null
  /** Waived marks stay in the log and the export; they stop counting. */
  waived: boolean
}

export type PunchKind = 'in' | 'out' | 'break out' | 'break in'

export interface Punch {
  who: string
  d: string
  t: string
  kind: PunchKind
  where: string
  inside: boolean
  acc?: number | null
}

/* ── HRMS ───────────────────────────────────────────────────────────────── */

export interface LeaveType {
  k: string
  n: string
  annual: number
  carry: number
  enc: boolean
  c: ChipKind
  d: string
}

/** What the approver was told when a request left a department short. */
export interface LeaveClash {
  dep: string
  left: number
  team: number
  /** Who else is already off across those dates. */
  who: string[]
  /** How the applicant says the department will manage. */
  cover: string
}

export interface Leave {
  id: string
  who: string
  type: string
  from: Date
  to: Date
  days: number
  st: 'pending' | 'approved' | 'rejected' | 'cancelled'
  reason: string
  by: string | null
  at: Date | null

  /* Set when the request came through the form, so the approver reads the same
     judgement the applicant was shown rather than re-deriving it. */
  half?: boolean
  clash?: LeaveClash | null
  /** Days of notice given, when it was less than the policy expects. */
  shortNotice?: number | null
  /** Days beyond the balance, which become unpaid. */
  overBalance?: number | null
}

export interface LeavePolicy {
  noticeDays: number
  maxConsecutive: number
  clashRule: string
  minCover: number
  carryMonth: string
  halfDays: boolean
  approver: string
}

/** Per-person attendance roll-up for a month. */
export interface AttendanceRow {
  days: number
  working: number
  hol: number
  lop: number
  paidLeave: number
  payable: number
  joined: boolean
  present: number
}

/** month label → person id → attendance */
export type Attendance = Record<string, Record<string, AttendanceRow>>

export interface PayConfig {
  currency: string
  sym: string
  basicPct: number
  hraPctOfBasic: number
  pfPct: number
  pfWageCeiling: number
  pfOnFullBasic: boolean
  esiPct: number
  esiGrossLimit: number
  ptState: string
  ptAmount: number
  gratuityPct: number
  regime: 'new' | 'old'
  payDay: number
  bankName: string
  bankAcct: string
}

/** A month moves through these in order and cannot go back without a reason. */
export type RunState = 'draft' | 'locked' | 'approved' | 'paid'

export interface PayRun {
  m: string
  state: RunState
  published: boolean
  by: string | null
  at: string | null
}

export interface Claim {
  id: string
  who: string
  mn: string
  what: string
  amt: number
  st: 'pending' | 'approved' | 'paid' | 'rejected'
}

export interface Loan {
  id: string
  who: string
  amt: number
  taken: string
  emi: number
  paid: number
  note: string
}

export interface Arrear {
  id: string
  who: string
  mn: string
  what: string
  amt: number
}

export interface DeclType {
  k: string
  n: string
  cap: number
  d: string
}

export interface PettyEntry {
  id: string
  d: Date
  kind: 'credit' | 'debit'
  what: string
  amt: number
  by: string
  ref: string
  receipt: boolean
}

export interface PettyConfig {
  float: number
  limit: number
  custodian: string
  countEvery: string
}

/**
 * Somebody physically counting the box.
 *
 * `counted` is what was in the tin, not what the ledger expected — the whole
 * value of a count is that the two are recorded separately and can disagree.
 * Correcting the count to match the book is how a discrepancy becomes permanent.
 */
export interface PettyCount {
  id: string
  d: Date
  by: string
  counted: number
  note: string
}

export interface Opening {
  id: string
  title: string
  dep: string
  n: number
  type: string
  by: string
  open: Date
  why: string
}

/**
 * The hiring ladder, in order. `Joined` is the end of it: a candidate who
 * reaches it becomes a staff record, which is the only way anybody enters the
 * system — so nobody exists without a hiring trail behind them.
 */
export type HireStage =
  | 'Applied'
  | 'Screened'
  | 'Interview'
  | 'Offer'
  | 'Verification'
  | 'Joined'

export interface Candidate {
  id: string
  job: string
  n: string
  exp: number
  stage: HireStage
  src: string
  at: Date
  note: string
}

export interface Site {
  k: string
  n: string
  lat: number
  lng: number
  radius: number
}

/* ── assignment engine ──────────────────────────────────────────────────── */

/**
 * A rule's condition is data, not a closure and not prose — so the sentence shown
 * on the Rules tab can never disagree with what the engine actually does. Leaving
 * a test blank means "any".
 */
export interface RuleCondition {
  stage?: string
  product?: string
  state?: string
}

export interface Rule {
  id: string
  n: string
  k: 'block' | 'prefer' | 'route' | 'cover'
  lock?: boolean
  on: boolean
  when?: string
  then?: string
  cond?: RuleCondition
  /** For routing rules: the only people who may take the stage. */
  pool?: string[]
  stages?: string[]
}

export interface EngineConfig {
  trigger: 'arrival' | 'hourly' | 'manual'
  commit: 'auto' | 'hold'
  onChange: 'new' | 'all'
}

/** [value, label, explanation] */
export type EngineOption = [string, string, string]
export type EngineOptions = Record<keyof EngineConfig, EngineOption[]>

export interface LinkCheckConfig {
  every: number
  last: Date
  running: boolean
  notify: string
}
