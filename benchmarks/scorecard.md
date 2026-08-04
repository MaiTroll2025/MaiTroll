# Mai Troll Performance Scorecard

**Date:** 2026-06-14
**Tested By:** _______________

---

## Overall Scorecard

| # | Metric | Before | After | Change | Status |
|---|---|---|---|---|---|
| 1 | CPU % (idle) | | | | ⬜ |
| 2 | CPU % (1 stream) | | | | ⬜ |
| 3 | RAM % (idle) | | | | ⬜ |
| 4 | RAM % (1 stream) | | | | ⬜ |
| 5 | Connections (idle) | | | | ⬜ |
| 6 | Connections (1 stream) | | | | ⬜ |
| 7 | DB Requests/hr (idle) | | | | ⬜ |
| 8 | DB Requests/hr (1 stream) | | | | ⬜ |
| 9 | Realtime Requests/hr | | | | ⬜ |
| 10 | Active Channels (idle) | | | | ⬜ |
| 11 | Active Channels (1 stream) | | | | ⬜ |
| 12 | Stream Query Calls (10 min) | | | | ⬜ |
| 13 | League Errors/hr | | | | ⬜ |
| 14 | Browser Req/min (home) | | | | ⬜ |
| 15 | Browser Req/min (broadcast) | | | | ⬜ |
| 16 | Browser Req/min (viewer) | | | | ⬜ |

---

## 1. Supabase Metrics Baseline

### Database

| Metric | Idle | 1 Broadcaster | Game Share |
|---|---|---|---|
| CPU % | | | |
| RAM % | | | |
| Connections | | | |
| DB Requests/hr | | | |

### Realtime

| Metric | Idle | 1 Broadcaster | Game Share |
|---|---|---|---|
| Realtime Requests/hr | | | |
| Active Channels | | | |
| Active Connections | | | |

### Auth

| Metric | Idle | 1 Broadcaster | Game Share |
|---|---|---|---|
| Requests/hr | | | |

### Edge Functions

| Metric | Idle | 1 Broadcaster | Game Share |
|---|---|---|---|
| Invocations/hr | | | |
| Avg Execution Time (ms) | | | |

---

## 2. Active Connections

| Metric | Idle | 1 Broadcaster | Game Share |
|---|---|---|---|
| Total Connections | | | |
| Top Source #1 | | | |
| Top Source #2 | | | |
| Top Source #3 | | | |

---

## 3. Top Query Report

### Top 5 by Total Execution Time

| # | Calls | Total (ms) | Mean (ms) | Query Preview |
|---|---|---|---|---|
| 1 | | | | |
| 2 | | | | |
| 3 | | | | |
| 4 | | | | |
| 5 | | | | |

### Top 5 by Call Count

| # | Calls | Total (ms) | Mean (ms) | Query Preview |
|---|---|---|---|---|
| 1 | | | | |
| 2 | | | | |
| 3 | | | | |
| 4 | | | | |
| 5 | | | | |

### Key Query Tracking

| Query Pattern | Before Calls | Before Time | After Calls | After Time | Reduction |
|---|---|---|---|---|---|
| Stream SELECT (polling) | | | | | |
| League leaderboard | | | | | |
| Analytics aggregation | | | | | |
| Gift processing | | | | | |

---

## 4. Realtime Channel Count

| Metric | Baseline | During Stream | After Close | Leak? |
|---|---|---|---|---|
| `created` | | | | |
| `removed` | | | | |
| `active` | | | | |
| Channel names | | | | |

**Pass/Fail:** ⬜ PASS (returns to baseline) | ⬜ FAIL (leak detected)

---

## 5. BroadcastPage Polling Test

### Before (3s polling)

| Metric | Value |
|---|---|
| Duration | 10 min |
| Stream SELECT calls | |
| Stream SELECT total time (ms) | |
| Stream SELECT mean time (ms) | |

### After (polling removed)

| Metric | Value |
|---|---|
| Duration | 10 min |
| Stream SELECT calls | |
| Stream SELECT total time (ms) | |
| Stream SELECT mean time (ms) | |
| **Reduction %** | |

---

## 6. League Job Metrics

| Job | Schedule | Fires/Day | Avg Runtime (ms) | Errors/hr |
|---|---|---|---|---|
| `troll_city_ensure_league` | `*/5 * * * *` | 288 | | |
| `troll_city_refresh_leaderboard` | `*/2 * * * *` | 720 | | |

---

## 7. Browser Network Benchmark

### Home Page (10 min)

| Metric | Before | After | Change |
|---|---|---|---|
| Total Requests | | | |
| Transfer Size (MB) | | | |
| Requests/min | | | |

### Broadcast Page (10 min)

| Metric | Before | After | Change |
|---|---|---|---|
| Total Requests | | | |
| Transfer Size (MB) | | | |
| Requests/min | | | |

### Viewer Page (10 min)

| Metric | Before | After | Change |
|---|---|---|---|
| Total Requests | | | |
| Transfer Size (MB) | | | |
| Requests/min | | | |

---

## 8. Long Stream Benchmark (40 min, 0 viewers)

### Before

| Metric | 0 min | 10 min | 20 min | 30 min | 40 min |
|---|---|---|---|---|---|
| CPU % | | | | | |
| RAM % | | | | | |
| Connections | | | | | |
| DB Requests/hr | | | | | |
| Realtime Channels | | | | | |

### After

| Metric | 0 min | 10 min | 20 min | 30 min | 40 min |
|---|---|---|---|---|---|
| CPU % | | | | | |
| RAM % | | | | | |
| Connections | | | | | |
| DB Requests/hr | | | | | |
| Realtime Channels | | | | | |

---

## 9. Game Share Benchmark (30 min)

| Metric | Value |
|---|---|
| CPU % (avg) | |
| RAM % (avg) | |
| Connections (peak) | |
| DB Requests/hr | |
| Realtime Requests/hr | |
| Active Channels (peak) | |

---

## Priority Metrics Summary

| Priority | Metric | Before | After | Target |
|---|---|---|---|---|
| 🔴 #1 | Active Realtime Channels | | | ≤ baseline + stream channels only |
| 🔴 #1 | Stream Query Calls (10 min) | | | ↓ 80-95% |
| 🟡 #2 | League Executions/Day | 1,008 | | Reduce or optimize |
| 🟡 #2 | DB Requests/hr (1 stream) | | | ↓ significant |
| 🟢 #3 | Browser Req/min (broadcast) | | | ↓ 50%+ |
| 🟢 #3 | Edge Function Invocations | | | Stable or ↓ |

---

## Notes

```
(Record any observations, anomalies, or additional findings here)


```
