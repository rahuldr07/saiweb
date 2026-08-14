-- Row-level security.
--
-- Tenant isolation is enforced by Postgres, not by application code. Every request
-- opens its connection, sets `app.tenant_id` to the workspace the session is
-- inside, and from then on a missing WHERE clause returns nothing rather than
-- another company's rows.
--
-- Run after `drizzle-kit push`:
--   npm run db:rls
--
-- This file is deliberately plain SQL with no psql meta-commands, so the runner
-- in `apply-rls.ts` can execute it over an ordinary connection. The application
-- role is created there rather than here, because its password comes from
-- APP_DATABASE_URL — that way the role this script grants to and the role the
-- server connects as cannot drift apart.
--
-- Two things about that role are load-bearing:
--
--  * It must be able to log in, because this is the role the server connects as.
--  * It must NOT be a table owner or a superuser: RLS is bypassed for both,
--    which would silently defeat everything below.

GRANT USAGE ON SCHEMA public TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;

-- The role running this script owns the tables and also loads the seed. Creating
-- a workspace means inserting the very row that every policy below scopes
-- against, so there is no scope to be inside while doing it — FORCE would refuse
-- the insert even from the owner. BYPASSRLS is the supported way to say "this
-- role provisions, it does not serve requests".
--
-- Granting it needs superuser. Where the owner is not a superuser and cannot be
-- given the attribute, run the seed before this script instead.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = current_user AND rolsuper) THEN
    EXECUTE format('ALTER ROLE %I BYPASSRLS', current_user);
  ELSIF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = current_user AND rolbypassrls) THEN
    RAISE WARNING
      'Role % has neither superuser nor BYPASSRLS. npm run db:seed will be refused by the policies below; grant BYPASSRLS or seed first.',
      current_user;
  END IF;
END
$$;

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

-- ── the one deliberate exception ─────────────────────────────────────────────
--
-- "Which workspaces do I belong to?" cannot be answered from inside a workspace,
-- and the policies above are what make that true. The workspace switcher needs
-- an answer anyway, so this is the exception — narrow, named, and written down
-- rather than solved by handing the server a role that bypasses everything.
--
-- SECURITY DEFINER runs it as the owner, so it sees across tenants. It is safe
-- because it takes a user id and returns only that user's own memberships: there
-- is no argument that widens it, and it exposes nothing but the workspaces a
-- caller is already entitled to enter.
CREATE OR REPLACE FUNCTION app_memberships(p_user_id text)
RETURNS TABLE (tenant_id uuid, slug text, name text, plan text, state text, person_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT t.id, t.slug, t.name, t.plan, t.state, p.id
  FROM people p
  JOIN tenants t ON t.id = p.tenant_id
  WHERE p.user_id = p_user_id
    AND p.active
  ORDER BY t.name
$$;

REVOKE ALL ON FUNCTION app_memberships(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_memberships(text) TO app_user;
