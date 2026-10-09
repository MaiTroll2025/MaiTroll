import { useEffect, useRef, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { useAuthStore } from "../lib/store";
import { useLocation } from "react-router-dom";

/**
 * Tracks the user's current route/page and writes it to user_presence_routes.
 *
 * Scaling optimizations:
 * - No periodic heartbeat — route changes are event-driven
 * - Route dedup: skips DB write if route hasn't changed
 * - 5s debounce to prevent rapid duplicate writes
 *
 * Should be used once at the app level for authenticated users.
 */
export function useUserPresenceRoute() {
  const { user: _storeUser } = useAuthStore();
  const location = useLocation();
  const lastUpdateRef = useRef(0);
  const lastRouteRef = useRef<string | null>(null);
  const sessionIdRef = useRef(
    `sess_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
  );

  const getAuthUserId = useCallback(async (): Promise<string | null> => {
    const { data } = await supabase.auth.getUser();
    return data.user?.id ?? null;
  }, []);

  const updatePresence = useCallback(
    async (path: string, title: string) => {
      const authUserId = await getAuthUserId();

      if (!authUserId) {
        return;
      }

      // Route dedup: skip if route hasn't changed
      if (lastRouteRef.current === path) return;
      lastRouteRef.current = path;

      // 5s debounce
      const now = Date.now();
      if (now - lastUpdateRef.current < 5000) return;
      lastUpdateRef.current = now;

      try {
        const { data: profile } = await supabase
          .from("user_profiles")
          .select("id")
          .eq("id", authUserId)
          .maybeSingle();
        if (!profile) return;

        const { error } = await supabase.from("user_presence_routes").upsert(
          {
            user_id: authUserId,
            current_path: path,
            current_title: title || document.title || path,
            session_id: sessionIdRef.current,
            user_agent: navigator.userAgent?.slice(0, 200) || null,
            last_seen_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" }
        );

        if (error?.code === '42P10') {
          const { error: updateError } = await supabase
            .from("user_presence_routes")
            .update({
              current_path: path,
              current_title: title || document.title || path,
              session_id: sessionIdRef.current,
              user_agent: navigator.userAgent?.slice(0, 200) || null,
              last_seen_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .match({ user_id: authUserId });

          if (updateError?.code === 'PGRST116') {
            await supabase.from("user_presence_routes").insert({
              user_id: authUserId,
              current_path: path,
              current_title: title || document.title || path,
              session_id: sessionIdRef.current,
              user_agent: navigator.userAgent?.slice(0, 200) || null,
              last_seen_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            });
          }
        } else if (error) {
          console.error("[useUserPresenceRoute] Upsert failed", {
            error,
            authUserId,
            currentPath: path,
          });
        }
      } catch (err: any) {
        console.error("[useUserPresenceRoute] Unexpected error", {
          error: err,
          authUserId,
          currentPath: path,
        });
      }
    },
    [getAuthUserId]
  );

  // Update on route change
  useEffect(() => {
    updatePresence(location.pathname, document.title);
  }, [location.pathname, updatePresence]);

  // Update on visibility change (tab becomes active)
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        // Reset route cache so the current route is written again on return
        lastRouteRef.current = null;
        updatePresence(location.pathname, document.title);
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [location.pathname, updatePresence]);
}
