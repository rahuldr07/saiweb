export interface Tenant {
  id: string
  name: string
  plan: string
  state: string
}

export interface Dept {
  id: string
  n: string
  desc: string
  auto: boolean
  pair: string | null
  qc: boolean
}

export interface Perm {
  k: string
  n: string
  sys: boolean
  never?: boolean
}

export interface Role {
  id: string
  n: string
  desc: string
  lock?: boolean | undefined
  p: string[]
}

export type StatusMap = Record<string, [string, string]>
export type ChipKind = 'n' | 'b' | 'v' | 'r' | 'd'
export type LabelMap = Record<string, [string, ChipKind]>

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
  dep: string[]
  r: string
  cap: number
  open: number
  avail: Availability
  active: boolean
  ctc?: number | undefined
  shift: string
  mob: string
  addr: string
  emg: Emergency
  aadhaar: string
  doj: string
  dob: string
  pan: string
  uan: string
  esicNo: string
  bank: Bank
  e: string
  lvl?: string
  conflict?: boolean
  leaving?: Date
}

export const newPerson = (): Person => ({
  id: '',
  n: '',
  dep: [],
  r: 'staff',
  cap: 0,
  open: 0,
  avail: 'ok',
  active: true,
  shift: 'day',
  mob: '',
  addr: '',
  emg: { n: '', rel: '', mob: '' },
  aadhaar: '',
  doj: '',
  dob: '',
  pan: '',
  uan: '',
  esicNo: '',
  bank: { acct: '', ifsc: '', name: '' },
  e: '',
})

export interface Shift {
  k: string
  n: string
  from: string
  to: string
  c: ChipKind
  d: string
}

export interface Holiday {
  d: string
  n: string
  opt: boolean
}

export interface Product {
  id: string
  n: string
  fee: number
  h: number
}

export type LinkStatus = 'ok' | 'slow' | 'moved' | 'auth' | 'broken' | 'none' | 'unchecked'

export interface CountyLink {
  u: string
  s: LinkStatus
  err?: string
  since?: Date
}

export interface County {
  n: string
  st: string
  idx: number | null
  links: Record<string, CountyLink>
}

export interface Connector {
  k: string
  icon: string
  n: string
  d: string
  cta: string
  connected?: boolean
  needs: string
}

export interface LinkType {
  k: string
  n: string
  req: boolean
  note: string
}

export interface Coverage {
  states: 'all' | string[]
  counties?: Record<string, string[]>
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

export type Assignments = Record<string, string | null>

export interface Order {
  id: string
  cl: string
  pr: string
  stt: OrderStatus
  st: string
  co: string
  prop: string
  a: Assignments
  due: Date
  recv: Date
  fee: number
  age: string
  done?: boolean
  flag?: string

  ref?: string
  buyer?: string
  seller?: string
  instr?: string
  parcel?: string
  eff?: string
}

export interface Tier {
  id: string
  n: string
  mult: number
  up: number
}

export interface MailItem {
  f: string
  s: string
  t: Date
  at: string[]
  x: [string, string][]
  st: 'ready' | 'dupe' | 'attach'
  dupe?: string
  match?: string
}

export interface Update {
  id: string
  who: string
  d: Date
  kind: 'Handover' | 'Blocked' | 'Done' | 'Decision' | 'Note'
  b: string
}

export interface Invoice {
  id: string
  cl: string
  code: string
  m: string
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

export interface DayMark {
  in: string
  out: string | null
  late: number
  shift: string
  where: string
  outWhere?: string
  inside: boolean
  acc: number | null
  breakIn?: string | null
  breakOut?: string | null
  breakMins?: number
}

export interface Regularisation {
  id: string
  who: string
  d: Date
  was: string
  ask: string
  st: 'pending' | 'approved' | 'rejected'
}

export interface Swap {
  id: string
  from: string
  to: string
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
  due: string
  at: string
  mins: number
  why: string | null
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

export interface LeaveType {
  k: string
  n: string
  annual: number
  carry: number
  enc: boolean
  c: ChipKind
  d: string
}

export interface LeaveClash {
  dep: string
  left: number
  team: number
  who: string[]
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

  half?: boolean
  clash?: LeaveClash | null
  shortNotice?: number | null
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

export type LoanKind = 'loan' | 'advance'
export type LoanStatus = 'requested' | 'active' | 'paused' | 'closed' | 'rejected'

export interface LoanRecord {
  id: string
  who: string
  kind: LoanKind
  amt: number
  emi: number
  paid: number
  st: LoanStatus
  reqAt: Date
  decidedBy?: string
  decidedAt?: Date
  takenOn?: Date
  note: string
}

export interface LoanPayment {
  id: string
  loanId: string
  mn: string
  amt: number
  at: Date
}

export interface LoanEvent {
  id: string
  loanId: string
  at: Date
  by: string
  action: 'requested' | 'approved' | 'rejected' | 'paused' | 'resumed' | 'closed'
  note?: string
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
  pool?: string[]
  stages?: string[]
}

export interface EngineConfig {
  trigger: 'arrival' | 'hourly' | 'manual'
  commit: 'auto' | 'hold'
  onChange: 'new' | 'all'
}

export type EngineOption = [string, string, string]
export type EngineOptions = Record<keyof EngineConfig, EngineOption[]>

export interface LinkCheckConfig {
  every: number
  last: Date
  running: boolean
  notify: string
}
