-- Row-level security.
--
-- Tenant isolation is enforced by Postgres, not by application code. Every request
-- opens its connection, sets `app.tenant_id` to the workspace the session is
-- inside, and from then on a missing WHERE clause returns nothing rather than
-- another company's rows.
--
-- Run after `drizzle-kit push` (or wire it in as a migration):
--   psql "$DATABASE_URL" -f server/db/rls.sql

-- The application role. It must NOT be the table owner or a superuser: RLS is
-- bypassed for both, which would silently defeat everything below.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN
    CREATE ROLE app_user NOLOGIN;
  END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;

-- Current workspace, read from the connection-local setting. `true` makes the
-- lookup return NULL instead of erroring when it has not been set, so an
-- unscoped connection sees nothing rather than blowing up.
CREATE OR REPLACE FUNCTION app_current_tenant() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.tenant_id', true), '')::uuid
$$;

-- Every business table carries tenant_id and gets the same policy.
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'roles', 'people', 'departments', 'products', 'clients', 'counties',
    'county_links', 'levels', 'orders', 'order_stages', 'order_events',
    'invoices', 'leads', 'lead_notes', 'leave_requests', 'attendance',
    'pay_runs', 'payslips', 'petty_cash', 'openings', 'candidates',
    'assignment_rules', 'sla_rules', 'stage_budgets', 'tenant_settings'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    -- FORCE so the policy also applies to the table owner during local work.
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', t);
    EXECUTE format($f$
      CREATE POLICY tenant_isolation ON %I
        USING (tenant_id = app_current_tenant())
        WITH CHECK (tenant_id = app_current_tenant())
    $f$, t);
  END LOOP;
END
$$;

-- role_permissions has no tenant_id of its own; it inherits through its role.
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON role_permissions;
CREATE POLICY tenant_isolation ON role_permissions
  USING (EXISTS (SELECT 1 FROM roles r WHERE r.id = role_id AND r.tenant_id = app_current_tenant()))
  WITH CHECK (EXISTS (SELECT 1 FROM roles r WHERE r.id = role_id AND r.tenant_id = app_current_tenant()));

-- Likewise people_departments, through the person.
ALTER TABLE people_departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE people_departments FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON people_departments;
CREATE POLICY tenant_isolation ON people_departments
  USING (EXISTS (SELECT 1 FROM people p WHERE p.id = person_id AND p.tenant_id = app_current_tenant()))
  WITH CHECK (EXISTS (SELECT 1 FROM people p WHERE p.id = person_id AND p.tenant_id = app_current_tenant()));

-- `tenants` itself is readable only for the workspace you are inside; joining a
-- different one is a session-level decision, made before the setting is applied.
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_self ON tenants;
CREATE POLICY tenant_self ON tenants
  USING (id = app_current_tenant())
  WITH CHECK (id = app_current_tenant());

-- Better Auth's own tables are global by design: a person may belong to more than
-- one workspace, and the session records which one is active.
