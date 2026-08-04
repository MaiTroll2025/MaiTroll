# Mai Troll Performance Benchmark

**Date:** 2026-06-14
**Version:** 3.0
**Purpose:** Establish baseline performance metrics before optimization work.

---

## Benchmark History

| Version | Date | Notes |
|---|---|---|
| 1.0 | 2026-06-14 | Initial benchmark suite |
| 2.0 | 2026-06-14 | Added KPIs, LiveKit metrics, cost tracking, grading |
| 3.0 | 2026-06-14 | Removed generic CPU/RAM thresholds; added trend-based tracking, cost efficiency grade, cost/user KPI |

---

## Executive Summary

**Optimization Project:** _____________________

**Start Date:** _____________________

**Completion Date:** _____________________

**Primary Goal:**
- [ ] Reduce polling
- [ ] Reduce DB load
- [ ] Reduce Realtime channels
- [ ] Reduce connection count
- [ ] Improve stream scalability
- [ ] Improve Game Share scalability

**Overall Result:**
- [ ] Exceeded Expectations
- [ ] Met Expectations
- [ ] Partial Improvement
- [ ] No Improvement

---

### Top 7 Success Criteria (KPIs)

These are the metrics that determine whether the optimization project succeeded:

| # | KPI | Target |
|---|---|---|
| 1 | Stream Query Calls | ↓ 80%+ |
| 2 | Active Realtime Channels | Return to baseline after stream close |
| 3 | League Errors | 0 |
| 4 | Browser Requests/Minute | ↓ 50%+ |
| 5 | Channel Leaks | 0 |
| 6 | 40-Min Stream Resource Usage | ≤ baseline |
| 7 | Game Share Stability | Stable for 30 minutes |

---

## Quick Reference

### Running Benchmarks

```bash
# 1. Supabase SQL metrics (run in Supabase SQL Editor)
#    → See: benchmarks/supabase-metrics.sql

# 2. Browser-side metrics (run in DevTools Console)
#    → See: src/hooks/usePerformanceBenchmark.ts

# 3. Full automated benchmark
npm run benchmark
```

### Key Files

| File | Purpose |
|---|---|
| `benchmarks/supabase-metrics.sql` | All SQL queries for Supabase metrics |
| `benchmarks/scorecard.md` | Scorecard template with before/after columns |
| `src/hooks/usePerformanceBenchmark.ts` | Browser-side benchmark hook |
| `benchmarks/run-benchmark.mjs` | Automated benchmark runner |

---

## 1. Supabase Metrics Baseline

### When to Measure

| Scenario | Description |
|---|---|
| **Idle** | No active streams, normal user browsing |
| **1 Broadcaster** | One live stream, 0+ viewers |
| **Game Share** | One broadcaster + Game Share session |

### 1A. Database Metrics

Record these from Supabase Dashboard → Database:

| Metric | Idle | 1 Broadcaster | Game Share |
|---|---|---|---|
| CPU % | | | |
| RAM % | | | |
| Active Connections | | | |
| Database Requests/hr | | | |

### 1B. Realtime Metrics

Record from Supabase Dashboard → Realtime:

| Metric | Idle | 1 Broadcaster | Game Share |
|---|---|---|---|
| Realtime Requests/hr | | | |
| Active Channels | | | |
| Active Connections | | | |

### 1C. Auth Metrics

| Metric | Idle | 1 Broadcaster | Game Share |
|---|---|---|---|
| Requests/hr | | | |

### 1D. Edge Functions

| Metric | Idle | 1 Broadcaster | Game Share |
|---|---|---|---|
| Invocations/hr | | | |
| Avg Execution Time (ms) | | | |

---

## 2. Active Connections

Run in Supabase SQL Editor:

```sql
-- Total active connections
SELECT count(*) AS active_connections
FROM pg_stat_activity;

-- Connections by application
SELECT
  application_name,
  count(*)
FROM pg_stat_activity
GROUP BY application_name
ORDER BY count(*) DESC;
```

| Metric | Idle | 1 Broadcaster | Game Share |
|---|---|---|---|
| Total Connections | | | |
| Top Source #1 | | | |
| Top Source #2 | | | |
| Top Source #3 | | | |

---

## 3. Top Query Report

```sql
SELECT
  calls,
  total_exec_time,
  mean_exec_time,
  LEFT(query, 150) AS query_preview
FROM pg_stat_statements
ORDER BY total_exec_time DESC
LIMIT 20;
```

### Top 5 Queries by Total Execution Time

| # | Calls | Total Time (ms) | Mean Time (ms) | Query Preview |
|---|---|---|---|---|
| 1 | | | | |
| 2 | | | | |
| 3 | | | | |
| 4 | | | | |
| 5 | | | | |

### Key Queries to Watch

| Query Pattern | Current Calls | Current Total Time | After Optimization |
|---|---|---|---|
| Stream polling (`SELECT ... FROM streams`) | | | ↓ 80-95% |
| `process_gift_ledger_batch()` ⚠️ Priority Watch #1 | 56ms avg | | Monitor — grows with user activity |
| League leaderboard refresh | | | ↓ |
| Analytics aggregation | | | ↓ |
| Realtime WAL parsing (publication overhead) | 247 calls | 3,970ms | ↓ by reducing published tables |

---

## 4. Realtime Channel Count

### How to Measure

Open browser DevTools Console:

```js
// Record baseline (before opening stream)
const baseline = { ...window.__Mai Troll_SUPABASE_REALTIME_DEBUG__ };
console.log('Baseline:', baseline);

// Open a stream, wait 10s, then:
console.log('During stream:', window.__Mai Troll_SUPABASE_REALTIME_DEBUG__);

// Close stream, wait 10s, then:
console.log('After close:', window.__Mai Troll_SUPABASE_REALTIME_DEBUG__);
```

### Results

| Metric | Baseline | During Stream | After Close | Leak? |
|---|---|---|---|---|
| `created` | | | | |
| `removed` | | | | |
| `active` | | | | |
| `activeChannels` count | | | | |

**Pass Criteria:** `active` returns to baseline after stream close. If not → **channel leak detected**.

---

## 5. BroadcastPage Polling Test

### Test Protocol

1. Start 1 broadcaster, keep live for 10 minutes
2. Record `pg_stat_statements` before and after
3. Focus on `streams` table SELECT queries

### Before Optimization (3s polling active)

| Metric | Value |
|---|---|
| Test Duration | 10 min |
| Stream SELECT calls | |
| Stream SELECT total time (ms) | |
| Stream SELECT mean time (ms) | |
| Other top queries | |

### After Optimization (3s polling removed)

| Metric | Value |
|---|---|
| Test Duration | 10 min |
| Stream SELECT calls | |
| Stream SELECT total time (ms) | |
| Stream SELECT mean time (ms) | |
| Reduction % | |

**Expected:** 80-95% reduction in stream query calls.

---

## 6. League Job Metrics

### Current Cron Jobs

```sql
SELECT jobname, schedule
FROM cron.job;
```

| Job | Schedule | Fires/Day |
|---|---|---|
| `troll_city_ensure_league` | `*/5 * * * *` | 288 |
| `troll_city_refresh_leaderboard` | `*/2 * * * *` | 720 |

### Performance

| Metric | Before | After |
|---|---|---|
| `ensure_league_system_ready` avg runtime (ms) | | |
| `refresh_active_league_leaderboard` avg runtime (ms) | | |
| JSON errors/hour | | 0 |
| Total league executions/day | 1,008 | |

---

## 7. Browser Network Benchmark

### Protocol

1. Open DevTools → Network tab
2. Clear all records
3. Browse each page for exactly 10 minutes
4. Record totals

### Home Page (10 min)

| Metric | Before | After |
|---|---|---|
| Total Requests | | |
| Transfer Size (MB) | | |
| Requests/minute | | |
| Largest Request | | |

### Broadcast Page (10 min, 1 stream live)

| Metric | Before | After |
|---|---|---|
| Total Requests | | |
| Transfer Size (MB) | | |
| Requests/minute | | |
| Largest Request | | |

### Viewer Page (10 min, watching stream)

| Metric | Before | After |
|---|---|---|
| Total Requests | | |
| Transfer Size (MB) | | |
| Requests/minute | | |
| Largest Request | | |

---

## 8. Long Stream Benchmark

### Protocol

1. Start 1 broadcaster, 0 viewers
2. Let run for 40 minutes
3. Record metrics every 10 minutes

### Before Optimization

| Metric | 0 min | 10 min | 20 min | 30 min | 40 min |
|---|---|---|---|---|---|
| CPU % | | | | | |
| RAM % | | | | | |
| Connections | | | | | |
| DB Requests/hr | | | | | |
| Realtime Channels | | | | | |

### After Optimization

| Metric | 0 min | 10 min | 20 min | 30 min | 40 min |
|---|---|---|---|---|---|
| CPU % | | | | | |
| RAM % | | | | | |
| Connections | | | | | |
| DB Requests/hr | | | | | |
| Realtime Channels | | | | | |

---

## 9. Game Share Benchmark

### Protocol

1. Start 1 broadcaster + 1 Game Share session
2. Run for 30 minutes
3. Record all metrics

| Metric | Value |
|---|---|
| CPU % (avg) | |
| RAM % (avg) | |
| Connections (peak) | |
| DB Requests/hr | |
| Realtime Requests/hr | |
| Active Channels (peak) | |
| Top Query Calls | |

---

## 10. Scorecard

### Overall Performance Scorecard

| Metric | Before | After | Change |
|---|---|---|---|
| **CPU %** (idle) | | | |
| **CPU %** (1 stream) | | | |
| **RAM %** (idle) | | | |
| **RAM %** (1 stream) | | | |
| **Connections** (idle) | | | |
| **Connections** (1 stream) | | | |
| **DB Requests/hr** (idle) | | | |
| **DB Requests/hr** (1 stream) | | | |
| **Realtime Requests/hr** | | | |
| **Active Channels** (idle) | | | |
| **Active Channels** (1 stream) | | | |
| **Top Query Calls** (stream poll) | | | |
| **League Errors/hr** | | | |
| **Stream Query Calls** (10 min) | | | |
| **Browser Requests/min** (home) | | | |
| **Browser Requests/min** (broadcast) | | | |
| **Browser Requests/min** (viewer) | | | |

### Priority Metrics (Biggest Impact)

| Priority | Metric | Why |
|---|---|---|
| 🔴 #1 | Active Realtime Channels | Directly impacts Supabase costs and connection limits |
| 🔴 #1 | Stream Query Calls | 1,200 req/hr per broadcast tab from 3s polling |
| 🟡 #2 | League Job Executions | 1,008/day regardless of stream state |
| 🟡 #2 | DB Requests/hr | Overall database load |
| 🟢 #3 | Browser Network Requests | User experience and bandwidth |
| 🟢 #3 | Edge Function Invocations | Serverless compute costs |

---

---

## 11. Pass / Fail Targets

Each metric is tracked as **Before → After → Change %**. Letter grades are assigned based on trend direction and magnitude of improvement, not absolute thresholds (Supabase compute sizes vary too much for generic CPU/RAM cutoffs).

| Metric | F (Critical) | D (Risk) | C (Needs Work) | B (Good) | A (Excellent) |
|---|---|---|---|---|---|
| Active Connections | > 80% limit | 60–80% | 40–60% | 20–40% | < 20% |
| DB Requests/hr (1 stream) | ↑ after | No change | ↓ 10–25% | ↓ 25–50% | ↓ 50%+ |
| Realtime Channels (idle) | > 50 | 30–50 | 15–30 | 5–15 | < 5 |
| Stream Query Calls (10 min) | ↑ after | No change | ↓ 10–50% | ↓ 50–80% | ↓ 80%+ |
| Channel Leaks | > 5 | 3–5 | 1–2 | 0 | 0 |
| League Errors/hr | > 10 | 5–10 | 1–5 | 0 | 0 |
| Browser Req/min (broadcast) | ↑ after | No change | ↓ 10–25% | ↓ 25–50% | ↓ 50%+ |
| Memory Growth (MB/min) | > 20 | 10–20 | 5–10 | 1–5 | < 1 |
| Cost Per Active User | ↑ after | No change | ↓ 10–25% | ↓ 25–50% | ↓ 50%+ |

### Grade Scale

| Grade | Meaning |
|---|---|
| **A** | Excellent — ready for 10k+ users |
| **B** | Good — minor improvements needed |
| **C** | Needs Work — optimization recommended |
| **D** | Scaling Risk — will break at scale |
| **F** | Critical — must fix before growth |

---

## 12. Infrastructure Cost Metrics

At 10k users the question becomes: **how much does each user cost?**

| Metric | Before | After |
|---|---|---|
| Supabase DB Cost/month | | |
| Realtime Cost/month | | |
| Storage Cost/month | | |
| Streaming (LiveKit) Cost/month | | |
| Edge Functions Cost/month | | |
| **Total Monthly Cost** | | |
| **Cost Per Active User** | | |

### Cost Breakdown by System

| System | Monthly Cost | % of Total | Cost/User |
|---|---|---|---|
| Supabase Database | | | |
| Supabase Realtime | | | |
| Supabase Storage | | | |
| LiveKit Streaming | | | |
| Edge Functions | | | |
| CDN / Bandwidth | | | |

---

## 13. Game Share Stress Test

### Scenario

1 Broadcaster + 1 Game Share session, 30 minutes

### LiveKit Metrics

| Metric | Value |
|---|---|
| Rooms Active | |
| Participants (peak) | |
| Published Tracks | |
| Subscribed Tracks | |
| Screen Share Tracks | |
| Average Bitrate (kbps) | |
| Peak Bitrate (kbps) | |
| Packet Loss % | |
| Viewer Latency (ms) | |

### System Metrics

| Metric | Value |
|---|---|
| CPU % (avg / peak) | |
| RAM % (avg / peak) | |
| Connections (peak) | |
| DB Requests/hr | |
| Realtime Requests/hr | |
| Active Channels (peak) | |
| Top Query Calls | |
| Memory Growth (MB/min) | |

### Pass / Fail

| Criteria | Target | Result |
|---|---|---|
| Stream stays live 30 min | No drops | ⬜ Pass / ⬜ Fail |
| Game Share stays connected | No disconnects | ⬜ Pass / ⬜ Fail |
| CPU < 60% throughout | Sustained | ⬜ Pass / ⬜ Fail |
| No channel leaks | 0 leaked | ⬜ Pass / ⬜ Fail |
| Viewer latency < 500ms | Consistent | ⬜ Pass / ⬜ Fail |

---

## Final Grade

| Category | Grade | Notes |
|---|---|---|
| Database | | |
| Realtime | | |
| Streaming (LiveKit) | | |
| Browser Performance | | |
| Memory Usage | | |
| Background Jobs | | |
| Cost Efficiency | | |
| Overall Scalability | | |

**Grading Scale:**

| Grade | Meaning |
|---|---|
| **A** | Excellent — ready for 10k+ users |
| **B** | Good — minor improvements needed |
| **C** | Needs Improvement — optimization recommended |
| **D** | Scaling Risk — will break at scale |
| **F** | Critical — must fix before growth |

---

## Most Important Success Criteria

For Mai Troll specifically, these eight KPIs determine whether the optimization project succeeded:

| # | KPI | Before | After | Target | Status |
|---|---|---|---|---|---|
| 1 | Stream Query Calls (10 min) | | | ↓ 80%+ | ⬜ |
| 2 | Browser Requests/Minute | | | ↓ 50%+ | ⬜ |
| 3 | Channel Leaks | | | 0 | ⬜ |
| 4 | Realtime Channels Return to Baseline | | | Yes | ⬜ |
| 5 | Connection Counts | | | ↓ | ⬜ |
| 6 | League JSON Errors | | | 0 | ⬜ |
| 7 | 40-Min Stream Resources | | | ≤ baseline | ⬜ |
| 8 | 30-Min Game Share | | | Stable | ⬜ |
| 9 | Cost Per Active User | | | ↓ | ⬜ |
| 10 | No Regressions | | | Pass | ⬜ |

Scalable ≠ Profitable. You need both.

**Benchmark results determine success. No partial credit.**

---

## Implementation Roadmap

See `SCALABILITY_REFACTOR_V3.md` for full details.

| Phase | Task | Effort | Impact |
|---|---|---|---|
| 1 | Eliminate BroadcastPage 3s polling | Medium | **Highest** — 1,200 req/hr |
| 2 | Build RealtimeManager | High | **High** — prevents all leaks |
| 3 | Channel cleanup enforcement | Medium | **High** — eliminates leak risk |
| 4 | Add TanStack Query caching | High | **High** — cuts redundant fetches |
| 5 | Eliminate remaining polling | Medium | **Medium** — compounds |
| 6 | League reliability fixes | Low | **Medium** — prevents errors |
| 7 | Gift monitoring | Low | **Low** — future-proofing |
| 8 | LiveKit audit | Medium | **Medium** — Game Share readiness |

**Start with Phase 1.** The BroadcastPage 3s poll is the single highest-impact change.

---

## Notes

- Reset `pg_stat_statements` before each test: `SELECT pg_stat_statements_reset();`
- Use `window.__Mai Troll_SUPABASE_REALTIME_DEBUG__` for all browser channel tests
- Always wait 30s after state changes before recording (let things stabilize)
- Run each test 3 times and average for accuracy
- For LiveKit metrics, use the LiveKit Server Dashboard or `lk cli` tools
