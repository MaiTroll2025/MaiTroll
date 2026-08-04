/**
 * usePerformanceBenchmark
 *
 * Browser-side performance benchmarking hook for Mai Troll.
 *
 * Tracks:
 * - Network request count and transfer size
 * - Realtime channel lifecycle with leak detection
 * - Polling interval frequency (monkey-patched setInterval)
 * - Memory usage trends + growth rate
 * - Component render counts
 * - LiveKit media metrics (rooms, tracks, bitrate)
 *
 * Usage:
 *   // In a page component or App.tsx for global tracking:
 *   import { usePerformanceBenchmark } from '@/hooks/usePerformanceBenchmark';
 *   usePerformanceBenchmark({ label: 'HomePage', trackNetwork: true });
 *
 *   // In DevTools Console:
 *   window.__MaiTroll_BENCHMARK__.snapshot();
 *   window.__MaiTroll_BENCHMARK__.report();
 *   window.__MaiTroll_BENCHMARK__.reset();
 *   window.__MaiTroll_BENCHMARK__.getIntervalReport();
 *   window.__MaiTroll_BENCHMARK__.getRenderCounts();
 *   window.__MaiTroll_BENCHMARK__.getLiveKitMetrics();
 */

import { useEffect, useRef, useCallback } from 'react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface BenchmarkConfig {
  label: string;
  trackNetwork?: boolean;
  trackRealtime?: boolean;
  trackMemory?: boolean;
  trackIntervals?: boolean;
  trackRenders?: boolean;
  trackLiveKit?: boolean;
  snapshotInterval?: number;
  verbose?: boolean;
}

interface NetworkSnapshot {
  requestCount: number;
  transferSize: number;
  encodedBodySize: number;
  decodedBodySize: number;
  cachedCount: number;
  avgDuration: number;
  maxDuration: number;
}

interface RealtimeSnapshot {
  created: number;
  removed: number;
  active: number;
  leaked: number;
  leakDetected: boolean;
  activeChannels: string[];
}

interface MemorySnapshot {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
  usedMB: number;
  growthPerMinute: number | null;
}

interface LiveKitSnapshot {
  roomCount: number;
  participantCount: number;
  publishedTracks: number;
  subscribedTracks: number;
  screenShareTracks: number;
  averageBitrate: number | null;
}

interface IntervalInfo {
  id: number;
  delay: number;
  source: string | null;
  createdAt: number;
}

interface BenchmarkSnapshot {
  timestamp: number;
  elapsed: number;
  label: string;
  network: NetworkSnapshot | null;
  realtime: RealtimeSnapshot | null;
  memory: MemorySnapshot | null;
  liveKit: LiveKitSnapshot | null;
  renderCount: number;
  activeIntervals: number;
}

interface IntervalReport {
  totalActive: number;
  byFrequency: Record<string, number>;
  intervals: IntervalInfo[];
}

interface RenderReport {
  totalRenders: number;
  rendersPerMinute: number;
  byComponent: Record<string, number>;
}

interface BenchmarkGrade {
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  label: string;
}

interface BenchmarkAPI {
  snapshot: () => BenchmarkSnapshot;
  report: () => {
    snapshots: BenchmarkSnapshot[];
    summary: {
      totalRequests: number;
      totalTransferMB: number;
      avgRequestsPerMinute: number;
      peakMemoryMB: number;
      memoryGrowthPerMinute: number | null;
      peakRealtimeChannels: number;
      leakedChannels: number;
      channelLeakDetected: boolean;
      totalRenders: number;
      rendersPerMinute: number;
      activeIntervals: number;
      duration: number;
      grades: Record<string, BenchmarkGrade>;
    };
  };
  reset: () => void;
  startTimer: (name: string) => void;
  endTimer: (name: string) => number | null;
  getIntervalReport: () => IntervalReport;
  getRenderCounts: () => RenderReport;
  getLiveKitMetrics: () => LiveKitSnapshot | null;
  trackRender: (componentName: string) => void;
}

// ─── Global State ────────────────────────────────────────────────────────────

declare global {
  interface Window {
    __MaiTroll_BENCHMARK__?: BenchmarkAPI;
    __MaiTroll_BENCHMARKS__?: Map<string, BenchmarkAPI>;
    __MaiTroll_INTERVAL_REGISTRY__?: Map<number, IntervalInfo>;
    __MaiTroll_RENDER_COUNTS__?: Map<string, number>;
    __MaiTroll_SETINTERVAL_PATCHED__?: boolean;
  }
}

const globalBenchmarks = new Map<string, BenchmarkAPI>();

// ─── Grading Helpers ─────────────────────────────────────────────────────────

function gradeFromTrend(before: number, after: number, lowerIsBetter = true): BenchmarkGrade {
  if (before === 0) return { grade: 'B', label: 'No baseline' };
  const change = ((after - before) / before) * 100;
  const improved = lowerIsBetter ? change < 0 : change > 0;
  const mag = Math.abs(change);
  if (!improved && mag > 5) return { grade: 'F', label: `Worsened ${mag.toFixed(0)}%` };
  if (!improved) return { grade: 'C', label: 'No change' };
  if (mag >= 50) return { grade: 'A', label: `Improved ${mag.toFixed(0)}%` };
  if (mag >= 25) return { grade: 'B', label: `Improved ${mag.toFixed(0)}%` };
  if (mag >= 10) return { grade: 'C', label: `Improved ${mag.toFixed(0)}%` };
  return { grade: 'D', label: `Marginal ${mag.toFixed(0)}%` };
}

function gradeFromAbsolute(value: number, thresholds: { A: number; B: number; C: number; D: number }, lowerIsBetter = true): BenchmarkGrade {
  const check = (v: number, t: number) => lowerIsBetter ? v <= t : v >= t;
  if (check(value, thresholds.A)) return { grade: 'A', label: 'Excellent' };
  if (check(value, thresholds.B)) return { grade: 'B', label: 'Good' };
  if (check(value, thresholds.C)) return { grade: 'C', label: 'Needs Work' };
  if (check(value, thresholds.D)) return { grade: 'D', label: 'Scaling Risk' };
  return { grade: 'F', label: 'Critical' };
}

// ─── setInterval Monkey-Patch ────────────────────────────────────────────────

function patchSetInterval(): void {
  if (typeof window === 'undefined' || window.__MaiTroll_SETINTERVAL_PATCHED__) return;

  const originalSetInterval = window.setInterval;
  const registry = new Map<number, IntervalInfo>();
  window.__MaiTroll_INTERVAL_REGISTRY__ = registry;
  window.__MaiTroll_SETINTERVAL_PATCHED__ = true;

  window.setInterval = function (callback: TimerHandler, delay?: number, ...args: any[]): number {
    const id = originalSetInterval.call(this, callback, delay, ...args);
    const stack = new Error().stack || '';
    const source = stack
      .split('\n')
      .slice(1)
      .map(l => l.match(/at\s+(.+?)\s+\(?(http[^)]+)/)?.[1] || l.match(/at\s+(http[^)]+)/)?.[1] || null)
      .find(s => s !== null) || null;
    registry.set(id, { id, delay: delay || 0, source, createdAt: Date.now() });
    return id;
  };

  const originalClearInterval = window.clearInterval;
  window.clearInterval = function (id?: number): void {
    if (id !== undefined) registry.delete(id);
    return originalClearInterval.call(this, id);
  };
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function usePerformanceBenchmark(config: BenchmarkConfig): BenchmarkAPI {
  const {
    label,
    trackNetwork = true,
    trackRealtime = true,
    trackMemory = true,
    trackIntervals = true,
    trackRenders = true,
    trackLiveKit = true,
    snapshotInterval = 10000,
    verbose = false,
  } = config;

  const snapshotsRef = useRef<BenchmarkSnapshot[]>([]);
  const startTimeRef = useRef(Date.now());
  const timersRef = useRef<Map<string, number>>(new Map());
  const renderCountRef = useRef(0);
  const componentRenderCountsRef = useRef<Map<string, number>>(new Map());
  const firstMemoryRef = useRef<number | null>(null);

  const networkRef = useRef({
    requestCount: 0, transferSize: 0, encodedBodySize: 0,
    decodedBodySize: 0, cachedCount: 0, totalDuration: 0, maxDuration: 0,
  });

  // Network Observer
  useEffect(() => {
    if (!trackNetwork || typeof PerformanceObserver === 'undefined') return;
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as PerformanceResourceTiming[]) {
        networkRef.current.requestCount++;
        networkRef.current.transferSize += entry.transferSize || 0;
        networkRef.current.encodedBodySize += entry.encodedBodySize || 0;
        networkRef.current.decodedBodySize += entry.decodedBodySize || 0;
        if (entry.transferSize === 0 && entry.decodedBodySize > 0) networkRef.current.cachedCount++;
        if (entry.duration > 0) {
          networkRef.current.totalDuration += entry.duration;
          networkRef.current.maxDuration = Math.max(networkRef.current.maxDuration, entry.duration);
        }
      }
    });
    observer.observe({ type: 'resource', buffered: true });
    return () => observer.disconnect();
  }, [trackNetwork]);

  // setInterval Patching
  useEffect(() => { if (trackIntervals) patchSetInterval(); }, [trackIntervals]);

  // Render Tracking
  useEffect(() => {
    if (!trackRenders) return;
    renderCountRef.current++;
    const current = componentRenderCountsRef.current.get(label) || 0;
    componentRenderCountsRef.current.set(label, current + 1);
    if (typeof window !== 'undefined') {
      if (!window.__MaiTroll_RENDER_COUNTS__) window.__MaiTroll_RENDER_COUNTS__ = new Map();
      window.__MaiTroll_RENDER_COUNTS__.set(label, current + 1);
    }
  });

  // LiveKit Metrics
  const getLiveKitMetrics = useCallback((): LiveKitSnapshot | null => {
    if (!trackLiveKit || typeof window === 'undefined') return null;
    const lk = (window as any).__MaiTroll_LIVEKIT__;
    if (!lk) return { roomCount: 0, participantCount: 0, publishedTracks: 0, subscribedTracks: 0, screenShareTracks: 0, averageBitrate: null };
    const rooms: any[] = lk.rooms || (lk.room ? [lk.room] : []);
    let participantCount = 0, publishedTracks = 0, subscribedTracks = 0, screenShareTracks = 0, totalBitrate = 0, bitrateSamples = 0;
    for (const room of rooms) {
      const participants = room.participants || [];
      participantCount += participants.length + 1;
      if (room.localParticipant) {
        const pubs = room.localParticipant.trackPublications || [];
        publishedTracks += pubs.length;
        for (const pub of pubs) { if (pub.track?.kind === 'video' && pub.track?.source === 'screen') screenShareTracks++; }
      }
      for (const p of participants) {
        const subs = p.trackSubscriptions || [];
        subscribedTracks += subs.length;
        for (const sub of subs) { if (sub.track?.kind === 'video' && sub.track?.source === 'screen') screenShareTracks++; }
      }
      if (room.engine?.client?.stats?.bitrate) { totalBitrate += room.engine.client.stats.bitrate; bitrateSamples++; }
    }
    return { roomCount: rooms.length, participantCount, publishedTracks, subscribedTracks, screenShareTracks, averageBitrate: bitrateSamples > 0 ? totalBitrate / bitrateSamples : null };
  }, [trackLiveKit]);

  // Snapshot Builder
  const buildSnapshot = useCallback((): BenchmarkSnapshot => {
    const now = Date.now();
    const elapsed = now - startTimeRef.current;

    let network: NetworkSnapshot | null = null;
    if (trackNetwork) {
      const n = networkRef.current;
      network = { requestCount: n.requestCount, transferSize: n.transferSize, encodedBodySize: n.encodedBodySize, decodedBodySize: n.decodedBodySize, cachedCount: n.cachedCount, avgDuration: n.requestCount > 0 ? n.totalDuration / n.requestCount : 0, maxDuration: n.maxDuration };
    }

    let realtime: RealtimeSnapshot | null = null;
    if (trackRealtime && typeof window !== 'undefined') {
      const debug = (window as any).__MaiTroll_SUPABASE_REALTIME_DEBUG__;
      if (debug) {
        const created = debug.created || 0, removed = debug.removed || 0, active = debug.active || 0;
        const leaked = created - removed - active;
        realtime = { created, removed, active, leaked, leakDetected: leaked > 0, activeChannels: debug.activeChannels || [] };
      }
    }

    let memory: MemorySnapshot | null = null;
    if (trackMemory && typeof performance !== 'undefined' && (performance as any).memory) {
      const mem = (performance as any).memory;
      const usedMB = mem.usedJSHeapSize / 1024 / 1024;
      if (firstMemoryRef.current === null) firstMemoryRef.current = usedMB;
      const elapsedMin = elapsed / 60000;
      memory = { usedJSHeapSize: mem.usedJSHeapSize, totalJSHeapSize: mem.totalJSHeapSize, jsHeapSizeLimit: mem.jsHeapSizeLimit, usedMB, growthPerMinute: elapsedMin > 1 ? (usedMB - firstMemoryRef.current) / elapsedMin : null };
    }

    const liveKit = getLiveKitMetrics();

    let activeIntervals = 0;
    if (trackIntervals && typeof window !== 'undefined' && window.__MaiTroll_INTERVAL_REGISTRY__) {
      activeIntervals = window.__MaiTroll_INTERVAL_REGISTRY__.size;
    }

    return { timestamp: now, elapsed, label, network, realtime, memory, liveKit, renderCount: renderCountRef.current, activeIntervals };
  }, [label, trackNetwork, trackRealtime, trackMemory, trackIntervals, getLiveKitMetrics]);

  // Interval Report
  const getIntervalReport = useCallback((): IntervalReport => {
    const registry = typeof window !== 'undefined' ? window.__MaiTroll_INTERVAL_REGISTRY__ : null;
    if (!registry) return { totalActive: 0, byFrequency: {}, intervals: [] };
    const intervals = Array.from(registry.values());
    const byFrequency: Record<string, number> = {};
    for (const info of intervals) {
      const freq = info.delay < 1000 ? `${info.delay}ms` : `${(info.delay / 1000).toFixed(0)}s`;
      byFrequency[freq] = (byFrequency[freq] || 0) + 1;
    }
    return { totalActive: intervals.length, byFrequency, intervals };
  }, []);

  // Render Report
  const getRenderCounts = useCallback((): RenderReport => {
    const byComponent: Record<string, number> = {};
    let totalRenders = 0;
    if (typeof window !== 'undefined' && window.__MaiTroll_RENDER_COUNTS__) {
      for (const [name, count] of window.__MaiTroll_RENDER_COUNTS__.entries()) { byComponent[name] = count; totalRenders += count; }
    }
    for (const [name, count] of componentRenderCountsRef.current.entries()) {
      if (!(name in byComponent)) { byComponent[name] = count; totalRenders += count; }
    }
    const elapsed = (Date.now() - startTimeRef.current) / 60000;
    return { totalRenders, rendersPerMinute: elapsed > 0 ? totalRenders / elapsed : 0, byComponent };
  }, []);

  // Snapshot
  const snapshot = useCallback((): BenchmarkSnapshot => {
    const s = buildSnapshot();
    snapshotsRef.current.push(s);
    if (s.realtime?.leakDetected) {
      console.warn(`⚠️ [Benchmark:${label}] Potential Realtime Leak Detected!`, `Created: ${s.realtime.created}, Removed: ${s.realtime.removed}, Active: ${s.realtime.active}, Leaked: ${s.realtime.leaked}`, `Active channels:`, s.realtime.activeChannels);
    }
    if (verbose) console.log(`[Benchmark:${label}] Snapshot at ${(s.elapsed / 1000).toFixed(1)}s`, s);
    return s;
  }, [buildSnapshot, label, verbose]);

  // Report
  const report = useCallback(() => {
    const snaps = snapshotsRef.current;
    const latest = snaps.length > 0 ? snaps[snaps.length - 1] : buildSnapshot();
    const first = snaps.length > 0 ? snaps[0] : latest;
    const duration = latest.elapsed;
    const durationMin = duration / 60000;
    const peakMemoryMB = Math.max(...snaps.map(s => s.memory?.usedMB || 0));
    const memoryGrowthPerMinute = latest.memory?.growthPerMinute ?? null;
    const peakRealtimeChannels = Math.max(...snaps.map(s => s.realtime?.active || 0));
    const leakedChannels = latest.realtime?.leaked || 0;
    const channelLeakDetected = latest.realtime?.leakDetected || false;
    const renderReport = getRenderCounts();
    const intervalReport = getIntervalReport();

    const summary = {
      totalRequests: latest.network?.requestCount || 0,
      totalTransferMB: ((latest.network?.transferSize || 0) / 1024 / 1024),
      avgRequestsPerMinute: durationMin > 0 ? ((latest.network?.requestCount || 0) / durationMin) : 0,
      peakMemoryMB, memoryGrowthPerMinute, peakRealtimeChannels, leakedChannels, channelLeakDetected,
      totalRenders: renderReport.totalRenders, rendersPerMinute: renderReport.rendersPerMinute,
      activeIntervals: intervalReport.totalActive, duration,
      grades: {} as Record<string, BenchmarkGrade>,
    };

    summary.grades.networkRequests = gradeFromTrend(first.network?.requestCount || 0, latest.network?.requestCount || 0);
    summary.grades.memoryUsage = memoryGrowthPerMinute !== null ? gradeFromAbsolute(memoryGrowthPerMinute, { A: 1, B: 5, C: 10, D: 20 }) : { grade: 'B' as const, label: 'Stable' };
    summary.grades.realtimeChannels = peakRealtimeChannels <= 5 ? { grade: 'A' as const, label: `${peakRealtimeChannels} active` } : peakRealtimeChannels <= 15 ? { grade: 'B' as const, label: `${peakRealtimeChannels} active` } : peakRealtimeChannels <= 30 ? { grade: 'C' as const, label: `${peakRealtimeChannels} active` } : { grade: 'D' as const, label: `${peakRealtimeChannels} active` };
    summary.grades.channelLeaks = channelLeakDetected ? { grade: 'F' as const, label: `${leakedChannels} leaked!` } : { grade: 'A' as const, label: 'No leaks' };
    summary.grades.renders = renderReport.rendersPerMinute < 10 ? { grade: 'A' as const, label: `${renderReport.rendersPerMinute.toFixed(1)}/min` } : renderReport.rendersPerMinute < 30 ? { grade: 'B' as const, label: `${renderReport.rendersPerMinute.toFixed(1)}/min` } : renderReport.rendersPerMinute < 60 ? { grade: 'C' as const, label: `${renderReport.rendersPerMinute.toFixed(1)}/min` } : { grade: 'D' as const, label: `${renderReport.rendersPerMinute.toFixed(1)}/min` };
    summary.grades.polling = intervalReport.totalActive <= 3 ? { grade: 'A' as const, label: `${intervalReport.totalActive} intervals` } : intervalReport.totalActive <= 8 ? { grade: 'B' as const, label: `${intervalReport.totalActive} intervals` } : intervalReport.totalActive <= 15 ? { grade: 'C' as const, label: `${intervalReport.totalActive} intervals` } : { grade: 'D' as const, label: `${intervalReport.totalActive} intervals` };

    console.group(`📊 Benchmark Report: ${label}`);
    console.log(`Duration: ${(duration / 1000).toFixed(1)}s`);
    console.log(`Total Requests: ${summary.totalRequests} | Transfer: ${summary.totalTransferMB.toFixed(2)} MB | Req/min: ${summary.avgRequestsPerMinute.toFixed(1)}`);
    console.log(`Peak Memory: ${summary.peakMemoryMB.toFixed(1)} MB${memoryGrowthPerMinute !== null ? ` | Growth: ${memoryGrowthPerMinute >= 0 ? '+' : ''}${memoryGrowthPerMinute.toFixed(2)} MB/min` : ''}`);
    console.log(`Peak Realtime: ${summary.peakRealtimeChannels} | Leaks: ${channelLeakDetected ? `⚠️ ${leakedChannels}` : 'None ✓'}`);
    console.log(`Renders: ${summary.totalRenders} (${summary.rendersPerMinute.toFixed(1)}/min) | Intervals: ${summary.activeIntervals}`);
    if (intervalReport.totalActive > 0) {
      console.group('⏱️ Intervals');
      for (const [freq, count] of Object.entries(intervalReport.byFrequency)) console.log(`  ${freq}: ${count}`);
      for (const info of intervalReport.intervals) console.log(`  [${info.delay < 1000 ? `${info.delay}ms` : `${(info.delay / 1000).toFixed(0)}s`}] ${info.source || 'unknown'}`);
      console.groupEnd();
    }
    if (renderReport.totalRenders > 0) {
      console.group('🔄 Renders');
      Object.entries(renderReport.byComponent).sort((a, b) => b[1] - a[1]).forEach(([n, c]) => console.log(`  ${n}: ${c}`));
      console.groupEnd();
    }
    if (latest.liveKit && latest.liveKit.roomCount > 0) {
      console.group('📹 LiveKit');
      console.log(`  Rooms: ${latest.liveKit.roomCount} | Participants: ${latest.liveKit.participantCount}`);
      console.log(`  Published: ${latest.liveKit.publishedTracks} | Subscribed: ${latest.liveKit.subscribedTracks} | ScreenShare: ${latest.liveKit.screenShareTracks}`);
      if (latest.liveKit.averageBitrate !== null) console.log(`  Avg Bitrate: ${(latest.liveKit.averageBitrate / 1000).toFixed(0)} kbps`);
      console.groupEnd();
    }
    console.group('🏆 Grades');
    for (const [cat, g] of Object.entries(summary.grades)) {
      const icon = g.grade === 'A' ? '🟢' : g.grade === 'B' ? '🟢' : g.grade === 'C' ? '🟡' : g.grade === 'D' ? '🟠' : '🔴';
      console.log(`  ${icon} ${cat}: ${g.grade} — ${g.label}`);
    }
    console.groupEnd();
    console.groupEnd();

    return { snapshots: snaps, summary };
  }, [buildSnapshot, label, getRenderCounts, getIntervalReport]);

  const reset = useCallback(() => {
    snapshotsRef.current = [];
    startTimeRef.current = Date.now();
    firstMemoryRef.current = null;
    renderCountRef.current = 0;
    componentRenderCountsRef.current.clear();
    networkRef.current = { requestCount: 0, transferSize: 0, encodedBodySize: 0, decodedBodySize: 0, cachedCount: 0, totalDuration: 0, maxDuration: 0 };
    if (verbose) console.log(`[Benchmark:${label}] Reset`);
  }, [label, verbose]);

  const startTimer = useCallback((name: string) => { timersRef.current.set(name, performance.now()); }, []);
  const endTimer = useCallback((name: string): number | null => {
    const start = timersRef.current.get(name);
    if (start === undefined) return null;
    const d = performance.now() - start;
    timersRef.current.delete(name);
    if (verbose) console.log(`[Benchmark:${label}] Timer "${name}": ${d.toFixed(1)}ms`);
    return d;
  }, [label, verbose]);

  const trackRender = useCallback((componentName: string) => {
    const current = componentRenderCountsRef.current.get(componentName) || 0;
    componentRenderCountsRef.current.set(componentName, current + 1);
    if (typeof window !== 'undefined') {
      if (!window.__MaiTroll_RENDER_COUNTS__) window.__MaiTroll_RENDER_COUNTS__ = new Map();
      window.__MaiTroll_RENDER_COUNTS__.set(componentName, current + 1);
    }
  }, []);

  const api: BenchmarkAPI = { snapshot, report, reset, startTimer, endTimer, getIntervalReport, getRenderCounts, getLiveKitMetrics, trackRender };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (!window.__MaiTroll_BENCHMARKS__) window.__MaiTroll_BENCHMARKS__ = new Map();
      window.__MaiTroll_BENCHMARKS__.set(label, api);
      window.__MaiTroll_BENCHMARK__ = api;
    }
    snapshot();
    const interval = setInterval(() => snapshot(), snapshotInterval);
    return () => {
      clearInterval(interval);
      snapshot();
      if (verbose) { console.log(`[Benchmark:${label}] Unmounted. Final report:`); report(); }
      if (typeof window !== 'undefined') window.__MaiTroll_BENCHMARKS__?.delete(label);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [label, snapshotInterval]);

  return api;
}

// ─── Standalone Helpers ───────────────────────────────────────────────────────

export function quickBenchmark(label: string): BenchmarkAPI {
  const snapshots: BenchmarkSnapshot[] = [];
  const startTime = Date.now();
  const timers = new Map<string, number>();
  const componentRenderCounts = new Map<string, number>();
  let renderCount = 0;
  let firstMemory: number | null = null;

  if (typeof window !== 'undefined' && !window.__MaiTroll_SETINTERVAL_PATCHED__) patchSetInterval();

  const getNetwork = (): NetworkSnapshot | null => {
    const entries = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
    const durations = entries.filter(e => e.duration > 0).map(e => e.duration);
    return { requestCount: entries.length, transferSize: entries.reduce((s, e) => s + (e.transferSize || 0), 0), encodedBodySize: entries.reduce((s, e) => s + (e.encodedBodySize || 0), 0), decodedBodySize: entries.reduce((s, e) => s + (e.decodedBodySize || 0), 0), cachedCount: entries.filter(e => e.transferSize === 0 && e.decodedBodySize > 0).length, avgDuration: durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0, maxDuration: durations.length > 0 ? Math.max(...durations) : 0 };
  };

  const getRealtime = (): RealtimeSnapshot | null => {
    const debug = (window as any).__MaiTroll_SUPABASE_REALTIME_DEBUG__;
    if (!debug) return null;
    const created = debug.created || 0, removed = debug.removed || 0, active = debug.active || 0;
    const leaked = created - removed - active;
    return { created, removed, active, leaked, leakDetected: leaked > 0, activeChannels: debug.activeChannels || [] };
  };

  const getMemory = (): MemorySnapshot | null => {
    if (!(performance as any).memory) return null;
    const mem = (performance as any).memory;
    const usedMB = mem.usedJSHeapSize / 1024 / 1024;
    if (firstMemory === null) firstMemory = usedMB;
    const elapsedMin = (Date.now() - startTime) / 60000;
    return { usedJSHeapSize: mem.usedJSHeapSize, totalJSHeapSize: mem.totalJSHeapSize, jsHeapSizeLimit: mem.jsHeapSizeLimit, usedMB, growthPerMinute: elapsedMin > 1 ? (usedMB - firstMemory) / elapsedMin : null };
  };

  const getLiveKit = (): LiveKitSnapshot | null => {
    if (typeof window === 'undefined') return null;
    const lk = (window as any).__MaiTroll_LIVEKIT__;
    if (!lk) return null;
    const rooms: any[] = lk.rooms || (lk.room ? [lk.room] : []);
    let participantCount = 0, publishedTracks = 0, subscribedTracks = 0, screenShareTracks = 0;
    for (const room of rooms) {
      participantCount += (room.participants || []).length + 1;
      if (room.localParticipant) publishedTracks += (room.localParticipant.trackPublications || []).length;
      for (const p of (room.participants || [])) subscribedTracks += (p.trackSubscriptions || []).length;
    }
    return { roomCount: rooms.length, participantCount, publishedTracks, subscribedTracks, screenShareTracks, averageBitrate: null };
  };

  const buildSnap = (): BenchmarkSnapshot => {
    const elapsed = Date.now() - startTime;
    let activeIntervals = 0;
    if (typeof window !== 'undefined' && window.__MaiTroll_INTERVAL_REGISTRY__) activeIntervals = window.__MaiTroll_INTERVAL_REGISTRY__.size;
    return { timestamp: Date.now(), elapsed, label, network: getNetwork(), realtime: getRealtime(), memory: getMemory(), liveKit: getLiveKit(), renderCount, activeIntervals };
  };

  return {
    snapshot: () => {
      const s = buildSnap(); snapshots.push(s);
      if (s.realtime?.leakDetected) console.warn(`⚠️ [Benchmark:${label}] Potential Realtime Leak Detected! Leaked: ${s.realtime.leaked}`, s.realtime.activeChannels);
      return s;
    },
    report: () => {
      const latest = snapshots.length > 0 ? snapshots[snapshots.length - 1] : buildSnap();
      const duration = latest.elapsed, durationMin = duration / 60000;
      const peakMemoryMB = Math.max(...snapshots.map(s => s.memory?.usedMB || 0), 0);
      const memoryGrowth = latest.memory?.growthPerMinute ?? null;
      const peakRealtime = Math.max(...snapshots.map(s => s.realtime?.active || 0), 0);
      const leaked = latest.realtime?.leaked || 0;
      const leakDetected = latest.realtime?.leakDetected || false;
      const grades: Record<string, BenchmarkGrade> = {
        realtimeChannels: peakRealtime <= 5 ? { grade: 'A', label: `${peakRealtime} active` } : peakRealtime <= 15 ? { grade: 'B', label: `${peakRealtime} active` } : { grade: 'C', label: `${peakRealtime} active` },
        channelLeaks: leakDetected ? { grade: 'F', label: `${leaked} leaked!` } : { grade: 'A', label: 'No leaks' },
        memoryUsage: memoryGrowth !== null ? gradeFromAbsolute(memoryGrowth, { A: 1, B: 5, C: 10, D: 20 }) : { grade: 'B' as const, label: 'Stable' },
      };
      const summary = { totalRequests: latest.network?.requestCount || 0, totalTransferMB: ((latest.network?.transferSize || 0) / 1024 / 1024), avgRequestsPerMinute: durationMin > 0 ? ((latest.network?.requestCount || 0) / durationMin) : 0, peakMemoryMB, memoryGrowthPerMinute: memoryGrowth, peakRealtimeChannels: peakRealtime, leakedChannels: leaked, channelLeakDetected: leakDetected, totalRenders: renderCount, rendersPerMinute: durationMin > 0 ? renderCount / durationMin : 0, activeIntervals: latest.activeIntervals, duration, grades };
      console.group(`📊 Quick Benchmark: ${label}`);
      console.log(`Duration: ${(duration / 1000).toFixed(1)}s | Requests: ${summary.totalRequests} | Transfer: ${summary.totalTransferMB.toFixed(2)} MB`);
      console.log(`Memory: ${summary.peakMemoryMB.toFixed(1)} MB${memoryGrowth !== null ? ` | Growth: ${memoryGrowth >= 0 ? '+' : ''}${memoryGrowth.toFixed(2)} MB/min` : ''}`);
      console.log(`Realtime: ${peakRealtime} peak | Leaks: ${leakDetected ? `⚠️ ${leaked}` : 'None ✓'}`);
      console.log(`Renders: ${renderCount} (${summary.rendersPerMinute.toFixed(1)}/min) | Intervals: ${latest.activeIntervals}`);
      console.group('🏆 Grades');
      for (const [cat, g] of Object.entries(grades)) {
        const icon = g.grade === 'A' ? '🟢' : g.grade === 'B' ? '🟢' : g.grade === 'C' ? '🟡' : g.grade === 'D' ? '🟠' : '🔴';
        console.log(`  ${icon} ${cat}: ${g.grade} — ${g.label}`);
      }
      console.groupEnd();
      console.groupEnd();
      return { snapshots: [...snapshots], summary };
    },
    reset: () => { snapshots.length = 0; firstMemory = null; renderCount = 0; componentRenderCounts.clear(); },
    startTimer: (name: string) => { timers.set(name, performance.now()); },
    endTimer: (name: string) => { const s = timers.get(name); if (s === undefined) return null; const d = performance.now() - s; timers.delete(name); return d; },
    getIntervalReport: () => {
      const registry = typeof window !== 'undefined' ? window.__MaiTroll_INTERVAL_REGISTRY__ : null;
      if (!registry) return { totalActive: 0, byFrequency: {}, intervals: [] };
      const intervals = Array.from(registry.values());
      const byFrequency: Record<string, number> = {};
      for (const info of intervals) { const freq = info.delay < 1000 ? `${info.delay}ms` : `${(info.delay / 1000).toFixed(0)}s`; byFrequency[freq] = (byFrequency[freq] || 0) + 1; }
      return { totalActive: intervals.length, byFrequency, intervals };
    },
    getRenderCounts: () => {
      const byComponent: Record<string, number> = {};
      let total = 0;
      for (const [name, count] of componentRenderCounts.entries()) { byComponent[name] = count; total += count; }
      const elapsed = (Date.now() - startTime) / 60000;
      return { totalRenders: total, rendersPerMinute: elapsed > 0 ? total / elapsed : 0, byComponent };
    },
    getLiveKitMetrics: getLiveKit,
    trackRender: (componentName: string) => { renderCount++; const c = componentRenderCounts.get(componentName) || 0; componentRenderCounts.set(componentName, c + 1); },
  };
}
