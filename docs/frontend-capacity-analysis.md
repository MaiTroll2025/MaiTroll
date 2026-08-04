# Mai Troll Frontend Capacity Analysis

**Date:** 2026-06-08  
**Current Users:** 41 registered  
**Analysis Scope:** Frontend-only bottlenecks across all pages

---

## Build Profile

| Metric | Value |
|---|---|
| Total JS bundles | 142 files, 10.14 MB total |
| Total CSS | 3 files, 771.6 KB |
| Index HTML | 11.3 KB |
| Main entry chunk (`index-BsIGCO7E.js`) | 2,595 KB (largest single chunk) |
| Vendor media chunk | 967 KB |
| Vendor React chunk | 580 KB |
| UI vendor chunk | 550 KB |
| Broadcast components chunk | 1,957 KB |
| Admin core chunk | 1186 KB |
| jsPDF (PDF generation) | 339 KB |
| html2canvas | 194 KB |
| Supabase client | 168 KB |

### Key Dependency Weights
- **livekit-client** — WebRTC streaming (heavy)
- **recharts** — Charts/graphs (loaded on dashboard pages)
- **jspdf + jspdf-autotable** — PDF generation
- **html2canvas** — Screenshot/export
- **leaflet + react-leaflet** — Maps
- **socket.io-client** — Real-time socket connections
- **simple-peer** — WebRTC peer connections
- **hls.js** — HLS video streaming
- **howler** — Audio playback
- **react-virtuoso** — Virtualized lists (good for performance)
- **lottie-react** — Animations
- **remotion** — Video composition (very heavy, likely dev-only)

---

## Architecture Assessment

### Strengths
- **React.lazy + Suspense** — 460 page files are code-split into ~142 JS chunks. Pages are loaded on demand, not all upfront.
- **react-virtuoso** — Lists are virtualized, preventing DOM overflow on large datasets.
- **Minimal localStorage usage** — Only used for app version cache, nav highlight state, and voice notification preference. No heavy client-side state persistence.

### Concerns

#### 1. Main Entry Chunk is Too Large (2,600 KB)
The main `index` chunk is **2.6 MB** unzipped. Every user downloads this on first load. This includes React, routing, core UI, Supabase client, and all shared components. On a slow 3G connection (~1 Mbps), this takes ~20 seconds to download.

**Impact:** First-time visitors experience slow initial load. Returning users benefit from browser caching.

**Recommendation:** Audit what's in the main chunk and push more into lazy-loaded page chunks. Target < 1 MB for the entry chunk.

#### 2. Broadcast Components Chunk (1,957 KB)
The broadcast system (LiveKit + WebRTC + Agora) adds ~2 MB. This is only needed for streaming/gaming pages but may be loaded eagerly depending on route configuration.

#### 3. Supabase Realtime Subscriptions
Supabase Realtime uses WebSocket connections. Each active subscription maintains a persistent connection. With many pages open (e.g., dashboard + chat + notifications), a single user can have 5-10 concurrent WebSocket connections.

**Per-user estimate:** 5-15 WebSocket connections depending on active pages.

#### 4. No Service Worker in Production
The built `service-worker.mjs` exists (10.38 KB gzip: 3.51 KB) but appears minimal. Without aggressive asset caching, every navigation re-downloads shared chunks.

#### 5. Heavy Pages by Estimated Load Cost

| Page Category | Estimated JS per visit | Notes |
|---|---|---|
| Home / Feed | ~3 MB | Main + Home chunk + vendor |
| Broadcast / Gaming | ~5 MB | + broadcast components + media |
| Admin Dashboard | ~4 MB | + admin core + recharts |
| Agency HR Dashboard | ~3.5 MB | + agency chunk |
| Troll Court | ~3 MB | Moderate |
| Chat / Tromail | ~3.5 MB | Socket.io + UI |
| Maps (City Registry) | ~3.5 MB | Leaflet loaded |

---

## Concurrent User Estimates

### Assumptions
- Average modern browser tab uses **50-150 MB RAM** for this type of SPA
- Average user visits **3-5 pages per session**
- Average session duration: **10-20 minutes**
- Users are **not** all on the heaviest pages simultaneously

### Conservative Estimate: **500-1,000 concurrent users**

**Reasoning:**
- 460 page files, but only ~30-40 are commonly used (Home, Feed, Broadcast, Chat, Dashboard, etc.)
- Code splitting means most users only load 3-5 chunks beyond the main entry
- The main bottleneck is the 2.6 MB entry chunk — once cached, subsequent navigations are fast
- React 18 with concurrent rendering handles moderate DOM well
- Virtuoso virtualization prevents list-based memory leaks
- No heavy client-side state management (no Redux store persisting thousands of records)

### Moderate Estimate: **1,000-2,500 concurrent users**

This is achievable if:
- The main chunk is reduced to < 1.5 MB
- Service worker caches shared assets aggressively
- Users spread across different page categories (not all on Broadcast)
- Supabase backend handles the real-time load (not a frontend concern per se, but WebSocket overhead adds up)

### Aggressive Estimate: **5,000+ concurrent users**

This requires:
- Entry chunk < 1 MB
- Proper CDN caching with far-future expires headers
- Service worker precaching of critical chunks
- Aggressive code splitting (move recharts, leaflet, jspdf to isolated chunks)
- Memory profiling and leak cleanup (event listeners, subscriptions not cleaned up on unmount)
- Consider removing `remotion` from production bundle (video composition library is very heavy)

---

## Recommended Actions (Priority Order)

### Critical (Do Now)
1. **Reduce main entry chunk** — Audit `index-BsIGCO7E.js` with `rollup-plugin-visualizer`. Push shared components into lazy-loaded chunks. Target: < 1.5 MB.
2. **Verify route-based code splitting** — Ensure heavy pages (broadcast, admin, gaming) don't pull their chunks into the main bundle.
3. **Memory leak audit** — Check that Supabase subscriptions, WebSocket listeners, and event handlers are properly cleaned up in `useEffect` return functions across all 460 pages.

### Important (Do Soon)
4. **Implement service worker precaching** — Use Workbox to precache the main chunk, vendor-react, and vendor-ui chunks.
5. **Add performance monitoring** — Track LCP, FID, and CLS in production to get real user metrics.
6. **Lazy-load heavy libraries** — Move jspdf, html2canvas, leaflet, and recharts to be imported only when needed, not as top-level imports.

### Nice to Have
7. **Consider removing remotion** from the production build (it's ~400+ KB of the media chunk).
8. **Implement connection pooling** for Supabase realtime to reduce WebSocket overhead.
9. **Add loading skeletons** for code-split chunks to improve perceived performance.

---

## Bottleneck Summary

| Factor | Current State | Risk at Scale |
|---|---|---|
| Entry chunk size | 2.6 MB (high) | High — affects every user on first load |
| Total JS transfer | ~10 MB across 142 files | Medium — mitigated by code splitting |
| WebSocket connections | 5-15 per active user | Medium — browser limit is ~6 per origin, Supabase pools internally |
| Browser memory per tab | ~50-155 MB estimated | Low-Medium — depends on page complexity |
| DOM node count | Moderate (virtuoso helps) | Low |
| Client-side caching | Minimal (no SW precache) | Medium — repeat visits re-download chunks |
| **Overall safe capacity** | **500-1,000 concurrent** | **Realistic without changes** |
| **With optimizations** | **2,000-5,000 concurrent** | **Achievable with chunk reduction + SW** |
