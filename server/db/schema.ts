import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'

/**
 * Every business table carries `tenantId`, and row-level security is enforced in
 * Postgres against `current_setting('app.tenant_id')` — see `rls.sql`. Application
 * code that forgets a WHERE clause therefore cannot leak one company's orders to
 * another; the database refuses rather than trusting the query.
 */

/* ── auth (Better Auth owns these four) ─────────────────────────────────── */

export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  image: text('image'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

export const session = pgTable('session', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),
  expiresAt: timestamp('expires_at').notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  /** Which workspace this session is currently inside. */
  activeTenantId: uuid('active_tenant_id'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

export const account = pgTable('account', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at'),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
  scope: text('scope'),
  idToken: text('id_token'),
  password: text('password'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

export const verification = pgTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

/* ── tenancy and permissions (ours, not the auth provider's) ────────────── */

export const tenants = pgTable('tenants', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  plan: text('plan').notNull(),
  /** Home state of the title company. */
  state: text('state').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const roles = pgTable(
  'roles',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    key: text('key').notNull(),
    name: text('name').notNull(),
    description: text('description').notNull().default(''),
    /** Built-in roles a company may rename but not delete. */
    locked: boolean('locked').notNull().default(false),
  },
  (t) => [uniqueIndex('roles_tenant_key').on(t.tenantId, t.key)],
)

/**
 * Capabilities are rows, not an enum column — a company can add its own on top of
 * the built-ins, and the permission matrix screen reads straight from here.
 */
export const rolePermissions = pgTable(
  'role_permissions',
  {
    roleId: uuid('role_id')
      .notNull()
      .references(() => roles.id, { onDelete: 'cascade' }),
    capability: text('capability').notNull(),
  },
  (t) => [primaryKey({ columns: [t.roleId, t.capability] })],
)

export const people = pgTable(
  'people',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    /** Null until the person has accepted their invitation. */
    userId: text('user_id').references(() => user.id, { onDelete: 'set null' }),
    ref: text('ref').notNull(),
    name: text('name').notNull(),
    email: text('email').notNull(),
    roleId: uuid('role_id').references(() => roles.id),
    /** Orders they can hold in a day. */
    capacity: integer('capacity').notNull().default(0),
    availability: text('availability').notNull().default('ok'),
    shift: text('shift').notNull().default('day'),
    active: boolean('active').notNull().default(true),
    levelId: uuid('level_id'),
    joinedOn: date('joined_on'),
    /** Annual cost to company, in minor units of the payroll currency. */
    ctc: integer('ctc'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [uniqueIndex('people_tenant_ref').on(t.tenantId, t.ref), index('people_tenant').on(t.tenantId)],
)

export const departments = pgTable(
  'departments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    key: text('key').notNull(),
    name: text('name').notNull(),
    description: text('description').notNull().default(''),
    /** Part of the automatic assignment pass. */
    auto: boolean('auto').notNull().default(true),
    /** The stage this department QCs, which is what the self-review rule keys off. */
    pairs: text('pairs'),
    position: integer('position').notNull().default(0),
  },
  (t) => [uniqueIndex('departments_tenant_key').on(t.tenantId, t.key)],
)

export const peopleDepartments = pgTable(
  'people_departments',
  {
    personId: uuid('person_id')
      .notNull()
      .references(() => people.id, { onDelete: 'cascade' }),
    departmentId: uuid('department_id')
      .notNull()
      .references(() => departments.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.personId, t.departmentId] })],
)

/* ── catalog and coverage ───────────────────────────────────────────────── */

export const products = pgTable(
  'products',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    code: text('code').notNull(),
    name: text('name').notNull(),
    /** Fee in USD. */
    fee: numeric('fee', { precision: 10, scale: 2 }).notNull(),
    /** SLA in hours. */
    slaHours: integer('sla_hours').notNull().default(24),
  },
  (t) => [uniqueIndex('products_tenant_code').on(t.tenantId, t.code)],
)

export const clients = pgTable(
  'clients',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    code: text('code').notNull(),
    name: text('name').notNull(),
    email: text('email').notNull().default(''),
    phone: text('phone').notNull().default(''),
    terms: text('terms').notNull().default('Net 30'),
    active: boolean('active').notNull().default(true),
  },
  (t) => [uniqueIndex('clients_tenant_code').on(t.tenantId, t.code)],
)

export const counties = pgTable(
  'counties',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    state: text('state').notNull(),
    /** County index used on recorder sites; null where the county publishes none. */
    idx: integer('idx'),
  },
  (t) => [uniqueIndex('counties_tenant_place').on(t.tenantId, t.state, t.name)],
)

export const countyLinks = pgTable(
  'county_links',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    countyId: uuid('county_id')
      .notNull()
      .references(() => counties.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull(),
    url: text('url').notNull().default(''),
    /** ok · slow · moved · auth · broken · none · unchecked */
    status: text('status').notNull().default('unchecked'),
    error: text('error'),
    checkedAt: timestamp('checked_at'),
  },
  (t) => [uniqueIndex('county_links_county_kind').on(t.countyId, t.kind)],
)

/** A grade: which states, counties and products somebody may be given. */
export const levels = pgTable('levels', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  note: text('note').notNull().default(''),
  /** null means every state; likewise for products. */
  states: jsonb('states').$type<string[] | null>(),
  counties: jsonb('counties').$type<Record<string, string[]>>().notNull().default({}),
  products: jsonb('products').$type<string[] | null>(),
})

/* ── production ─────────────────────────────────────────────────────────── */

export const orders = pgTable(
  'orders',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    /** Client-reference style, e.g. 4192254-2. Unique inside a workspace. */
    ref: text('ref').notNull(),
    clientId: uuid('client_id')
      .notNull()
      .references(() => clients.id),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id),
    status: text('status').notNull().default('search'),
    state: text('state').notNull(),
    county: text('county').notNull(),
    property: text('property').notNull(),
    parcelId: text('parcel_id'),
    borrower: text('borrower'),
    effectiveDate: date('effective_date'),
    receivedAt: timestamp('received_at').notNull().defaultNow(),
    /** Computed from the product's SLA at intake, then editable. */
    dueAt: timestamp('due_at').notNull(),
    deliveredAt: timestamp('delivered_at'),
    fee: numeric('fee', { precision: 10, scale: 2 }).notNull(),
    /** Why the clock is paused, when it is. */
    holdReason: text('hold_reason'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('orders_tenant_ref').on(t.tenantId, t.ref),
    index('orders_tenant_due').on(t.tenantId, t.dueAt),
    index('orders_tenant_status').on(t.tenantId, t.status),
  ],
)

/** One row per stage of an order: the six-slot strip on the register. */
export const orderStages = pgTable(
  'order_stages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    departmentId: uuid('department_id')
      .notNull()
      .references(() => departments.id),
    /** Null until somebody is placed on it. */
    assigneeId: uuid('assignee_id').references(() => people.id, { onDelete: 'set null' }),
    startedAt: timestamp('started_at'),
    finishedAt: timestamp('finished_at'),
    /** The trace the engine recorded when it placed — or refused to place — this stage. */
    decision: jsonb('decision').$type<{ rule: string; note: string }[]>(),
  },
  (t) => [
    uniqueIndex('order_stages_order_dept').on(t.orderId, t.departmentId),
    index('order_stages_assignee').on(t.tenantId, t.assigneeId),
  ],
)

export const orderEvents = pgTable(
  'order_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    actorId: uuid('actor_id').references(() => people.id, { onDelete: 'set null' }),
    kind: text('kind').notNull(),
    body: text('body').notNull().default(''),
    at: timestamp('at').notNull().defaultNow(),
  },
  (t) => [index('order_events_order').on(t.orderId, t.at)],
)

/* ── business ───────────────────────────────────────────────────────────── */

export const invoices = pgTable(
  'invoices',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    number: text('number').notNull(),
    clientId: uuid('client_id')
      .notNull()
      .references(() => clients.id),
    period: text('period').notNull(),
    orderCount: integer('order_count').notNull().default(0),
    amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
    paid: numeric('paid', { precision: 12, scale: 2 }).notNull().default('0'),
    status: text('status').notNull().default('open'),
    issuedAt: timestamp('issued_at').notNull().defaultNow(),
  },
  (t) => [uniqueIndex('invoices_tenant_number').on(t.tenantId, t.number)],
)

export const leads = pgTable('leads', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  company: text('company').notNull(),
  location: text('location').notNull().default(''),
  status: text('status').notNull().default('new'),
  ownerId: uuid('owner_id').references(() => people.id, { onDelete: 'set null' }),
  /** Raised by hand; staleness is derived from the notes instead. */
  flagged: boolean('flagged').notNull().default(false),
  contacts: jsonb('contacts').$type<{ name: string; role: string; email: string; phone: string }[]>()
    .notNull()
    .default([]),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const leadNotes = pgTable(
  'lead_notes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    leadId: uuid('lead_id')
      .notNull()
      .references(() => leads.id, { onDelete: 'cascade' }),
    authorId: uuid('author_id').references(() => people.id, { onDelete: 'set null' }),
    body: text('body').notNull(),
    at: timestamp('at').notNull().defaultNow(),
  },
  (t) => [index('lead_notes_lead').on(t.leadId, t.at)],
)

/* ── HRMS ───────────────────────────────────────────────────────────────── */

export const leaveRequests = pgTable(
  'leave_requests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    personId: uuid('person_id')
      .notNull()
      .references(() => people.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull(),
    fromDate: date('from_date').notNull(),
    toDate: date('to_date').notNull(),
    days: numeric('days', { precision: 4, scale: 1 }).notNull(),
    status: text('status').notNull().default('pending'),
    reason: text('reason').notNull().default(''),
    decidedById: uuid('decided_by_id').references(() => people.id, { onDelete: 'set null' }),
    decidedAt: timestamp('decided_at'),
  },
  (t) => [index('leave_person').on(t.tenantId, t.personId)],
)

export const attendance = pgTable(
  'attendance',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    personId: uuid('person_id')
      .notNull()
      .references(() => people.id, { onDelete: 'cascade' }),
    period: text('period').notNull(),
    workingDays: integer('working_days').notNull(),
    present: integer('present').notNull(),
    paidLeave: integer('paid_leave').notNull().default(0),
    unpaid: integer('unpaid').notNull().default(0),
    /** What payroll actually pays for — this is the only number the run reads. */
    payableDays: integer('payable_days').notNull(),
  },
  (t) => [uniqueIndex('attendance_person_period').on(t.personId, t.period)],
)

export const payRuns = pgTable(
  'pay_runs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    period: text('period').notNull(),
    /** draft → locked → approved → paid */
    state: text('state').notNull().default('draft'),
    published: boolean('published').notNull().default(false),
    approvedById: uuid('approved_by_id').references(() => people.id, { onDelete: 'set null' }),
    approvedAt: timestamp('approved_at'),
  },
  (t) => [uniqueIndex('pay_runs_tenant_period').on(t.tenantId, t.period)],
)

export const payslips = pgTable(
  'payslips',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    payRunId: uuid('pay_run_id')
      .notNull()
      .references(() => payRuns.id, { onDelete: 'cascade' }),
    personId: uuid('person_id')
      .notNull()
      .references(() => people.id, { onDelete: 'cascade' }),
    gross: numeric('gross', { precision: 12, scale: 2 }).notNull(),
    deductions: numeric('deductions', { precision: 12, scale: 2 }).notNull(),
    net: numeric('net', { precision: 12, scale: 2 }).notNull(),
    /** The earning and deduction lines, as computed at the moment the run locked. */
    lines: jsonb('lines').$type<{ label: string; amount: number; kind: 'earn' | 'deduct' }[]>()
      .notNull()
      .default([]),
  },
  (t) => [uniqueIndex('payslips_run_person').on(t.payRunId, t.personId)],
)

export const pettyCash = pgTable(
  'petty_cash',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    at: timestamp('at').notNull().defaultNow(),
    /** credit · debit */
    kind: text('kind').notNull(),
    description: text('description').notNull(),
    amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
    recordedById: uuid('recorded_by_id').references(() => people.id, { onDelete: 'set null' }),
    reference: text('reference').notNull().default(''),
    hasReceipt: boolean('has_receipt').notNull().default(false),
  },
  (t) => [index('petty_cash_tenant_at').on(t.tenantId, t.at)],
)

export const openings = pgTable('openings', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  departmentId: uuid('department_id').references(() => departments.id, { onDelete: 'set null' }),
  seats: integer('seats').notNull().default(1),
  employment: text('employment').notNull().default('Full time'),
  rationale: text('rationale').notNull().default(''),
  openedAt: timestamp('opened_at').notNull().defaultNow(),
  closedAt: timestamp('closed_at'),
})

export const candidates = pgTable(
  'candidates',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    openingId: uuid('opening_id')
      .notNull()
      .references(() => openings.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    yearsExperience: integer('years_experience').notNull().default(0),
    stage: text('stage').notNull().default('Applied'),
    source: text('source').notNull().default(''),
    note: text('note').notNull().default(''),
    appliedAt: timestamp('applied_at').notNull().defaultNow(),
  },
  (t) => [index('candidates_opening').on(t.openingId)],
)

/* ── engine configuration ───────────────────────────────────────────────── */

export const assignmentRules = pgTable('assignment_rules', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  key: text('key').notNull(),
  name: text('name').notNull(),
  /** block · prefer · route · cover */
  kind: text('kind').notNull(),
  enabled: boolean('enabled').notNull().default(true),
  locked: boolean('locked').notNull().default(false),
  position: integer('position').notNull().default(0),
  /** The condition is data, so the sentence shown to a user cannot disagree with it. */
  condition: jsonb('condition').$type<{ stage?: string; product?: string; state?: string }>(),
  pool: jsonb('pool').$type<string[]>(),
  statement: text('statement').notNull().default(''),
})

export const slaRules = pgTable('sla_rules', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  clientId: uuid('client_id').references(() => clients.id, { onDelete: 'cascade' }),
  productId: uuid('product_id').references(() => products.id, { onDelete: 'cascade' }),
  hours: integer('hours').notNull().default(24),
  /** The fallback when no client- or product-specific rule matches. */
  isDefault: boolean('is_default').notNull().default(false),
})

/** Share of an order's budget each stage gets, plus the slack held back. */
export const stageBudgets = pgTable(
  'stage_budgets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    productId: uuid('product_id').references(() => products.id, { onDelete: 'cascade' }),
    departmentId: uuid('department_id')
      .notNull()
      .references(() => departments.id, { onDelete: 'cascade' }),
    percent: numeric('percent', { precision: 5, scale: 2 }).notNull(),
  },
  (t) => [uniqueIndex('stage_budgets_scope').on(t.tenantId, t.productId, t.departmentId)],
)

export const tenantSettings = pgTable('tenant_settings', {
  tenantId: uuid('tenant_id')
    .primaryKey()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  dateFormat: text('date_format').notNull().default('MM/DD/YYYY'),
  /** Percentage of the SLA held back as slack before the stages divide the rest. */
  slaBufferPct: integer('sla_buffer_pct').notNull().default(10),
  onTimeTarget: integer('on_time_target').notNull().default(98),
  payroll: jsonb('payroll').$type<Record<string, unknown>>().notNull().default({}),
  engine: jsonb('engine').$type<Record<string, unknown>>().notNull().default({}),
})
