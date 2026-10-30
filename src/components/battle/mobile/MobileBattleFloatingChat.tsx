import React, { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../../../lib/supabase";
import { useAuthStore } from "../../../lib/store";
import useTrollFamilyActivity from "../../../hooks/useTrollFamilyActivity";
import { toast } from "sonner";
import { ArrowUp } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface ChatMessage {
  id: string;
  stream_id: string;
  user_id: string;
  username: string;
  content: string;
  created_at: string;
  avatar_url?: string;
}

const MESSAGE_LIFETIME_MS = 7000;

/**
 * Mobile battle chat — floating messages that fly up on the left side plus a
 * compact input bar pinned above the page footer. Messages are received via the
 * same realtime channel the desktop BattleChat uses, with one shared database row.
 */
export default function MobileBattleFloatingChat({
  battleId,
  challengerStream,
  currentStreamId: _currentStreamId,
  currentUserId,
  participantRole: _participantRole,
  broadcasterName,
}: {
  battleId: string;
  challengerStream: { id: string; title: string; user_id: string };
  opponentStream: { id: string; title: string; user_id: string };
  currentStreamId?: string;
  currentUserId?: string | null;
  participantRole?: string | null;
  broadcasterName?: string;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [nowMs, setNowMs] = useState(Date.now());
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const { profile } = useAuthStore();
  const { recordChatMessage } = useTrollFamilyActivity();
  const channelRef = useRef<any>(null);
  const profileUsername =
    (profile as any)?.username?.trim() ||
    (profile as any)?.display_name?.trim() ||
    null;
  const normalizeMessage = useCallback((raw: any): ChatMessage => {
    const rawUsername = raw.username || "";
    const isPlaceholder = rawUsername === "You" || rawUsername === "Unknown";
    const resolved =
      rawUsername && !isPlaceholder
        ? rawUsername
        : raw.user_id === currentUserId && profileUsername
        ? profileUsername
        : rawUsername || "Troll Citizen";
    return {
      id: raw.id,
      stream_id: raw.stream_id,
      user_id: raw.user_id,
      username: resolved,
      content: raw.content,
      created_at: raw.created_at,
      avatar_url: raw.avatar_url || undefined,
    };
  }, [currentUserId, profileUsername]);

  // Fetch recent messages.
  useEffect(() => {
    let cancelled = false;
    const fetchMessages = async () => {
      const { data, error } = await supabase
        .from("stream_chat")
        .select("id, stream_id, user_id, username, content, created_at, avatar_url")
        .eq("stream_id", challengerStream.id)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error || cancelled) return;
      const hydrated = (data as any[]).map(normalizeMessage).reverse();
      setMessages(hydrated);
    };
    fetchMessages();
    return () => {
      cancelled = true;
    };
  }, [challengerStream.id, normalizeMessage]);

  // Subscribe to realtime chat (postgres + broadcast).
  useEffect(() => {
    channelRef.current = supabase
      .channel(`battle-chat:${battleId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "stream_chat",
          filter: `stream_id=eq.${challengerStream.id}`,
        },
        (payload) => {
          const msg = normalizeMessage(payload.new);
          setMessages((prev) =>
            prev.some((m) => m.id === msg.id) ? prev : [...prev.slice(-19), msg]
          );
        }
      )
      .on("broadcast", { event: "chat_message" }, (payload) => {
        const msg = normalizeMessage(payload.payload);
        if (msg && msg.id) {
          setMessages((prev) =>
            prev.some((m) => m.id === msg.id) ? prev : [...prev.slice(-19), msg]
          );
        }
      })
      .subscribe();

    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
  }, [battleId, challengerStream.id, normalizeMessage]);

  // Prune expired messages so they fly up and fade out.
  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const visibleMessages = messages
    .filter((msg) => Number.isFinite(new Date(msg.created_at).getTime()) && nowMs - new Date(msg.created_at).getTime() < MESSAGE_LIFETIME_MS)
    .slice(-6);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const content = newMessage.trim();
    if (!content || !currentUserId || sending) return;

    const senderUsername = profileUsername || "Troll Citizen";
    setSending(true);
    try {
      const { data: inserted, error } = await supabase
        .from("stream_chat")
        .insert({
        stream_id: challengerStream.id,
        user_id: currentUserId,
        username: senderUsername,
        content,
      })
        .select("id, stream_id, user_id, username, content, created_at, avatar_url")
        .single();

      if (error) throw error;

      const message = normalizeMessage(inserted);
      setMessages((prev) =>
        prev.some((item) => item.id === message.id) ? prev : [...prev.slice(-19), message]
      );
      setNewMessage("");
      try {
        const broadcastStatus = await channelRef.current?.send({
          type: "broadcast",
          event: "chat_message",
          payload: inserted,
        });
        if (broadcastStatus && broadcastStatus !== "ok") {
          console.warn("[MobileBattleChat] Realtime broadcast failed; message is saved:", broadcastStatus);
        }
      } catch (broadcastError) {
        console.warn("[MobileBattleChat] Realtime broadcast failed; message is saved:", broadcastError);
      }

      try {
        await recordChatMessage(content.length, battleId);
      } catch (activityError) {
        console.error("[MobileBattleChat] Failed to record chat activity:", activityError);
      }
    } catch (error) {
      console.error("Error sending battle message:", error);
      toast.error("Failed to send message");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="relative z-30 shrink-0">
      {/* Floating messages — rise from the input up toward the header, then fade out */}
      <div className="pointer-events-none absolute inset-x-0 bottom-full mb-1 flex flex-col items-start justify-end gap-1 px-2">
        <AnimatePresence initial={false}>
          {visibleMessages.map((msg) => {
            const _isCurrentUser = msg.user_id === currentUserId;
            return (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 0 }}
                animate={{ opacity: [0, 1, 1, 0], y: [0, 0, "-40vh", "-80vh"] }}
                exit={{ opacity: 0 }}
                transition={{ duration: 7, times: [0, 0.12, 0.55, 1], ease: "easeOut" }}
                className="max-w-[80%] rounded-2xl bg-black/55 px-2.5 py-1.5 backdrop-blur-sm"
              >
                <span className="text-[10px] font-bold text-amber-300">{msg.username}</span>
                <span className="ml-1.5 text-xs text-white">{msg.content}</span>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Input bar */}
      <div
        className="border-t border-white/10 bg-[#0B1020] px-2 pt-1"
        style={{ paddingBottom: "calc(0.25rem + env(safe-area-inset-bottom))" }}
      >
        <div className="px-1 pb-1 text-[10px] font-bold uppercase tracking-wider text-white/60">
          {broadcasterName || challengerStream.title || "Battle"}
        </div>
        <form onSubmit={sendMessage} className="flex items-center gap-2 pb-0.5">
          <input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Send a battle message…"
            className="min-w-0 flex-1 rounded-full bg-white/10 px-3 py-1.5 text-xs text-white placeholder-white/40 outline-none focus:bg-white/15"
          />
          <button
            type="submit"
            disabled={!newMessage.trim() || sending}
            aria-label="Send"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/15 text-white active:scale-95 disabled:opacity-50"
          >
            <ArrowUp size={16} />
          </button>
        </form>
      </div>
    </div>
  );
}
