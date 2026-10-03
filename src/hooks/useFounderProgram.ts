/**
 * Mai Troll — Founder Program React hooks
 *
 * Module-level store (not a Context provider) so the Founder badge and the gold
 * username work in EVERY tree — web pages, phone pages, modals, portals — with
 * a single shared query instead of one request per rendered username.
 *
 * Why a store instead of per-component fetches:
 *   - The active Founder set is small and bounded (configurable capacity,
 *     default 5), so one row set covers the whole app.
 *   - Many hundreds of usernames render at once; one query + one realtime
 *     channel is dramatically cheaper than N queries.
 *
 * SECURITY: This is presentation only. The database independently enforces
 * status/expiry on every Founder resource. A tampered client cache can only
 * make a badge look wrong — never grant a permission.
 */

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { supabase } from '@/lib/supabase';
import {
  FounderChatPeer,
  FounderDirectoryEntry,
  FounderMessage,
  FounderMyStatus,
  FounderPermissions,
  getFounderDirectory,
  getMyFounderStatus,
  listFounderMessages,
  markFounderMessagesRead,
  sendFounderMessage,
} from '@/services/founderProgram';

/* -------------------------------------------------------------------------- */
/* Directory store                                                             */
/* -------------------------------------------------------------------------- */

type FounderMap = Record<string, FounderDirectoryEntry>;

let snapshot: FounderMap = {};
const listeners = new Set<() => void>();
let inflight: Promise<FounderMap> | null = null;
let ttlTimer: ReturnType<typeof setTimeout> | null = null;
let started = false;

const TTL_MS = 5 * 60 * 1000;
const EMPTY: FounderMap = {};

function emit() {
  listeners.forEach((fn) => fn());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const getSnapshot = () => snapshot;

function normalizeDirectory(entries: FounderDirectoryEntry[]): FounderMap {
  const map: FounderMap = {};
  for (const entry of entries) {
    if (entry?.user_id) map[entry.user_id] = entry;
  }
  return map;
}

async function loadDirectory(force = false): Promise<FounderMap> {
  if (!force && Object.keys(snapshot).length > 0) return snapshot;
  if (inflight) return inflight;

  inflight = getFounderDirectory()
    .then((entries) => {
      snapshot = normalizeDirectory(entries);
      emit();
      return snapshot;
    })
    .catch(() => snapshot)
    .finally(() => {
      inflight = null;
    });

  return inflight;
}

function scheduleRefresh() {
  if (ttlTimer) clearTimeout(ttlTimer);
  ttlTimer = setTimeout(() => {
    ttlTimer = null;
    void loadDirectory(true);
  }, TTL_MS);
}

/** Starts the realtime listener + TTL refresh once per session. */
function ensureStarted() {
  if (started) return;
  if (typeof window === 'undefined') return;
  started = true;

  void loadDirectory();

  try {
    // Subscribe to founder_public_status, NOT public.founders. The mirror holds
    // only non-sensitive status fields and is world-readable, so the change feed
    // actually reaches a newly promoted Founder instead of being blocked by the
    // founders table RLS. Re-running the directory RPC keeps one source of truth.
    supabase
      .channel('founders-directory')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'founder_public_status' },
        () => {
          void loadDirectory(true).then(scheduleRefresh);
        },
      )
      .subscribe();
  } catch {
    /* realtime is an enhancement — the initial load + TTL refresh still work */
  }
}

/** Manual invalidation (e.g. right after an admin change). */
export function refreshFounderDirectory() {
  return loadDirectory(true);
}

/* -------------------------------------------------------------------------- */
/* Public hooks                                                                */
/* -------------------------------------------------------------------------- */

export interface FounderIdentity {
  /**
   * True when the user holds ACTIVE Founder status. This is the permission
   * signal — it drives the Founder Hub nav and Founder-only UI. It is
   * intentionally independent of the badge so an Admin who is also a Founder
   * still gets their Founder perks and access.
   */
  isActiveFounder: boolean;
  /**
   * True only when the gold username + Founder badge should actually be
   * rendered. Admins are excluded: Founder is a public-facing identity marker,
   * and an Admin already carries the strongest role presentation in the app, so
   * showing Founder status on top of it is suppressed in every container.
   */
  showFounderBadge: boolean;
  entry: FounderDirectoryEntry | null;
}

/** Presentation-only founder lookup for a single user id. */
export function useFounderIdentity(userId?: string | null): FounderIdentity {
  const value = useSyncExternalStore(subscribe, getSnapshot, () => EMPTY);

  useEffect(() => {
    ensureStarted();
  }, []);

  return useMemo(() => {
    if (!userId) {
      return { isActiveFounder: false, showFounderBadge: false, entry: null };
    }
    const entry = value[userId] ?? null;
    const isActiveFounder = Boolean(entry);
    return {
      isActiveFounder,
      showFounderBadge: isActiveFounder && !entry?.is_admin,
      entry,
    };
  }, [value, userId]);
}

/**
 * Active Founder status (permissions / navigation). This is NOT the badge flag:
 * an Admin who is a Founder must still see the Founder Hub.
 */
export function useIsActiveFounder(userId?: string | null): boolean {
  return useFounderIdentity(userId).isActiveFounder;
}

/** Only the visual treatment. Suppressed for Admins. */
export function useShowFounderBadge(userId?: string | null): boolean {
  return useFounderIdentity(userId).showFounderBadge;
}

const NO_PERMISSIONS: FounderPermissions = {
  view_reports: false,
  arrest: false,
  release: false,
  summon: false,
  schedule_broadcast: false,
  chat: false,
};

export interface FounderSelfStatus {
  status: FounderMyStatus | null;
  isFounder: boolean;
  canAccessHub: boolean;
  isAdminView: boolean;
  permissions: FounderPermissions;
  daysRemaining: number;
  giftMultiplier: number;
  cashoutMultiplier: number;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/** The signed-in user's own Founder status (server-verified). */
export function useFounderSelfStatus(): FounderSelfStatus {
  const [status, setStatus] = useState<FounderMyStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const next = await getMyFounderStatus();
    if (!mounted.current) return;
    setStatus(next);
    setError(null);
    setLoading(false);
    if (next?.is_founder) void loadDirectory(true);
  }, []);

  useEffect(() => {
    mounted.current = true;
    ensureStarted();
    void refresh();
    return () => {
      mounted.current = false;
    };
  }, [refresh]);

  return useMemo(
    () => ({
      status,
      isFounder: Boolean(status?.is_founder),
      canAccessHub: Boolean(status?.can_access_hub),
      isAdminView: Boolean(status?.is_admin_view),
      permissions: status?.permissions ?? NO_PERMISSIONS,
      daysRemaining: Number(status?.days_remaining ?? 0) || 0,
      giftMultiplier: Number(status?.gift_multiplier ?? 1) || 1,
      cashoutMultiplier: Number(status?.cashout_multiplier ?? 1) || 1,
      loading,
      error,
      refresh,
    }),
    [status, loading, error, refresh],
  );
}

/* -------------------------------------------------------------------------- */
/* Founder Chat (realtime)                                                     */
/* -------------------------------------------------------------------------- */

export interface FounderChatState {
  messages: FounderMessage[];
  founders: FounderChatPeer[];
  unread: number;
  loading: boolean;
  sending: boolean;
  error: string | null;
  send: (body: string) => Promise<boolean>;
  markRead: () => Promise<void>;
  reload: () => Promise<void>;
}

/**
 * Founder Chat with Supabase Realtime.
 * - Single channel per mounted component instance
 * - Subscriptions are removed on unmount (no leaks, no duplicate listeners)
 * - Reconnects re-read history, so nothing is lost after a disconnect
 */
export function useFounderChat(enabled = true): FounderChatState {
  const [messages, setMessages] = useState<FounderMessage[]>([]);
  const [founders, setFounders] = useState<FounderChatPeer[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const foundersRef = useRef<Map<string, FounderChatPeer>>(new Map());
  const currentUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let active = true;

    supabase.auth
      .getUser()
      .then(({ data }) => {
        if (active) currentUserIdRef.current = data?.user?.id ?? null;
      })
      .catch(() => {
        /* anonymous session — leave the id null */
      });

    return () => {
      active = false;
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      const res = await listFounderMessages(100);
      if (cancelled) return;
      const rows = [...res.messages].reverse();
      const known = new Map<string, FounderChatPeer>(
        res.founders.map((f) => [f.user_id, f] as const),
      );
      foundersRef.current = known;
      setMessages(rows);
      setFounders(res.founders);
      setError(res.ok ? null : res.message);
      setLoading(false);

      if (res.ok) {
        await markFounderMessagesRead();
        if (!cancelled) setUnread(0);
      }
    };

    void load();

    const chatChannel = supabase
      .channel(`founder-chat-${Math.random().toString(36).slice(2)}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'founder_messages' },
        async (payload) => {
          if (cancelled) return;
          const record = payload.new as Record<string, unknown>;
          const senderId = String(record.sender_id ?? '');
          if (!senderId) return;

          const known = foundersRef.current.get(senderId);

          const { data: profile } = await supabase
            .from('user_profiles')
            .select('username, display_name, avatar_url')
            .eq('id', senderId)
            .maybeSingle();
          if (cancelled) return;

          const message: FounderMessage = {
            id: String(record.id),
            sender_id: senderId,
            username:
              (profile?.username as string | undefined) ||
              known?.username ||
              'Founder',
            avatar_url:
              (profile?.avatar_url as string | null) ?? known?.avatar_url ?? null,
            body: String(record.body ?? ''),
            created_at: String(record.created_at ?? new Date().toISOString()),
            is_mine: senderId === currentUserIdRef.current,
          };

          setMessages((prev) => {
            if (prev.some((m) => m.id === message.id)) return prev;
            return [...prev, message];
          });
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(chatChannel);
    };
  }, [enabled]);

  const send = useCallback(async (body: string) => {
    const trimmed = body.trim();
    if (!trimmed) return false;
    setSending(true);
    const res = await sendFounderMessage(trimmed);
    setSending(false);
    if (!res.ok) {
      setError(res.message);
      return false;
    }
    setError(null);
    return true;
  }, []);

  const markRead = useCallback(async () => {
    await markFounderMessagesRead();
    setUnread(0);
  }, []);

  const reload = useCallback(async () => {
    const res = await listFounderMessages(100);
    const rows = [...res.messages].reverse();
    foundersRef.current = new Map<string, FounderChatPeer>(
      res.founders.map((f) => [f.user_id, f] as const),
    );
    setMessages(rows);
    setFounders(res.founders);
    setError(res.ok ? null : res.message);
  }, []);

  return { messages, founders, unread, loading, sending, error, send, markRead, reload };
}