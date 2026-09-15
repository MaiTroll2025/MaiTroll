/**
 * Connection Budget System
 * 
 * Tracks active Realtime channel count and prevents new subscriptions
 * when approaching the Supabase Pro limit of 500 concurrent connections.
 * 
 * Strategy:
 * - Track active channel count globally
 * - Warn at 400 connections (80% of limit)
 * - Block new non-critical subscriptions at 450 (90% of limit)
 * - Always allow critical channels (auth, arrests, presence)
 */

const MAX_CONNECTIONS = 675;
const WARN_THRESHOLD = 540;
const BLOCK_THRESHOLD = 650;

// Critical channel patterns that are always allowed
const CRITICAL_PATTERNS = [
  'app-arrests:',
  'global-presence',
  'auth',
  'session',
];

let activeChannels = 0;
let listeners: Set<() => void> = new Set();
let warnedAt = false;

function isCritical(name: string): boolean {
  return CRITICAL_PATTERNS.some(pattern => name.startsWith(pattern) || name.includes(pattern));
}

function notifyListeners() {
  listeners.forEach(fn => fn());
}

export const connectionBudget = {
  /**
   * Try to acquire a slot for a new channel.
   * Returns true if allowed, false if blocked.
   */
  acquire(name: string): boolean {
    // Always allow critical channels
    if (isCritical(name)) {
      activeChannels++;
      notifyListeners();
      return true;
    }

    // Block non-critical when at threshold
    if (activeChannels >= BLOCK_THRESHOLD) {
      console.warn(`[ConnectionBudget] BLOCKED channel "${name}" — at ${activeChannels}/${MAX_CONNECTIONS} connections`);
      return false;
    }

    // Warn at threshold
    if (activeChannels >= WARN_THRESHOLD && !warnedAt) {
      warnedAt = true;
      console.warn(`[ConnectionBudget] WARNING: at ${activeChannels}/${MAX_CONNECTIONS} connections`);
    }

    activeChannels++;
    notifyListeners();
    return true;
  },

  /**
   * Release a slot when channel is removed.
   */
  release(name: string): void {
    activeChannels = Math.max(0, activeChannels - 1);
    if (activeChannels < WARN_THRESHOLD) {
      warnedAt = false;
    }
    notifyListeners();
  },

  /**
   * Get current active channel count.
   */
  get count(): number {
    return activeChannels;
  },

  /**
   * Get remaining budget.
   */
  get remaining(): number {
    return Math.max(0, MAX_CONNECTIONS - activeChannels);
  },

  /**
   * Check if we're in a healthy state.
   */
  get isHealthy(): boolean {
    return activeChannels < WARN_THRESHOLD;
  },

  /**
   * Subscribe to budget changes.
   */
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => { listeners.delete(fn); };
  },

  /**
   * Reset count (for testing or emergency).
   */
  reset(): void {
    activeChannels = 0;
    warnedAt = false;
    notifyListeners();
  },
};
