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

export interface LinkType {
  k: string
  n: string
  req: boolean
  note: string
}

export interface Level {
  id: string
  n: string
  note: string
  /** 'all' or an explicit list of state codes. */
  states: 'all' | string[]
  /** state code → counties within it the level covers. */
  counties?: Record<string, string[]>
  /** 'all' or an explicit list of product ids. */
  products: 'all' | string[]
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

export interface Candidate {
  id: string
  job: string
  n: string
  exp: number
  stage: 'Applied' | 'Screened' | 'Interview' | 'Offer' | 'Verification'
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
