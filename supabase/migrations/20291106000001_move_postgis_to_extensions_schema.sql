-- Prepare PostGIS move to extensions schema (safe, no DROP)
-- Supabase Database Linter: extension_in_public (0014)
--
-- The Data API does not expose the extensions schema, so the extension_in_public
-- finding clears once postgis lives in extensions. Moving PostGIS requires
-- dropping and recreating the extension, which can destroy dependent objects.
-- This migration only prepares and maps dependencies. It does NOT drop PostGIS.
--
-- Before the move (handled via Database > Extensions or Supabase support):
--   1. Back up the database.
--   2. Confirm no tables use geometry/geography columns (checked below).
--   3. Map dependent functions/views (checked below) and repoint their search_path
--      or schema-qualify PostGIS references (e.g. extensions.ST_Intersects).
--   4. Let Supabase drop/recreate postgis in the extensions schema.
--   5. Restore data and verify callers resolve geometry/geography/ST_*.
--
-- Reference: https://supabase.com/docs/guides/database/extensions/postgis#troubleshooting

-- Ensure the extensions schema exists
CREATE SCHEMA IF NOT EXISTS extensions;

-- Record current extension location
SELECT extname, extnamespace::regnamespace AS schema_name
FROM pg_extension
WHERE extname = 'postgis';

-- Guard: list any tables with geometry/geography-typed columns.
-- If any rows return, do NOT drop PostGIS; spatial columns depend on the extension.
SELECT
    n.nspname AS table_schema,
    c.relname AS table_name,
    a.attname AS column_name,
    pg_catalog.format_type(a.atttypid, a.atttypmod) AS data_type
FROM pg_attribute a
JOIN pg_class c ON c.oid = a.attrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE a.attnum > 0
  AND NOT a.attisdropped
  AND c.relkind IN ('r','p')
  AND n.nspname NOT IN ('pg_catalog','information_schema')
  AND pg_catalog.format_type(a.atttypid, a.atttypmod) ILIKE ANY (ARRAY['geometry%','geography%'])
ORDER BY n.nspname, c.relname, a.attname;

-- Map functions that reference PostGIS functions or types so they can be
-- repointed (search_path = public, extensions) or schema-qualified before the move.
SELECT DISTINCT
    n.nspname AS object_schema,
    p.proname AS object_name,
    'function' AS object_type,
    pg_get_functiondef(p.oid) AS definition
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE pg_get_functiondef(p.oid) ILIKE ANY (ARRAY['%geometry%','%geography%','%ST_%','%postgis%'])
ORDER BY n.nspname, p.proname;

-- Map views that reference PostGIS functions or types.
SELECT DISTINCT
    n.nspname AS object_schema,
    v.viewname AS object_name,
    'view' AS object_type,
    pg_get_viewdef(c.oid, true) AS definition
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
JOIN pg_views v ON v.schemaname = n.nspname AND v.viewname = c.relname
WHERE c.relkind = 'v'
  AND n.nspname NOT IN ('pg_catalog','information_schema')
  AND pg_get_viewdef(c.oid, true) ILIKE ANY (ARRAY['%geometry%','%geography%','%ST_%','%postgis%'])
ORDER BY n.nspname, v.viewname;

-- Status view for extension locations (read-only; safe to create)
CREATE OR REPLACE VIEW public.extension_status AS
SELECT
    extname AS extension_name,
    extnamespace::regnamespace AS schema_name,
    extversion AS version,
    CASE
        WHEN extnamespace::regnamespace::text = 'public'
          THEN 'WARNING: Extension in public schema'
        ELSE 'OK: Extension in proper schema'
    END AS status
FROM pg_extension
WHERE extname IN ('postgis', 'uuid-ossp', 'pgcrypto', 'intarray');

SELECT 'PostGIS move preparation complete: dependencies mapped, no objects dropped' AS status;
