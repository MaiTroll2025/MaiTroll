import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "../lib/supabase";
import { useAuthStore } from "../lib/store";
import { toast } from "sonner";

export interface ScreenSession {
  id: string;
  target_user_id: string;
  requested_by: string;
  status: "requested" | "accepted" | "active" | "ended" | "declined" | "expired";
  livekit_room_name: string | null;
  reason: string | null;
  created_at: string;
  accepted_at: string | null;
  ended_at: string | null;
}

export function useSupportScreenSession() {
  const { user, profile } = useAuthStore();
  const [activeSession, setActiveSession] = useState<ScreenSession | null>(null);
  const [incomingRequest, setIncomingRequest] = useState<ScreenSession | null>(null);
  const [loading, setLoading] = useState(false);
  const isAdmin = profile?.is_admin === true || profile?.role === "admin" || profile?.role === "ceo";
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Subscribe to screen session changes for the current user
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`screen-session-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "support_screen_sessions",
          filter: `target_user_id=eq.${user.id}`,
        },
        (payload) => {
          const session = payload.new as ScreenSession;
          if (payload.eventType === "INSERT" && session.status === "requested") {
            setIncomingRequest(session);
          } else if (payload.eventType === "UPDATE") {
            setActiveSession(session);
            if (session.status === "ended" || session.status === "declined") {
              setIncomingRequest(null);
            }
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "support_screen_sessions",
          filter: `requested_by=eq.${user.id}`,
        },
        (payload) => {
          const session = payload.new as ScreenSession;
          setActiveSession(session);
          if (session.status === "declined" || session.status === "ended") {
            setIncomingRequest(null);
          }
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [user?.id]);

  // Load any existing active session on mount
  useEffect(() => {
    if (!user?.id) return;

    const loadActive = async () => {
      const { data } = await supabase
        .from("support_screen_sessions")
        .select("*")
        .or(`target_user_id.eq.${user.id},requested_by.eq.${user.id}`)
        .in("status", ["requested", "accepted", "active"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data) {
        if (data.status === "requested" && data.target_user_id === user.id) {
          setIncomingRequest(data as ScreenSession);
        } else {
          setActiveSession(data as ScreenSession);
        }
      }
    };

    loadActive();
  }, [user?.id]);

  const requestScreenShare = useCallback(
    async (targetUserId: string, reason: string) => {
      if (!user?.id || !isAdmin) {
        toast.error("Only admins can request screen shares");
        return false;
      }

      setLoading(true);
      try {
        const roomName = `support-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

        const { data, error } = await supabase
          .from("support_screen_sessions")
          .insert({
            target_user_id: targetUserId,
            requested_by: user.id,
            status: "requested",
            livekit_room_name: roomName,
            reason: reason || null,
          })
          .select()
          .single();

        if (error) throw error;

        // Audit log
        await supabase.from("customer_service_audit_logs").insert({
          actor_id: user.id,
          target_user_id: targetUserId,
          action: "screen_share_requested",
          details: { room_name: roomName, reason },
        });

        setActiveSession(data as ScreenSession);
        toast.success("Screen share request sent");
        return true;
      } catch (err: any) {
        toast.error(err.message || "Failed to request screen share");
        return false;
      } finally {
        setLoading(false);
      }
    },
    [user?.id, isAdmin]
  );

  const acceptScreenShare = useCallback(
    async (sessionId: string) => {
      if (!user?.id) return false;

      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("support_screen_sessions")
          .update({
            status: "active",
            accepted_at: new Date().toISOString(),
          })
          .eq("id", sessionId)
          .eq("target_user_id", user.id)
          .eq("status", "requested")
          .select()
          .single();

        if (error) throw error;

        // Audit log
        await supabase.from("customer_service_audit_logs").insert({
          actor_id: user.id,
          target_user_id: user.id,
          action: "screen_share_accepted",
          details: { session_id: sessionId },
        });

        setIncomingRequest(null);
        setActiveSession(data as ScreenSession);
        return true;
      } catch (err: any) {
        toast.error(err.message || "Failed to accept screen share");
        return false;
      } finally {
        setLoading(false);
      }
    },
    [user?.id]
  );

  const declineScreenShare = useCallback(
    async (sessionId: string) => {
      if (!user?.id) return false;

      setLoading(true);
      try {
        const { data: _data, error } = await supabase
          .from("support_screen_sessions")
          .update({
            status: "declined",
            ended_at: new Date().toISOString(),
          })
          .eq("id", sessionId)
          .eq("target_user_id", user.id)
          .eq("status", "requested")
          .select()
          .single();

        if (error) throw error;

        await supabase.from("customer_service_audit_logs").insert({
          actor_id: user.id,
          target_user_id: user.id,
          action: "screen_share_declined",
          details: { session_id: sessionId },
        });

        setIncomingRequest(null);
        return true;
      } catch (err: any) {
        toast.error(err.message || "Failed to decline");
        return false;
      } finally {
        setLoading(false);
      }
    },
    [user?.id]
  );

  const endScreenShare = useCallback(
    async (sessionId: string) => {
      if (!user?.id) return false;

      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("support_screen_sessions")
          .update({
            status: "ended",
            ended_at: new Date().toISOString(),
          })
          .eq("id", sessionId)
          .in("status", ["accepted", "active"])
          .select()
          .single();

        if (error) throw error;

        await supabase.from("customer_service_audit_logs").insert({
          actor_id: user.id,
          target_user_id: data.target_user_id,
          action: "screen_share_ended",
          details: { session_id: sessionId, ended_by: user.id },
        });

        setActiveSession(null);
        setIncomingRequest(null);
        return true;
      } catch (err: any) {
        toast.error(err.message || "Failed to end screen share");
        return false;
      } finally {
        setLoading(false);
      }
    },
    [user?.id]
  );

  return {
    activeSession,
    incomingRequest,
    loading,
    isAdmin,
    requestScreenShare,
    acceptScreenShare,
    declineScreenShare,
    endScreenShare,
  };
}
