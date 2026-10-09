import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "../lib/supabase";
import { useAuthStore } from "../lib/store";

export interface CSUser {
  id: string;
  username: string;
  display_name: string | null;
  email: string | null;
  role: string | null;
  account_status: string;
  current_path: string | null;
  current_title: string | null;
  last_seen_at: string | null;
  is_online: boolean;
  license_status: string | null;
  jail_status: string | null;
  payout_flags: string | null;
  bug_report_count: number;
  support_ticket_count: number;
  error_count: number;
  created_at: string | null;
}

const ONLINE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

export function useCustomerServiceUsers() {
  const { profile } = useAuthStore();
  const [users, setUsers] = useState<CSUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const fetchUsers = useCallback(async () => {
    if (!profile) return;

    setLoading(true);
    setError(null);

    try {
      // Fetch all user profiles
      const { data: profiles, error: profilesError } = await supabase
        .from("user_profiles")
        .select(
          "id, username, display_name, email, role, license_status, created_at, is_banned"
        )
        .order("username", { ascending: true });

      if (profilesError) throw profilesError;

      // Fetch presence data (CEO can read all)
      const { data: presenceData, error: presenceError } = await supabase
        .from("user_presence_routes")
        .select("user_id, current_path, current_title, last_seen_at");

      if (presenceError && presenceError.code !== '42501') {
        console.warn("[useCustomerServiceUsers] Presence fetch error:", presenceError.message);
      }

      const presenceMap = new Map(
        (presenceData || []).map((p) => [p.user_id, p])
      );

      // Fetch jail status
      const { data: jailData } = await supabase
        .from("jail")
        .select("user_id, scheduled_release_at, status")
        .in(
          "user_id",
          (profiles || []).map((p) => p.id)
        );

      const jailMap = new Map(
        (jailData || [])
          .filter((j) => new Date(j.scheduled_release_at) > new Date())
          .map((j) => [j.user_id, j])
      );

      // Fetch bug report counts (safe try/catch)
      const bugCounts = new Map<string, number>();
      try {
        const { data: bugs } = await supabase
          .from("app_bug_reports")
          .select("user_id")
          .eq("status", "open");
        (bugs || []).forEach((b: any) => {
          bugCounts.set(b.user_id, (bugCounts.get(b.user_id) || 0) + 1);
        });
      } catch {
        // table may not exist
      }

      // Fetch support ticket counts
      const ticketCounts = new Map<string, number>();
      try {
        const { data: tickets } = await supabase
          .from("support_tickets")
          .select("user_id, status")
          .in("status", ["open", "pending"]);
        (tickets || []).forEach((t: any) => {
          ticketCounts.set(t.user_id, (ticketCounts.get(t.user_id) || 0) + 1);
        });
      } catch {
        // table may not exist
      }

      // Fetch payout flags
      const payoutFlags = new Map<string, string>();
      try {
        const { data: payouts } = await supabase
          .from("payout_requests")
          .select("user_id, status")
          .eq("status", "flagged");
        (payouts || []).forEach((p: any) => {
          payoutFlags.set(p.user_id, p.status);
        });
      } catch {
        // table may not exist
      }

      const now = Date.now();

      const csUsers: CSUser[] = (profiles || []).map((p: any) => {
        const presence = presenceMap.get(p.id);
        const jail = jailMap.get(p.id);
        const lastSeen = presence?.last_seen_at
          ? new Date(presence.last_seen_at).getTime()
          : null;
        const isOnline = lastSeen ? now - lastSeen < ONLINE_THRESHOLD_MS : false;

        let account_status = "active";
        if (p.is_banned) {
          account_status = "banned";
        } else if (jail) {
          account_status = "jailed";
        }

        return {
          id: p.id,
          username: p.username || "Unknown",
          display_name: p.display_name || null,
          email: p.email || null,
          role: p.role || "user",
          account_status,
          current_path: presence?.current_path || null,
          current_title: presence?.current_title || null,
          last_seen_at: presence?.last_seen_at || null,
          is_online: isOnline,
          license_status: p.license_status || null,
          jail_status: jail ? "jailed" : null,
          payout_flags: payoutFlags.get(p.id) || null,
          bug_report_count: bugCounts.get(p.id) || 0,
          support_ticket_count: ticketCounts.get(p.id) || 0,
          error_count: 0,
          created_at: p.created_at || null,
        };
      });

      if (isMountedRef.current) {
        setUsers(csUsers);
        setLoading(false);
      }
    } catch (err: any) {
      console.error("[useCustomerServiceUsers] Error:", err);
      if (isMountedRef.current) {
        setError(err.message || "Failed to load users");
        setLoading(false);
      }
    }
  }, [profile]);

  useEffect(() => {
    fetchUsers();

    // Set up realtime subscription for presence updates
    const channel = supabase
      .channel("cs-presence")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "user_presence_routes",
        },
        () => {
          fetchUsers();
        }
      )
      .subscribe();

    // OPTIMIZED: 30s interval with visibility check
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') fetchUsers();
    }, 30000);

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
      clearInterval(interval);
    };
  }, [fetchUsers]);

  return { users, loading, error, refetch: fetchUsers };
}
