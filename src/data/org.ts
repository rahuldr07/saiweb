/* AUTO-GENERATED from the Claude Design "Title CRM 897". Values are the design's own. */
import type {
  Tenant,
  Dept,
  Perm,
  Role,
  StatusMap,
  Rule,
  EngineConfig,
  EngineOptions,
  Level,
} from './types'

export const TENANTS: Tenant[] = [
  { id: "ka", name: "Keystone Abstract", plan: "Professional · 12 seats", state: "PA" },
  { id: "ps", name: "Peach State Abstract", plan: "Professional · 8 seats", state: "GA" },
  { id: "bg", name: "Bluegrass Title Svc", plan: "Starter · 4 seats", state: "KY" },
  { id: "new", name: "+ Add a company", plan: "", state: "" },
]

export const DEPTLIST: Dept[] = [
  { id: "search", n: "Search", desc: "Title search", auto: true, pair: null, qc: false },
  { id: "sqc", n: "Search QC", desc: "Check the search", auto: true, pair: "Search", qc: true },
  { id: "typing", n: "Typing", desc: "Data entry", auto: true, pair: null, qc: false },
  { id: "tqc", n: "Typing QC", desc: "Check the typing", auto: true, pair: "Typing", qc: true },
  { id: "rts", n: "RTS", desc: "Ready to send — final upload", auto: true, pair: null, qc: false },
  {
    id: "docreq",
    n: "Doc Req",
    desc: "Chasing a missing document",
    auto: false,
    pair: null,
    qc: false,
  },
]

export const STAGES: string[] = ["Search", "Search QC", "Typing", "Typing QC", "RTS", "Doc Req"]

export const ASSIGN_STAGES: string[] = ["Search", "Search QC", "Typing", "Typing QC", "RTS"]

export const PAIRS: Record<string, string> = { "Search QC": "Search", "Typing QC": "Typing" }

export const PERMS: Perm[] = [
  { k: "own", n: "See orders assigned to them", sys: true },
  { k: "all", n: "See every order", sys: true },
  { k: "assign", n: "Assign work", sys: true },
  { k: "pricing", n: "See pricing and invoices", sys: true },
  { k: "qc", n: "Enter QC ratings", sys: true },
  { k: "config", n: "Edit SLA, workflow, rules and link types", sys: true },
  { k: "people", n: "Manage staff, roles and departments", sys: true },
  { k: "export", n: "Export company data", sys: true },
  { k: "override", n: "Override a blocking rule", sys: true, never: true },
]

export const ADMIN_FLOOR: string[] = ["people", "config"]

export const ROLELIST: Role[] = [
  { id: "staff", n: "Staff", desc: "Works the orders assigned to them", lock: true, p: ["own", "qc"] },
  {
    id: "lead",
    n: "Lead",
    desc: "Runs a department — sees everything, gives the work out",
    p: ["own", "all", "assign", "qc"],
  },
  {
    id: "admin",
    n: "Company admin",
    desc: "Everything except overriding a blocking rule",
    lock: true,
    p: ["own", "all", "assign", "pricing", "qc", "config", "people", "export"],
  },
]

export const STATUS: StatusMap = {
  search: ["Search", "#3B82F6"],
  wip: ["WIP", "#6366F1"],
  sq: ["Search QC", "#8B5CF6"],
  typing: ["Typing", "#A855F7"],
  tqc: ["Typing QC", "#C026D3"],
  rts: ["RTS", "#06B6D4"],
  upload: ["Upload", "#10B981"],
  sent: ["Sent", "#0F7B4F"],
  hold: ["Hold", "#F97316"],
  docreq: ["Doc Req", "#EAB308"],
  fee: ["Fee Approval", "#F59E0B"],
  eff: ["Eff Date", "#EC4899"],
  clar: ["Clarification", "#14B8A6"],
  canc: ["Canceled", "#94A3B8"],
}

export const NAVPERM: Record<string, string | null> = {
  assign: "assign",
  intake: "all",
  billing: "pricing",
  leads: "pricing",
  performance: "all",
  integ: "config",
  company: "people",
  dash: "all",
  mywork: null,
  commitment: null,
  orders: null,
  counties: null,
  linkcheck: null,
  myperf: null,
  mypay: null,
  payroll: "pricing",
  payslips: "pricing",
  attend: "all",
  leave: null,
  hiring: "people",
  petty: "pricing",
}

export const RULES: Rule[] = [
  {
    id: "r1",
    n: "Department membership",
    k: "block",
    lock: true,
    on: true,
    when: "always",
    then: "Only a member of that stage’s department may take it",
  },
  {
    id: "r2",
    n: "Availability",
    k: "block",
    on: true,
    when: "always",
    then: "Skip anyone on leave or off shift",
  },
  {
    id: "r3",
    n: "Daily target",
    k: "block",
    on: true,
    when: "always",
    then: "Never load anyone past their target",
  },
  {
    id: "r4",
    n: "Self-review",
    k: "block",
    lock: true,
    on: true,
    when: "stage is a QC stage",
    then: "Never the person who did the paired stage",
  },
  {
    id: "r5",
    n: "LIEN typing group",
    k: "route",
    on: true,
    cond: { product: "LIEN", stage: "Typing" },
    pool: ["sk", "pn", "bn"],
  },
  {
    id: "r6",
    n: "State and county coverage",
    k: "cover",
    on: true,
    when: "stage is Search or Search QC",
    then: "Only someone who covers that state, and that county if counties were named",
    stages: ["Search", "Search QC"],
  },
  {
    id: "r7",
    n: "Product coverage",
    k: "cover",
    on: true,
    when: "stage is Search or Search QC",
    then: "Only someone who works that product",
    stages: ["Search", "Search QC"],
  },
  {
    id: "r8",
    n: "Fill the emptiest first",
    k: "prefer",
    lock: true,
    on: true,
    when: "always",
    then: "Pick whoever is furthest below their target",
  },
]

export const ENGINE: EngineConfig = { trigger: "arrival", commit: "auto", onChange: "new" }

export const ENGINEOPTS: EngineOptions = {
  trigger: [
    [
      "arrival",
      "As each order arrives",
      "Orders come in 10–15 an hour, so placing on arrival keeps the board current all day.",
    ],
    [
      "hourly",
      "Every hour",
      "Work sits unplaced for up to an hour. Quieter, but the board is behind for most of it.",
    ],
    [
      "manual",
      "Manual",
      "Nothing is placed until somebody runs it. Everything waits, including work that is already late.",
    ],
  ],
  commit: [
    [
      "auto",
      "Automatically",
      "Assignments take effect immediately. Exceptions are the only thing that waits for a person.",
    ],
    [
      "hold",
      "Hold for review",
      "Every placement waits for someone to agree it. Safer, and slower by exactly as long as the reviewer takes.",
    ],
  ],
  onChange: [
    [
      "new",
      "New orders only",
      "A rule change applies from now on. Work already in a queue stays where it is.",
    ],
    [
      "rerun",
      "Re-run today's",
      "A rule change moves work already sitting in somebody's queue. Use it when a rule was wrong, not when it was merely improved.",
    ],
  ],
}

export const LEVELS: Level[] = [
  {
    id: "l1",
    n: "Level 1",
    note: "Learning. Current owner searches in the counties they have been shown.",
    states: ["PA", "GA"],
    counties: { PA: ["Cambria", "Luzerne"] },
    products: ["COS"],
  },
  {
    id: "l2",
    n: "Level 2",
    note: "Confident on the standard products across the states we work most.",
    states: ["PA", "GA", "CT", "KY", "TN"],
    counties: {},
    products: ["COS", "TOS", "Update", "PRLP", "LIEN", "10Y", "20Y"],
  },
  {
    id: "l3",
    n: "Level 3",
    note: "Everything, including the long searches and the courthouse states.",
    states: "all",
    counties: {},
    products: "all",
  },
]

export const COVSTAGES: string[] = ["Search", "Search QC"]

export const COTABS: string[] = ["Company", "Staff", "Clients", "Departments", "Roles", "Workflow", "Turnaround & SLA", "Payroll"]

