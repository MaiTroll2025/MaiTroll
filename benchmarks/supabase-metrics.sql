-- ============================================================
-- Mai Troll PERFORMANCE BENCHMARK - SUPABASE SQL QUERIES
-- Date: 2026-06-14
-- Run each section in Supabase SQL Editor
-- ============================================================

-- ============================================================
-- SECTION 1: ACTIVE CONNECTIONS
-- ============================================================

-- 1A: Total active connections
SELECT
  count(*) AS active_connections
FROM pg_stat_activity;

-- 1B: Connections by application name
SELECT
  application_name,
  count(*) AS connection_count
FROM pg_stat_activity
GROUP BY application_name
ORDER BY connection_count DESC;

-- 1C: Connections by state
SELECT
  state,
  count(*) AS count
FROM pg_stat_activity
GROUP BY state
ORDER BY count DESC;

-- 1D: Connections with wait events
SELECT
  wait_event_type,
  wait_event,
  count(*) AS count
FROM pg_stat_activity
WHERE state = 'active'
GROUP BY wait_event_type, wait_event
ORDER BY count DESC
LIMIT 20;

-- ============================================================
-- SECTION 2: TOP QUERY REPORT (requires pg_stat_statements)
-- ============================================================

-- 2A: Top 20 queries by total execution time
SELECT
  calls,
  ROUND(total_exec_time::numeric, 2) AS total_exec_time_ms,
  ROUND(mean_exec_time::numeric, 2) AS mean_exec_time_ms,
  ROUND((total_exec_time / NULLIF(SUM(total_exec_time) OVER (), 0) * 100)::numeric, 2) AS pct_total_time,
  LEFT(query, 150) AS query_preview
FROM pg_stat_statements
ORDER BY total_exec_time DESC
LIMIT 20;

-- 2B: Top 20 queries by call count
SELECT
  calls,
  ROUND(total_exec_time::numeric, 2) AS total_exec_time_ms,
  ROUND(mean_exec_time::numeric, 2) AS mean_exec_time_ms,
  LEFT(query, 150) AS query_preview
FROM pg_stat_statements
ORDER BY calls DESC
LIMIT 20;

-- 2C: Stream-related queries specifically
SELECT
  calls,
  ROUND(total_exec_time::numeric, 2) AS total_exec_time_ms,
  ROUND(mean_exec_time::numeric, 2) AS mean_exec_time_ms,
  LEFT(query, 200) AS query_preview
FROM pg_stat_statements
WHERE query ILIKE '%streams%'
ORDER BY total_exec_time DESC
LIMIT 10;

-- 2D: League-related queries
SELECT
  calls,
  ROUND(total_exec_time::numeric, 2) AS total_exec_time_ms,
  ROUND(mean_exec_time::numeric, 2) AS mean_exec_time_ms,
  LEFT(query, 200) AS query_preview
FROM pg_stat_statements
WHERE query ILIKE '%league%'
ORDER BY total_exec_time DESC
LIMIT 10;

-- 2E: Gift-related queries
SELECT
  calls,
  ROUND(total_exec_time::numeric, 2) AS total_exec_time_ms,
  ROUND(mean_exec_time::numeric, 2) AS mean_exec_time_ms,
  LEFT(query, 200) AS query_preview
FROM pg_stat_statements
WHERE query ILIKE '%gift%'
ORDER BY total_exec_time DESC
LIMIT 10;

-- ============================================================
-- SECTION 3: CRON JOBS
-- ============================================================

-- 3A: All scheduled cron jobs
SELECT
  jobid,
  jobname,
  schedule,
  active
FROM cron.job
ORDER BY jobname;

-- 3B: Recent cron job runs (last 24 hours)
SELECT
  j.jobname,
  j.schedule,
  r.start_time,
  r.end_time,
  r.status,
  r.return_message
FROM cron.job j
LEFT JOIN cron.job_run_details r ON j.jobid = r.jobid
WHERE r.start_time > NOW() - INTERVAL '24 hours'
ORDER BY r.start_time DESC
LIMIT 50;

-- 3C: Cron job error summary
SELECT
  j.jobname,
  count(*) AS total_runs,
  count(*) FILTER (WHERE r.status = 'failed') AS failed_runs,
  count(*) FILTER (WHERE r.status = 'succeeded') AS succeeded_runs
FROM cron.job j
LEFT JOIN cron.job_run_details r ON j.jobid = r.jobid
WHERE r.start_time > NOW() - INTERVAL '24 hours'
GROUP BY j.jobname
ORDER BY failed_runs DESC;

-- ============================================================
-- SECTION 4: TABLE STATISTICS
-- ============================================================

-- 4A: Table sizes
SELECT
  relname AS table_name,
  n_live_tup AS row_count,
  n_dead_tup AS dead_rows,
  ROUND(pg_total_relation_size(relid) / 1024.0 / 1024.0, 2) AS total_size_mb,
  last_vacuum,
  last_autovacuum,
  last_analyze
FROM pg_stat_user_tables
ORDER BY pg_total_relation_size(relid) DESC
LIMIT 30;

-- 4B: Sequential vs index scans (high seq scan = missing index)
SELECT
  relname AS table_name,
  seq_scan,
  seq_tup_read,
  idx_scan,
  idx_tup_fetch,
  CASE WHEN seq_scan + idx_scan > 0
    THEN ROUND(seq_scan::numeric / (seq_scan + idx_scan) * 100, 1)
    ELSE 0
  END AS seq_scan_pct
FROM pg_stat_user_tables
WHERE seq_scan + idx_scan > 0
ORDER BY seq_scan DESC
LIMIT 20;

-- 4C: Most-written tables (high churn)
SELECT
  relname AS table_name,
  n_tup_ins AS inserts,
  n_tup_upd AS updates,
  n_tup_del AS deletes,
  n_tup_hot_upd AS hot_updates
FROM pg_stat_user_tables
ORDER BY n_tup_ins + n_tup_upd + n_tup_del DESC
LIMIT 20;

-- ============================================================
-- SECTION 5: INDEX HEALTH
-- ============================================================

-- 5A: Unused indexes (candidates for removal)
SELECT
  schemaname,
  relname AS table_name,
  indexrelname AS index_name,
  idx_scan AS times_used,
  pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
FROM pg_stat_user_indexes
WHERE idx_scan = 0
  AND schemaname = 'public'
ORDER BY pg_relation_size(indexrelid) DESC;

-- 5B: Missing index candidates (tables with high seq scans)
SELECT
  relname AS table_name,
  seq_scan,
  seq_tup_read,
  n_live_tup AS estimated_rows
FROM pg_stat_user_tables
WHERE seq_scan > 100
  AND n_live_tup > 1000
  AND (idx_scan IS NULL OR seq_scan > idx_scan * 10)
ORDER BY seq_tup_read DESC
LIMIT 20;

-- ============================================================
-- SECTION 6: LOCK CONTENTION
-- ============================================================

-- 6A: Current locks
SELECT
  l.locktype,
  l.relation::regclass AS table_name,
  l.mode,
  l.granted,
  a.usename,
  a.application_name,
  a.state,
  LEFT(a.query, 100) AS query_preview
FROM pg_locks l
JOIN pg_stat_activity a ON l.pid = a.pid
WHERE l.granted = false
ORDER BY l.locktype;

-- 6B: Lock wait events (join pg_stat_activity for usename)
SELECT
  ba.pid AS blocked_pid,
  ba.usename AS blocked_user,
  bb.pid AS blocking_pid,
  bb.usename AS blocking_user,
  LEFT(ba.query, 100) AS blocked_query,
  LEFT(bb.query, 100) AS blocking_query
FROM pg_locks blocked
JOIN pg_locks blocking ON blocked.locktype = blocking.locktype
  AND blocked.database = blocking.database
  AND blocked.relation = blocking.relation
  AND blocked.pid != blocking.pid
  AND blocked.granted = false
  AND blocking.granted = true
JOIN pg_stat_activity ba ON blocked.pid = ba.pid
JOIN pg_stat_activity bb ON blocking.pid = bb.pid;

-- ============================================================
-- SECTION 7: REALTIME PUBLICATION STATUS
-- ============================================================

-- 7A: Tables in realtime publication
SELECT
  schemaname,
  tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
ORDER BY tablename;

-- 7B: Replication slot status
SELECT
  slot_name,
  plugin,
  slot_type,
  active,
  restart_lsn,
  confirmed_flush_lsn
FROM pg_replication_slots;

-- ============================================================
-- SECTION 8: DATABASE SETTINGS (relevant to performance)
-- ============================================================

-- 8A: Key performance settings
SELECT name, setting, unit, short_desc
FROM pg_settings
WHERE name IN (
  'max_connections',
  'shared_buffers',
  'effective_cache_size',
  'work_mem',
  'maintenance_work_mem',
  'wal_buffers',
  'checkpoint_completion_target',
  'random_page_cost',
  'effective_io_concurrency',
  'max_worker_processes',
  'max_parallel_workers_per_gather',
  'max_parallel_workers',
  'autovacuum_max_workers',
  'autovacuum_naptime'
)
ORDER BY name;

-- ============================================================
-- SECTION 9: RESET STATISTICS (use before each benchmark run)
-- ============================================================

-- Reset query statistics (run before starting a timed test)
SELECT pg_stat_statements_reset();

-- Reset table statistics (use with caution in production)
-- SELECT pg_stat_reset();

-- ============================================================
-- SECTION 10: QUICK HEALTH CHECK
-- ============================================================

-- 10A: Database size
SELECT
  pg_size_pretty(pg_database_size(current_database())) AS database_size;

-- 10B: Connection utilization
SELECT
  count(*) AS current_connections,
  (SELECT setting::int FROM pg_settings WHERE name = 'max_connections') AS max_connections,
  ROUND(count(*)::numeric / (SELECT setting::int FROM pg_settings WHERE name = 'max_connections') * 100, 1) AS pct_used
FROM pg_stat_activity;

-- 10C: Transaction ID age (vacuum health)
SELECT
  datname,
  age(datfrozenxid) AS xid_age,
  ROUND(age(datfrozenxid)::numeric / 2000000000 * 100, 2) AS pct_towards_wraparound
FROM pg_database
WHERE datname = current_database();

-- 10D: Cache hit ratio
SELECT
  ROUND(blks_hit::numeric / (blks_hit + blks_read) * 100, 2) AS cache_hit_ratio
FROM pg_stat_database
WHERE datname = current_database();

-- 10E: Dead tuple ratio for largest tables
SELECT
  relname,
  n_live_tup AS live_tuples,
  n_dead_tup AS dead_tuples,
  CASE WHEN n_live_tup > 0
    THEN ROUND(n_dead_tup::numeric / n_live_tup * 100, 2)
    ELSE 0
  END AS dead_tuple_pct,
  last_vacuum,
  last_autovacuum
FROM pg_stat_user_tables
ORDER BY n_dead_tup DESC
LIMIT 15;

-- ============================================================
-- SECTION 11: RLS POLICY COST ANALYSIS
-- ============================================================
-- Run these one at a time. Skip any that error (table may not exist).

EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT) SELECT * FROM streams LIMIT 50;
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT) SELECT * FROM user_profiles LIMIT 50;
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT) SELECT * FROM troll_families LIMIT 50;
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT) SELECT * FROM coin_transactions LIMIT 50;
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT) SELECT * FROM user_notifications LIMIT 50;
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT) SELECT * FROM stream_seats LIMIT 50;

-- ============================================================
-- SECTION 12: FUNCTION COST ANALYSIS
-- ============================================================
-- Direct function-level cost tracking for busiest RPC functions.

-- 12A: Top functions by total execution time
SELECT
  funcname,
  calls,
  ROUND(total_time::numeric, 2) AS total_time_ms,
  ROUND(self_time::numeric, 2) AS self_time_ms,
  ROUND((total_time / NULLIF(calls, 0))::numeric, 2) AS avg_time_ms
FROM pg_stat_user_functions
ORDER BY total_time DESC
LIMIT 20;

-- 12B: Top functions by call count
SELECT
  funcname,
  calls,
  ROUND(total_time::numeric, 2) AS total_time_ms,
  ROUND(self_time::numeric, 2) AS self_time_ms
FROM pg_stat_user_functions
ORDER BY calls DESC
LIMIT 20;

-- 12C: League-specific functions
SELECT
  funcname,
  calls,
  ROUND(total_time::numeric, 2) AS total_time_ms,
  ROUND(self_time::numeric, 2) AS self_time_ms
FROM pg_stat_user_functions
WHERE funcname ILIKE '%league%'
ORDER BY total_time DESC;

-- 12D: Gift-specific functions
-- ⚠️ PRIORITY WATCH: process_gift_ledger_batch() — 56ms avg, grows with user activity
-- At 1,440 runs/day = ~90 seconds DB time daily. Monitor as platform scales.
SELECT
  funcname,
  calls,
  ROUND(total_time::numeric, 2) AS total_time_ms,
  ROUND(self_time::numeric, 2) AS self_time_ms
FROM pg_stat_user_functions
WHERE funcname ILIKE '%gift%'
ORDER BY total_time DESC;

-- 12E: Stream-specific functions
SELECT
  funcname,
  calls,
  ROUND(total_time::numeric, 2) AS total_time_ms,
  ROUND(self_time::numeric, 2) AS self_time_ms
FROM pg_stat_user_functions
WHERE funcname ILIKE '%stream%'
ORDER BY total_time DESC;

-- ============================================================
-- SECTION 13: QUICK-FIRST DIAGNOSTIC (run this before any optimization)
-- ============================================================
-- This single query exposes the highest-call-count queries immediately.
-- If BroadcastPage polling is active, it will appear at the top.

SELECT
  calls,
  ROUND(total_exec_time::numeric, 2) AS total_exec_time_ms,
  ROUND(mean_exec_time::numeric, 2) AS mean_exec_time_ms,
  LEFT(query, 200) AS query_preview
FROM pg_stat_statements
ORDER BY calls DESC
LIMIT 50;

-- ============================================================
-- SECTION 14: PRIORITY FUNCTION WATCHLIST
-- ============================================================
-- Run this section after every optimization pass to track
-- whether target functions improved.

-- 14A: Gift ledger batch (Priority Watch #1)
-- 56ms avg per call, 1,440 runs/day = ~90s DB time daily
-- Grows linearly with user gift activity
SELECT
  funcname,
  calls,
  ROUND(total_time::numeric, 2) AS total_time_ms,
  ROUND(self_time::numeric, 2) AS self_time_ms,
  ROUND((total_time / NULLIF(calls, 0))::numeric, 2) AS avg_time_ms
FROM pg_stat_user_functions
WHERE funcname ILIKE '%gift%ledger%'
ORDER BY total_time DESC;

-- 14B: League maintenance functions (Priority Watch #2)
-- ensure_league_system_ready: 288 runs/day
-- refresh_active_league_leaderboard: 720 runs/day
SELECT
  funcname,
  calls,
  ROUND(total_time::numeric, 2) AS total_time_ms,
  ROUND(self_time::numeric, 2) AS self_time_ms,
  ROUND((total_time / NULLIF(calls, 0))::numeric, 2) AS avg_time_ms
FROM pg_stat_user_functions
WHERE funcname ILIKE '%league%'
ORDER BY total_time DESC;

-- 14C: Stream lifecycle functions (Priority Watch #3)
SELECT
  funcname,
  calls,
  ROUND(total_time::numeric, 2) AS total_time_ms,
  ROUND(self_time::numeric, 2) AS self_time_ms,
  ROUND((total_time / NULLIF(calls, 0))::numeric, 2) AS avg_time_ms
FROM pg_stat_user_functions
WHERE funcname ILIKE '%stream%' OR funcname ILIKE '%pay_coins%' OR funcname ILIKE '%spend_coins%'
ORDER BY total_time DESC;

-- 14D: Summary — all functions ranked by total time consumed
SELECT
  funcname,
  calls,
  ROUND(total_time::numeric, 2) AS total_time_ms,
  ROUND((total_time / NULLIF(calls, 0))::numeric, 2) AS avg_time_ms,
  ROUND((total_time / NULLIF(SUM(total_time) OVER (), 0) * 100)::numeric, 1) AS pct_total
FROM pg_stat_user_functions
ORDER BY total_time DESC
LIMIT 30;
