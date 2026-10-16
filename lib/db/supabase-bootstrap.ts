/**
 * The roles, auth schema, auth.uid()/auth.role() helpers and default privileges that Supabase sets up
 * before any migration runs. Shared by the PGlite test emulation and the backup restore check
 * (never used by the app at runtime).
 */
export const SUPABASE_BOOTSTRAP_SQL = `
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE SCHEMA auth;
CREATE TABLE auth.users (id uuid PRIMARY KEY, email text);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
  $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS
  $$ SELECT nullif(current_setting('request.jwt.claim.role', true), '') $$;
GRANT USAGE ON SCHEMA public, auth TO anon, authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA auth TO anon, authenticated, service_role;
GRANT SELECT ON auth.users TO service_role;
-- Supabase's default privileges on the public schema (this is why column-level REVOKEs alone do nothing).
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;
`;

/** Other Supabase-managed roles a real pg_dump may GRANT to; created NOLOGIN so a restore does not fail on them. */
export const SUPABASE_EXTRA_ROLES = [
  "supabase_admin",
  "authenticator",
  "dashboard_user",
  "pgbouncer",
  "supabase_auth_admin",
  "supabase_storage_admin",
  "supabase_realtime_admin",
  "supabase_replication_admin",
  "supabase_read_only_user",
];
