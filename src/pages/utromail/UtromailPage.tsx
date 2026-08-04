// ============================================================
// UTROMAIL - MESSENGER PAGE (Conversation List + Chat Panel)
// ============================================================

import React, { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useAuthStore } from "@/lib/store";
import { supabase } from "@/lib/supabase";
import {
  Search,
  PenSquare,
  ArrowLeft,
  Send,
  Smile,
  Image,
  Loader2,
  Phone,
  Video,
  CheckCheck,
  Check,
  Ban,
  Flag,
  Trash2,
} from "lucide-react";
import {
  getThreads,
  getMessageRequests,
  getUnreadCount,
  getThreadMessages,
  sendMessage,
  markThreadAsRead,
  deleteThread,
  getUtromailAccount,
  blockUser,
  reportMessage,
} from "@/services/utromailService";
import type {
  UtromailThread,
  UtromailRequest,
  UtromailMessage,
} from "@/types/mail";
import { usePresenceStore } from "@/lib/presenceStore";
import UtromailCompose from "./UtromailCompose";
import { toast } from "sonner";

const glass =
  "border border-white/10 bg-[#070b19]/70 backdrop-blur-2xl shadow-[0_20px_80px_rgba(0,0,0,0.45)]";

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60000) return "Just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000)
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function formatMessageTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getOtherParticipant(thread: UtromailThread, userId: string) {
  // Use the pre-computed flat fields from getThreads
  if (thread.other_user_id) {
    return {
      user_id: thread.other_user_id,
      username: thread.other_username || "Unknown",
      display_name:
        thread.other_display_name || thread.other_username || "Unknown",
      avatar_url: thread.other_avatar_url || null,
      utromail_address: thread.other_utromail_address || null,
    };
  }

  // Fallback to members array
  const members = thread.members || [];
  if (members.length === 0) return null;
  const seen = new Set<string>();
  const uniqueMembers = members.filter((m) => {
    if (seen.has(m.user_id)) return false;
    seen.add(m.user_id);
    return true;
  });
  const other = uniqueMembers.find((m) => m.user_id !== userId);
  return other || uniqueMembers[0] || null;
}

export default function UtromailPage() {
  const navigate = useNavigate();
  const { threadId } = useParams();
  const [searchParams] = useSearchParams();
  const { user, profile } = useAuthStore();
  const onlineUserIds = usePresenceStore(s => s.onlineUserIds);
  const [threads, setThreads] = useState<UtromailThread[]>([]);
  const [requests, setRequests] = useState<UtromailRequest[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<
    string | null
  >(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectMode, setSelectMode] = useState(false);
  const [selectedThreadIds, setSelectedThreadIds] = useState<Set<string>>(
    new Set(),
  );
  const [showCompose, setShowCompose] = useState(false);
  const [showMobileChat, setShowMobileChat] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [userMailAddress, setUserMailAddress] = useState<string>("");
  const [contextMenu, setContextMenu] = useState<{
    threadId: string;
    otherUserId: string;
    otherUsername: string;
    x: number;
    y: number;
  } | null>(null);

  // Chat state
  const [messages, setMessages] = useState<UtromailMessage[]>([]);
  const [msgLoading, setMsgLoading] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const [isOtherTyping, setIsOtherTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sentMessageIdsRef = useRef<Set<string>>(new Set());

  // Fetch user's utromail address
  useEffect(() => {
    if (user?.id) {
      getUtromailAccount(user.id).then((account) => {
        if (account) {
          setUserMailAddress(account.mail_address);
        }
      });
    }
  }, [user?.id]);

  const senderMail =
    userMailAddress || `${profile?.username || "user"}@utromail`;

  const fetchThreadsRef = useRef<() => Promise<void>>();

  const fetchThreads = useCallback(async () => {
    if (!user?.id) return;
    try {
      const [threadsData, requestsData, countData] = await Promise.all([
        getThreads(user.id, "inbox"),
        getMessageRequests(user.id),
        getUnreadCount(user.id),
      ]);
      setThreads(threadsData);
      setRequests(requestsData);
      setUnreadCount(countData);
    } catch (err) {
      console.error("Error fetching threads:", err);
    } finally {
      setLoading(false);
    }
  }, [user?.id, refreshKey]);

  // Keep ref updated so realtime subscriptions always have latest version
  fetchThreadsRef.current = fetchThreads;

  useEffect(() => {
    fetchThreads();
  }, [fetchThreads]);

  // Fetch messages when active conversation changes
  useEffect(() => {
    if (!activeConversationId || !user?.id) {
      setMessages([]);
      return;
    }

    const fetchMessages = async () => {
      setMsgLoading(true);
      try {
        const msgs = await getThreadMessages(activeConversationId);
        // Fetch read status for these messages from utromail_read_status
        const msgIds = msgs.map((m) => m.id);
        let readMap: Record<string, boolean> = {};
        if (msgIds.length > 0) {
          const { data: readRows } = await supabase
            .from("utromail_read_status")
            .select("message_id")
            .in("message_id", msgIds)
            .eq("user_id", user.id);
          if (readRows) {
            readMap = Object.fromEntries(
              readRows.map((r) => [r.message_id, true]),
            );
          }
        }
        const msgsWithRead = msgs.map((m) => ({
          ...m,
          is_read: !!readMap[m.id] || !!m.is_read,
        }));
        setMessages(msgsWithRead);
        await markThreadAsRead(activeConversationId, user.id);
        // Mark unread messages from other user as read
        const unreadFromOther = msgs.filter(
          (m) => m.sender_id !== user.id && !readMap[m.id],
        );
        if (unreadFromOther.length > 0) {
          await supabase.from("utromail_read_status").upsert(
            unreadFromOther.map((m) => ({
              message_id: m.id,
              user_id: user.id,
              read_at: new Date().toISOString(),
            })),
            { onConflict: "message_id,user_id" },
          );
        }
        fetchThreads();
      } catch (err) {
        console.error("Error fetching messages:", err);
      } finally {
        setMsgLoading(false);
      }
    };

    fetchMessages();
  }, [activeConversationId, user?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Polling fallback: refresh active conversation messages every 30 seconds (reduced frequency)
  useEffect(() => {
    if (!activeConversationId || !user?.id) return;

    const pollInterval = setInterval(async () => {
      try {
        const msgs = await getThreadMessages(activeConversationId);
        setMessages((prev) => {
          if (msgs.length !== prev.length) return msgs;
          const prevIds = new Set(prev.map((m) => m.id));
          const hasNew = msgs.some((m) => !prevIds.has(m.id));
          return hasNew ? msgs : prev;
        });
      } catch (err) {
        console.error("Poll fetch error:", err);
      }
    }, 30000);

    return () => clearInterval(pollInterval);
  }, [activeConversationId, user?.id]);

  // Polling fallback: refresh thread list every 60 seconds (reduced frequency)
  useEffect(() => {
    if (!user?.id) return;

    const pollInterval = setInterval(() => {
      fetchThreadsRef.current?.();
    }, 60000);

    return () => clearInterval(pollInterval);
  }, [user?.id]);

  const handleSend = async () => {
    if (!replyText.trim() || !activeConversationId || !user) return;
    const activeThread = threads.find((t) => t.id === activeConversationId);
    if (!activeThread) return;

    const lastMsg = messages[messages.length - 1];
    if (!lastMsg) return;

    const body = replyText.trim();
    setReplyText("");
    setSending(true);
    try {
      const recipientId =
        lastMsg.sender_id === user.id
          ? lastMsg.recipient_id!
          : lastMsg.sender_id;
      const recipientMail =
        lastMsg.sender_id === user.id
          ? lastMsg.recipient_mail_address!
          : lastMsg.sender_mail_address;
      const sentMsg = await sendMessage({
        senderId: user.id,
        senderMail,
        recipientId,
        recipientMail,
        subject: "Direct Message",
        body,
        parentMessageId: lastMsg.id,
      });
      // Track the sent message ID so the realtime handler skips it (prevents duplicate)
      if (sentMsg?.id) {
        sentMessageIdsRef.current.add(sentMsg.id);
        // Clean up tracking after 10s
        setTimeout(() => sentMessageIdsRef.current.delete(sentMsg.id), 10000);
      }
      fetchThreadsRef.current?.();
    } catch (err: any) {
      toast.error(err.message || "Failed to send");
      // Restore the text so user doesn't lose it
      setReplyText(body);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const openConversation = (threadId: string) => {
    setActiveConversationId(threadId);
    setShowMobileChat(true);
  };

  const closeMobileChat = () => {
    setShowMobileChat(false);
    setActiveConversationId(null);
  };

  // Real-time: watch for new message notifications for this user
  useEffect(() => {
    if (!user?.id) return;

    const notifChannel = supabase
      .channel(`utromail-notifs:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "utromail_notifications",
          filter: `user_id=eq.${user.id}`,
        },
        async (payload) => {
          const notif = payload.new as any;
          // Refresh the thread list sidebar
          fetchThreadsRef.current?.();
          // Auto-open the conversation if it's a new message from someone else
          // and the user isn't already viewing this thread
          if (notif?.message_id && notif.message_id !== activeConversationId) {
            try {
              const { data: msg } = await supabase
                .from("utromail_messages")
                .select("thread_id, sender_id")
                .eq("id", notif.message_id)
                .maybeSingle();
              if (
                msg &&
                msg.sender_id !== user.id &&
                msg.thread_id !== activeConversationId
              ) {
                setActiveConversationId(msg.thread_id);
                setShowMobileChat(true);
              }
            } catch (err) {
              console.error(
                "[UtromailPage] Error auto-opening conversation:",
                err,
              );
            }
          }
        },
      )
      .subscribe();

    return () => {
      if (notifChannel) {
        supabase.removeChannel(notifChannel);
      }
    };
  }, [user?.id, activeConversationId]);

  // Real-time: watch for new messages in the active thread
  useEffect(() => {
    if (!activeConversationId || !user?.id) return;

    const msgChannel = supabase
      .channel(`utromail-thread:${activeConversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "utromail_messages",
          filter: `thread_id=eq.${activeConversationId}`,
        },
        async (payload) => {
          try {
            const newMsg = payload.new as any;
            if (!newMsg) return;

            // Skip messages we just sent (they're already handled by realtime from DB)
            // But we still add them if they're not already in the list
            const isOwnMessage = newMsg.sender_id === user.id;

            // Fetch full message with all fields (realtime payload may not include all columns)
            const { data: fullMsg } = await supabase
              .from("utromail_messages")
              .select("*")
              .eq("id", newMsg.id)
              .maybeSingle();

            const msgData = fullMsg || newMsg;

            // Skip if this message was just sent by us and is already tracked
            if (isOwnMessage && sentMessageIdsRef.current.has(msgData.id)) {
              // Still add it to the messages list if not already there
              setMessages((prev) => {
                if (prev.some((m) => m.id === msgData.id)) return prev;
                const mappedMsg: UtromailMessage = {
                  id: msgData.id,
                  thread_id: msgData.thread_id,
                  sender_id: msgData.sender_id,
                  sender_mail_address: msgData.sender_mail_address,
                  recipient_id: msgData.recipient_id,
                  recipient_mail_address: msgData.recipient_mail_address,
                  subject: msgData.subject,
                  body: msgData.body,
                  body_html: msgData.body_html,
                  message_type: msgData.message_type,
                  is_starred: false,
                  is_draft: false,
                  parent_message_id: msgData.parent_message_id,
                  sent_at: msgData.sent_at,
                  created_at: msgData.created_at,
                  updated_at: msgData.updated_at,
                  sender_name:
                    profile?.display_name || profile?.username || null,
                  sender_username: profile?.username || null,
                  sender_avatar: profile?.avatar_url || null,
                  is_read: false,
                };
                return [...prev, mappedMsg];
              });
              sentMessageIdsRef.current.delete(msgData.id);
              return;
            }

            // Skip own messages that aren't tracked (already in UI)
            if (isOwnMessage) return;

            const { data: senderProfile } = await supabase
              .from("user_profiles")
              .select("username, display_name, avatar_url")
              .eq("id", msgData.sender_id)
              .maybeSingle();

            const mappedMsg: UtromailMessage = {
              id: msgData.id,
              thread_id: msgData.thread_id,
              sender_id: msgData.sender_id,
              sender_mail_address: msgData.sender_mail_address,
              recipient_id: msgData.recipient_id,
              recipient_mail_address: msgData.recipient_mail_address,
              subject: msgData.subject,
              body: msgData.body,
              body_html: msgData.body_html,
              message_type: msgData.message_type,
              is_starred: false,
              is_draft: false,
              parent_message_id: msgData.parent_message_id,
              sent_at: msgData.sent_at,
              created_at: msgData.created_at,
              updated_at: msgData.updated_at,
              sender_name:
                (senderProfile as any)?.display_name ||
                (senderProfile as any)?.username ||
                null,
              sender_username: (senderProfile as any)?.username || null,
              sender_avatar: (senderProfile as any)?.avatar_url || null,
              is_read: false,
            };

            setMessages((prev) => {
              if (prev.some((m) => m.id === mappedMsg.id)) return prev;
              return [...prev, mappedMsg];
            });

            await markThreadAsRead(activeConversationId, user.id);
            fetchThreadsRef.current?.();
          } catch (err) {
            console.error(
              "[UtromailPage] Realtime message handler error:",
              err,
            );
          }
        },
      )
      .subscribe();

    return () => {
      if (msgChannel) {
        supabase.removeChannel(msgChannel);
      }
    };
  }, [activeConversationId, user?.id]);

  // Typing indicator: broadcast when user types
  const broadcastTyping = () => {
    if (!activeConversationId || !user?.id) return;
    const thread = threads.find((t) => t.id === activeConversationId);
    if (!thread?.other_user_id) return;
    const typingCh = supabase.channel(
      `utromail-typing:${activeConversationId}`,
      {
        config: { broadcast: { self: false } },
      },
    );
    typingCh.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await typingCh.send({
          type: "broadcast",
          event: "typing",
          payload: { userId: user.id, isTyping: true },
        });
      }
    });
  };

  // Typing indicator: listen for other user typing
  useEffect(() => {
    if (!activeConversationId || !user?.id) return;
    const thread = threads.find((t) => t.id === activeConversationId);
    const otherUserId = thread?.other_user_id;
    if (!otherUserId) return;

    const typingChannel = supabase.channel(
      `utromail-typing:${activeConversationId}`,
      {
        config: { broadcast: { self: false } },
      },
    );

    typingChannel
      .on("broadcast", { event: "typing" }, (payload: any) => {
        const { userId: typingUserId, isTyping } = payload.payload || {};
        if (
          typingUserId &&
          typingUserId !== user.id &&
          typingUserId === otherUserId
        ) {
          setIsOtherTyping(!!isTyping);
        }
      })
      .subscribe();

    return () => {
      if (typingChannel) {
        supabase.removeChannel(typingChannel);
      }
    };
  }, [activeConversationId, user?.id, threads]);

  // Clear typing indicator after inactivity
  useEffect(() => {
    if (!isOtherTyping) return;
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => setIsOtherTyping(false), 5000);
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, [isOtherTyping]);

  // Mark messages as read when viewing (read receipts)
  useEffect(() => {
    if (!activeConversationId || !user?.id || messages.length === 0) return;

    // Find unread messages from the other user
    const unreadFromOther = messages.filter(
      (m) => m.sender_id !== user.id && !m.is_read,
    );

    if (unreadFromOther.length === 0) return;

    // Mark them as read using utromail_read_status (no realtime trigger on utromail_messages)
    const markRead = async () => {
      try {
        const readStatusRows = unreadFromOther.map((m) => ({
          message_id: m.id,
          user_id: user.id,
          read_at: new Date().toISOString(),
        }));
        await supabase.from("utromail_read_status").upsert(readStatusRows, {
          onConflict: "message_id,user_id",
        });
        // Update local state to reflect read status
        const readIds = new Set(unreadFromOther.map((m) => m.id));
        setMessages((prev) =>
          prev.map((m) => (readIds.has(m.id) ? { ...m, is_read: true } : m)),
        );
        // Also update thread read status in sidebar
        await markThreadAsRead(activeConversationId, user.id);
        fetchThreadsRef.current?.();
      } catch (err) {
        console.error("[UtromailPage] Error marking messages as read:", err);
      }
    };
    markRead();
  }, [activeConversationId, user?.id, messages.length]);

  const deleteThreads = async (threadIds: string[]) => {
    if (!user?.id || threadIds.length === 0) return;

    const confirmed = window.confirm(
      `Delete ${threadIds.length} conversation${threadIds.length === 1 ? "" : "s"}?`,
    );
    if (!confirmed) return;

    try {
      await Promise.all(
        threadIds.map((threadId) => deleteThread(threadId, user.id)),
      );
      toast.success("Conversation deleted");
      setThreads((prev) =>
        prev.filter((thread) => !threadIds.includes(thread.id)),
      );
      if (activeConversationId && threadIds.includes(activeConversationId)) {
        closeMobileChat();
      }
      fetchThreadsRef.current?.();
    } catch (err: any) {
      toast.error(err?.message || "Failed to delete");
    }
  };

  const handleDeleteConversation = () => {
    if (!activeConversationId) return;
    void deleteThreads([activeConversationId]);
  };

  const activeThread = threads.find((t) => t.id === activeConversationId);

  const filteredThreads = threads.filter((t) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const lastMsgPreview = t.last_message?.body?.toLowerCase() || "";
    const participant = getOtherParticipant(t, user?.id || "");
    const nameMatch =
      participant?.display_name?.toLowerCase().includes(q) ||
      participant?.username?.toLowerCase().includes(q) ||
      false;
    return (
      lastMsgPreview.includes(q) ||
      nameMatch ||
      t.subject?.toLowerCase().includes(q)
    );
  });

  const filteredThreadIds = filteredThreads.map((thread) => thread.id);
  const allFilteredThreadsSelected =
    filteredThreadIds.length > 0 &&
    filteredThreadIds.every((threadId) => selectedThreadIds.has(threadId));

  const toggleThreadSelection = (threadId: string) => {
    setSelectedThreadIds((prev) => {
      const next = new Set(prev);
      if (next.has(threadId)) {
        next.delete(threadId);
      } else {
        next.add(threadId);
      }
      return next;
    });
  };

  const toggleAllFilteredThreads = () => {
    setSelectedThreadIds((prev) => {
      if (
        prev.size === filteredThreadIds.length &&
        allFilteredThreadsSelected
      ) {
        return new Set();
      }
      return new Set(filteredThreadIds);
    });
  };

  const handleDeleteFilteredThreads = () => {
    if (selectedThreadIds.size === 0) return;
    void deleteThreads(Array.from(selectedThreadIds));
  };

  const handleDeleteAllFilteredThreads = () => {
    if (filteredThreadIds.length === 0) return;
    void deleteThreads(filteredThreadIds);
  };

  // Auto-open compose when navigating from marketplace or other external links
  const recipientId =
    searchParams.get("recipientId") ||
    searchParams.get("recipient") ||
    searchParams.get("user") ||
    undefined;
  const subject = searchParams.get("subject") || undefined;
  const autoCompose = !!(recipientId && threadId === undefined);

  // Full-screen compose
  if (showCompose || autoCompose) {
    const replyTo = recipientId
      ? { recipientId, subject, recipientMail: undefined }
      : undefined;
    return (
      <UtromailCompose
        replyTo={replyTo}
        onSent={() => {
          setShowCompose(false);
          setRefreshKey((k) => k + 1);
        }}
        onCancel={() => {
          setShowCompose(false);
          navigate("/utromail");
        }}
      />
    );
  }

  const activeParticipant = activeThread
    ? getOtherParticipant(activeThread, user?.id || "")
    : null;
  const isActiveUserOnline =
    activeThread?.other_user_id != null &&
    onlineUserIds.has(activeThread.other_user_id);
  const isActiveParticipantOnline =
    activeParticipant?.user_id != null &&
    onlineUserIds.has(activeParticipant.user_id);

  const chatPanel = activeConversationId ? (
    <div className="flex h-full min-h-0 flex-col bg-[#050713]">
      {/* Conversation header */}
      <header className="relative z-20 flex min-h-[76px] items-center justify-between border-b border-fuchsia-500/15 bg-[#080a18]/95 px-3 py-3 backdrop-blur-2xl sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={closeMobileChat}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-slate-300 transition hover:border-fuchsia-400/40 hover:bg-fuchsia-500/10 hover:text-white lg:hidden"
            aria-label="Back to conversations"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>

          {activeThread && (
            <>
              <div className="relative shrink-0">
                <div className="absolute -inset-1 rounded-full bg-gradient-to-br from-fuchsia-500 via-purple-500 to-lime-400 opacity-80 blur-[2px]" />
                {activeThread.other_avatar_url ? (
                  <img
                    src={activeThread.other_avatar_url}
                    alt=""
                    className="relative h-12 w-12 rounded-full border-2 border-[#080a18] object-cover"
                  />
                ) : (
                  <div className="relative flex h-12 w-12 items-center justify-center rounded-full border-2 border-[#080a18] bg-gradient-to-br from-fuchsia-500 to-purple-700 text-base font-black text-white">
                    {(activeThread.other_username || "?")[0].toUpperCase()}
                  </div>
                )}
                  {isActiveUserOnline && (
                    <span className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-[3px] border-[#080a18] bg-lime-400" />
                  )}
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="truncate text-sm font-black tracking-wide text-white sm:text-base">
                    {activeThread.other_display_name ||
                      activeThread.other_username ||
                      "Unknown"}
                  </h2>
                  <span className="hidden rounded-full border border-fuchsia-400/25 bg-fuchsia-500/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.16em] text-fuchsia-300 sm:inline-flex">
                    City member
                  </span>
                </div>
                {isOtherTyping ? (
                  <p className="mt-0.5 flex items-center gap-1.5 text-[11px] font-bold text-lime-400">
                    <span className="inline-flex gap-1">
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-lime-400" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-lime-400 [animation-delay:120ms]" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-lime-400 [animation-delay:240ms]" />
                    </span>
                    typing now
                  </p>
                ) : (
                  <p className="truncate text-[11px] text-slate-500">
                    {activeThread.other_utromail_address ||
                      "Active in Mai Troll"}
                  </p>
                )}
              </div>
            </>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-slate-300 transition hover:border-lime-400/40 hover:bg-lime-400/10 hover:text-lime-300"
            aria-label="Start voice call"
          >
            <Phone className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-slate-300 transition hover:border-fuchsia-400/40 hover:bg-fuchsia-500/10 hover:text-fuchsia-300"
            aria-label="Start video call"
          >
            <Video className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={handleDeleteConversation}
            className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-slate-400 transition hover:border-red-400/40 hover:bg-red-500/10 hover:text-red-300"
            aria-label="Delete conversation"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Message stage */}
      <div className="relative min-h-0 flex-1 overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_5%,rgba(168,85,247,0.13),transparent_32%),radial-gradient(circle_at_80%_80%,rgba(132,204,22,0.06),transparent_28%),linear-gradient(180deg,#060816_0%,#04050d_100%)]" />
        <div className="pointer-events-none absolute inset-0 opacity-[0.035] [background-image:linear-gradient(rgba(255,255,255,.45)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.45)_1px,transparent_1px)] [background-size:32px_32px]" />

        <div className="relative h-full overflow-y-auto px-3 py-5 sm:px-6 sm:py-7">
          {msgLoading ? (
            <div className="flex h-full items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-7 w-7 animate-spin text-fuchsia-400" />
                <span className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">
                  Loading street chat
                </span>
              </div>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex h-full items-center justify-center text-center">
              <div className="max-w-sm rounded-3xl border border-white/10 bg-white/[0.035] p-8 backdrop-blur-xl">
                <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl border border-fuchsia-400/25 bg-fuchsia-500/10 shadow-[0_0_35px_rgba(217,70,239,0.12)]">
                  <Send className="h-7 w-7 text-fuchsia-300" />
                </div>
                <h3 className="mt-5 text-lg font-black text-white">
                  Start the conversation
                </h3>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  Send the first message and build your city connection.
                </p>
              </div>
            </div>
          ) : (
            <div className="mx-auto flex w-full max-w-4xl flex-col gap-1.5">
              <div className="mb-6 flex items-center gap-3">
                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-white/5" />
                <span className="rounded-full border border-white/10 bg-[#0b0d1d]/80 px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">
                  Today
                </span>
                <div className="h-px flex-1 bg-gradient-to-l from-transparent via-white/10 to-white/5" />
              </div>

              {messages.map((msg, idx) => {
                const isOwn = msg.sender_id === user?.id;
                const previous = messages[idx - 1];
                const next = messages[idx + 1];
                const startsGroup =
                  !previous || previous.sender_id !== msg.sender_id;
                const endsGroup = !next || next.sender_id !== msg.sender_id;

                return (
                  <div
                    key={msg.id}
                    className={`flex items-end gap-2.5 ${isOwn ? "justify-end" : "justify-start"} ${startsGroup && idx > 0 ? "mt-4" : ""}`}
                  >
                    {!isOwn && (
                      <div className="w-9 shrink-0 self-end">
                        {endsGroup &&
                          (msg.sender_avatar ? (
                            <img
                              src={msg.sender_avatar}
                              alt=""
                              className="h-9 w-9 rounded-full border border-fuchsia-400/25 object-cover"
                            />
                          ) : (
                            <div className="flex h-9 w-9 items-center justify-center rounded-full border border-fuchsia-400/25 bg-gradient-to-br from-fuchsia-500 to-purple-700 text-xs font-black text-white">
                              {(msg.sender_name ||
                                msg.sender_username ||
                                "?")[0].toUpperCase()}
                            </div>
                          ))}
                      </div>
                    )}

                    <div
                      className={`flex max-w-[82%] flex-col sm:max-w-[72%] ${isOwn ? "items-end" : "items-start"}`}
                    >
                      {startsGroup && !isOwn && (
                        <span className="mb-1.5 ml-1 text-[10px] font-black uppercase tracking-[0.14em] text-fuchsia-300/80">
                          {msg.sender_name ||
                            msg.sender_username ||
                            activeThread?.other_username ||
                            "City member"}
                        </span>
                      )}

                      <div
                        className={`relative px-4 py-3 text-sm leading-6 shadow-xl ${
                          isOwn
                            ? `border border-fuchsia-400/35 bg-gradient-to-br from-fuchsia-600/90 to-purple-700/90 text-white shadow-fuchsia-950/30 ${startsGroup ? "rounded-t-2xl" : "rounded-t-lg"} ${endsGroup ? "rounded-bl-2xl rounded-br-md" : "rounded-b-lg"}`
                            : `border border-white/10 bg-[#111426]/95 text-slate-100 shadow-black/30 ${startsGroup ? "rounded-t-2xl" : "rounded-t-lg"} ${endsGroup ? "rounded-br-2xl rounded-bl-md" : "rounded-b-lg"}`
                        }`}
                      >
                        <p className="whitespace-pre-wrap break-words">
                          {msg.body}
                        </p>
                      </div>

                      {endsGroup && (
                        <div
                          className={`mt-1.5 flex items-center gap-1.5 px-1 text-[10px] text-slate-600 ${isOwn ? "justify-end" : "justify-start"}`}
                        >
                          <span>{formatMessageTime(msg.sent_at)}</span>
                          {isOwn &&
                            (msg.is_read ? (
                              <CheckCheck
                                className="h-3.5 w-3.5 text-lime-400"
                                aria-label="Read"
                              />
                            ) : (
                              <Check
                                className="h-3.5 w-3.5 text-slate-500"
                                aria-label="Sent"
                              />
                            ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {isOtherTyping && (
                <div className="mt-3 flex items-end gap-2.5">
                  <div className="h-9 w-9" />
                  <div className="flex items-center gap-1 rounded-2xl rounded-bl-md border border-white/10 bg-[#111426] px-4 py-3">
                    <span className="h-2 w-2 animate-bounce rounded-full bg-fuchsia-400" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-fuchsia-400 [animation-delay:120ms]" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-fuchsia-400 [animation-delay:240ms]" />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
      </div>

      {/* Composer */}
      <footer className="relative z-20 border-t border-fuchsia-500/15 bg-[#080a18]/95 p-3 backdrop-blur-2xl sm:p-4">
        <div className="mx-auto flex max-w-4xl items-end gap-2 rounded-2xl border border-white/10 bg-white/[0.035] p-2 shadow-[0_14px_40px_rgba(0,0,0,0.28)] focus-within:border-fuchsia-400/40 focus-within:shadow-[0_0_28px_rgba(217,70,239,0.10)]">
          <button
            type="button"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-slate-400 transition hover:bg-fuchsia-500/10 hover:text-fuchsia-300"
            aria-label="Attach image"
          >
            <Image className="h-5 w-5" />
          </button>
          <button
            type="button"
            className="hidden h-10 w-10 shrink-0 place-items-center rounded-xl text-slate-400 transition hover:bg-lime-400/10 hover:text-lime-300 sm:grid"
            aria-label="Add emoji"
          >
            <Smile className="h-5 w-5" />
          </button>
          <textarea
            ref={inputRef}
            value={replyText}
            onChange={(event) => {
              setReplyText(event.target.value);
              if (event.target.value.length > 0) broadcastTyping();
            }}
            onKeyDown={handleKeyDown}
            placeholder={`Message ${activeThread?.other_username || "city member"}...`}
            rows={1}
            className="max-h-36 min-h-[40px] flex-1 resize-none bg-transparent px-2 py-2.5 text-sm leading-5 text-white outline-none placeholder:text-slate-600"
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={sending || !replyText.trim()}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-fuchsia-300/30 bg-gradient-to-br from-fuchsia-500 to-purple-700 text-white shadow-[0_0_22px_rgba(217,70,239,0.28)] transition hover:scale-[1.04] hover:shadow-[0_0_30px_rgba(217,70,239,0.4)] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100"
            aria-label="Send message"
          >
            {sending ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Send className="h-5 w-5" />
            )}
          </button>
        </div>
        <p className="mt-2 hidden text-center text-[9px] font-bold uppercase tracking-[0.18em] text-slate-700 sm:block">
          Enter to send · Shift + Enter for a new line
        </p>
      </footer>
    </div>
  ) : (
    <div className="relative flex h-full min-h-[520px] items-center justify-center overflow-hidden bg-[#050713] p-6 text-center">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(217,70,239,0.16),transparent_25%),radial-gradient(circle_at_50%_60%,rgba(132,204,22,0.06),transparent_30%)]" />
      <div className="relative max-w-md">
        <div className="mx-auto grid h-24 w-24 place-items-center rounded-[28px] border border-fuchsia-400/25 bg-gradient-to-br from-fuchsia-500/15 to-purple-700/10 shadow-[0_0_60px_rgba(217,70,239,0.15)]">
          <Send className="h-10 w-10 text-fuchsia-300" />
        </div>
        <p className="mt-6 text-[10px] font-black uppercase tracking-[0.3em] text-lime-400">
          Mai Troll communication grid
        </p>
        <h2 className="mt-3 text-3xl font-black tracking-tight text-white">
          Your city conversations live here.
        </h2>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-slate-400">
          Choose a street on the left or start a new message to connect with
          someone across the city.
        </p>
        <button
          type="button"
          onClick={() => setShowCompose(true)}
          className="mt-7 inline-flex items-center gap-2 rounded-xl border border-lime-400/35 bg-lime-400/10 px-5 py-3 text-sm font-black text-lime-300 transition hover:bg-lime-400/15"
        >
          <PenSquare className="h-4 w-4" />
          Start a new message
        </button>
      </div>
    </div>
  );

  return (
    <div className="relative h-full min-h-0 overflow-hidden bg-[#03040a] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_5%,rgba(132,204,22,0.08),transparent_22%),radial-gradient(circle_at_80%_0%,rgba(217,70,239,0.12),transparent_27%)]" />

      <div className="relative mx-auto flex h-full min-h-0 w-full max-w-[1680px] flex-col px-2 py-2 sm:px-3 sm:py-3 lg:px-4">
        {/* Page title strip */}
        <div className="mb-3 hidden shrink-0 items-end justify-between px-1 lg:flex">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-black italic tracking-tight text-white">
                CITY <span className="text-lime-400">MESSAGES</span>
              </h1>
              <span className="rounded-full border border-fuchsia-400/25 bg-fuchsia-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-fuchsia-300">
                Live network
              </span>
            </div>
            <p className="mt-1 text-xs font-medium text-slate-500">
              Talk trash. Build up. Rule the city.
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span>
              <strong className="text-white">{threads.length}</strong> streets
            </span>
            <span className="h-4 w-px bg-white/10" />
            <span>
              <strong className="text-lime-400">{unreadCount}</strong> unread
            </span>
          </div>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-[330px_minmax(0,1fr)] xl:grid-cols-[340px_minmax(0,1fr)_280px]">
          {/* Conversation rail */}
          <aside
            className={`${glass} min-h-0 overflow-hidden rounded-2xl border-white/[0.08] bg-[#070913]/95 ${showMobileChat ? "hidden lg:flex" : "flex"} flex-col`}
          >
            <div className="border-b border-white/[0.08] p-3.5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.24em] text-lime-400">
                    My streets
                  </p>
                  <h2 className="mt-1 text-xl font-black text-white">
                    Messages
                  </h2>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectMode((value) => !value);
                      setSelectedThreadIds(new Set());
                    }}
                    className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-[11px] font-black text-slate-300 transition hover:border-white/20 hover:bg-white/[0.08] hover:text-white"
                  >
                    {selectMode ? "Done" : "Select"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCompose(true)}
                    className="grid h-10 w-10 place-items-center rounded-xl border border-lime-400/35 bg-lime-400/10 text-lime-300 transition hover:bg-lime-400/20"
                    aria-label="New message"
                  >
                    <PenSquare className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="relative mt-4">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  type="search"
                  placeholder="Search streets..."
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  className="h-11 w-full rounded-xl border border-white/10 bg-[#03050d]/80 pl-10 pr-4 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-fuchsia-400/40 focus:ring-2 focus:ring-fuchsia-500/10"
                />
              </div>
            </div>

            {selectMode && (
              <div className="border-b border-red-500/15 bg-red-500/[0.06] p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-black text-red-200">
                    {selectedThreadIds.size} selected
                  </span>
                  <button
                    type="button"
                    onClick={toggleAllFilteredThreads}
                    className="text-[10px] font-black uppercase tracking-wider text-slate-300 hover:text-white"
                  >
                    {allFilteredThreadsSelected ? "Clear all" : "Select all"}
                  </button>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={handleDeleteFilteredThreads}
                    disabled={selectedThreadIds.size === 0}
                    className="rounded-lg bg-red-500 px-3 py-2 text-[10px] font-black uppercase tracking-wide text-white disabled:opacity-40"
                  >
                    Delete selected
                  </button>
                  <button
                    type="button"
                    onClick={handleDeleteAllFilteredThreads}
                    disabled={filteredThreadIds.length === 0}
                    className="rounded-lg border border-red-400/25 bg-red-500/10 px-3 py-2 text-[10px] font-black uppercase tracking-wide text-red-200 disabled:opacity-40"
                  >
                    Delete all
                  </button>
                </div>
              </div>
            )}

            {requests.length > 0 && (
              <div className="border-b border-white/[0.06] p-3">
                <button
                  type="button"
                  onClick={() => navigate("/utromail/requests")}
                  className="flex w-full items-center gap-3 rounded-xl border border-amber-400/20 bg-amber-400/[0.07] p-3 text-left transition hover:bg-amber-400/10"
                >
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-amber-400/15 text-sm font-black text-amber-300">
                    !
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-black text-amber-200">
                      Message requests
                    </p>
                    <p className="mt-0.5 text-[10px] text-amber-300/60">
                      Review people outside your streets
                    </p>
                  </div>
                  <span className="rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-black text-[#251400]">
                    {requests.length}
                  </span>
                </button>
              </div>
            )}

            <div className="min-h-0 flex-1 overflow-y-auto p-2">
              {loading ? (
                <div className="flex h-40 items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-fuchsia-400" />
                </div>
              ) : filteredThreads.length === 0 ? (
                <div className="px-6 py-14 text-center">
                  <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-white/[0.04]">
                    <Search className="h-5 w-5 text-slate-600" />
                  </div>
                  <p className="mt-4 text-sm font-bold text-slate-300">
                    No streets found
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowCompose(true)}
                    className="mt-2 text-xs font-black text-lime-400 hover:text-lime-300"
                  >
                    Start a conversation
                  </button>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {filteredThreads.map((thread) => {
                    const lastMsg = thread.last_message;
                    const isActive = activeConversationId === thread.id;
                    const isUnread = (thread.unread_count || 0) > 0;
                    const displayName =
                      thread.other_display_name ||
                      thread.other_username ||
                      "Unknown";
                    const avatarUrl = thread.other_avatar_url;
                     const avatarLetter =
                       displayName !== "Unknown"
                         ? displayName[0].toUpperCase()
                         : "?";
                     const isOtherOnline =
                       thread.other_user_id != null &&
                       onlineUserIds.has(thread.other_user_id);

                     return (
                      <button
                        key={thread.id}
                        type="button"
                        onClick={() => {
                          if (selectMode) {
                            toggleThreadSelection(thread.id);
                            return;
                          }
                          openConversation(thread.id);
                        }}
                        onContextMenu={(event) => {
                          event.preventDefault();
                          if (thread.other_user_id) {
                            setContextMenu({
                              threadId: thread.id,
                              otherUserId: thread.other_user_id,
                              otherUsername: thread.other_username || "Unknown",
                              x: event.clientX,
                              y: event.clientY,
                            });
                          }
                        }}
                        onTouchStart={(event) => {
                          const touch = event.touches[0];
                          const timer = setTimeout(() => {
                            if (thread.other_user_id) {
                              setContextMenu({
                                threadId: thread.id,
                                otherUserId: thread.other_user_id,
                                otherUsername:
                                  thread.other_username || "Unknown",
                                x: touch.clientX,
                                y: touch.clientY,
                              });
                            }
                          }, 600);
                          const cleanup = () => clearTimeout(timer);
                          event.currentTarget.addEventListener(
                            "touchend",
                            cleanup,
                            { once: true },
                          );
                          event.currentTarget.addEventListener(
                            "touchmove",
                            cleanup,
                            { once: true },
                          );
                        }}
                        className={`group relative flex w-full items-center gap-3 overflow-hidden rounded-2xl border p-3 text-left transition ${
                          selectedThreadIds.has(thread.id)
                            ? "border-red-400/45 bg-red-500/10"
                            : isActive
                              ? "border-fuchsia-400/45 bg-gradient-to-r from-fuchsia-500/15 to-purple-500/[0.06] shadow-[0_0_22px_rgba(217,70,239,0.08)]"
                              : "border-transparent hover:border-white/10 hover:bg-white/[0.035]"
                        }`}
                      >
                        {isActive && (
                          <span className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-lime-400 shadow-[0_0_10px_rgba(163,230,53,0.8)]" />
                        )}
                        {selectMode && (
                          <span
                            className={`grid h-6 w-6 shrink-0 place-items-center rounded-md border ${selectedThreadIds.has(thread.id) ? "border-red-400 bg-red-500 text-white" : "border-white/20 text-transparent"}`}
                          >
                            <Check className="h-4 w-4" />
                          </span>
                        )}
                        <div className="relative shrink-0">
                          {avatarUrl ? (
                            <img
                              src={avatarUrl}
                              alt=""
                              className={`h-12 w-12 rounded-full object-cover ${isActive ? "ring-2 ring-fuchsia-400 ring-offset-2 ring-offset-[#080a16]" : "ring-1 ring-white/10"}`}
                            />
                          ) : (
                            <div
                              className={`flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-fuchsia-500 to-purple-700 text-sm font-black text-white ${isActive ? "ring-2 ring-fuchsia-400 ring-offset-2 ring-offset-[#080a16]" : ""}`}
                            >
                              {avatarLetter}
                            </div>
                          )}
                          {isOtherOnline && (
                            <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-[#080a16] bg-lime-400" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p
                              className={`truncate text-sm ${isUnread ? "font-black text-white" : "font-bold text-slate-200"}`}
                            >
                              {displayName}
                            </p>
                            <span
                              className={`shrink-0 text-[10px] ${isUnread ? "font-bold text-fuchsia-300" : "text-slate-600"}`}
                            >
                              {thread.last_message_at
                                ? formatTime(thread.last_message_at)
                                : ""}
                            </span>
                          </div>
                          <div className="mt-1 flex items-center gap-2">
                            <p
                              className={`min-w-0 flex-1 truncate text-xs ${isUnread ? "font-semibold text-slate-200" : "text-slate-500"}`}
                            >
                              {lastMsg?.body || "No messages yet"}
                            </p>
                            {isUnread && (
                              <span className="grid min-w-5 place-items-center rounded-full bg-fuchsia-500 px-1.5 py-0.5 text-[9px] font-black text-white shadow-[0_0_12px_rgba(217,70,239,0.35)]">
                                {thread.unread_count}
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="border-t border-white/[0.08] p-3">
              <button
                type="button"
                onClick={() => setShowCompose(true)}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-fuchsia-400/30 bg-fuchsia-500/10 px-4 py-3 text-xs font-black uppercase tracking-[0.14em] text-fuchsia-200 transition hover:bg-fuchsia-500/15"
              >
                <PenSquare className="h-4 w-4" /> New message
              </button>
            </div>
          </aside>

          {/* Main chat */}
          <main
            className={`${glass} min-h-0 overflow-hidden rounded-2xl border-white/[0.08] bg-[#050713]/95 ${showMobileChat ? "flex" : "hidden lg:flex"} flex-col`}
          >
            {chatPanel}
          </main>

          {/* Profile rail */}
          <aside
            className={`${glass} hidden min-h-0 overflow-hidden rounded-2xl border-white/[0.08] bg-[#070913]/95 xl:flex xl:flex-col`}
          >
            {activeThread && activeParticipant ? (
              <>
                <div className="relative overflow-hidden border-b border-white/[0.08] px-5 pb-6 pt-7 text-center">
                  <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(217,70,239,0.22),transparent_45%)]" />
                  <div className="relative mx-auto w-fit">
                    <div className="absolute -inset-2 rounded-full bg-gradient-to-br from-fuchsia-500 via-purple-500 to-lime-400 opacity-70 blur" />
                    {activeThread.other_avatar_url ? (
                      <img
                        src={activeThread.other_avatar_url}
                        alt=""
                        className="relative h-24 w-24 rounded-full border-[3px] border-[#090b18] object-cover"
                      />
                    ) : (
                      <div className="relative flex h-24 w-24 items-center justify-center rounded-full border-[3px] border-[#090b18] bg-gradient-to-br from-fuchsia-500 to-purple-700 text-3xl font-black text-white">
                        {(activeParticipant.display_name ||
                          activeParticipant.username ||
                          "?")[0].toUpperCase()}
                      </div>
                    )}
                    {isActiveParticipantOnline && (
                      <span className="absolute bottom-1 right-1 h-5 w-5 rounded-full border-4 border-[#090b18] bg-lime-400" />
                    )}
                  </div>
                  <h3 className="relative mt-5 truncate text-xl font-black text-white">
                    {activeParticipant.display_name ||
                      activeParticipant.username}
                  </h3>
                  <p className="relative mt-1 truncate text-xs text-fuchsia-300">
                    @{activeParticipant.username}
                  </p>
                  {isActiveParticipantOnline && (
                    <span className="relative mt-4 inline-flex rounded-full border border-lime-400/25 bg-lime-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-lime-300">
                      Active in the city
                    </span>
                  )}
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto p-4">
                  <section className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-lime-400">
                      Connection
                    </p>
                    <div className="mt-4 space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-xs text-slate-500">Status</span>
                        <span className="text-xs font-bold text-white">
                          {isActiveParticipantOnline ? "Online" : "Offline"}
                        </span>
                      </div>
                      <div className="h-px bg-white/[0.06]" />
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-xs text-slate-500">Mail</span>
                        <span className="max-w-[150px] truncate text-xs font-bold text-fuchsia-300">
                          {activeParticipant.utromail_address || "UTroMail"}
                        </span>
                      </div>
                      <div className="h-px bg-white/[0.06]" />
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-xs text-slate-500">Messages</span>
                        <span className="text-xs font-bold text-white">
                          {messages.length}
                        </span>
                      </div>
                    </div>
                  </section>

                  <section className="mt-4 rounded-2xl border border-fuchsia-400/15 bg-fuchsia-500/[0.045] p-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-fuchsia-300">
                      Quick actions
                    </p>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        className="flex flex-col items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.035] p-3 text-xs font-bold text-slate-300 transition hover:border-lime-400/30 hover:text-lime-300"
                      >
                        <Phone className="h-4 w-4" />
                        Call
                      </button>
                      <button
                        type="button"
                        className="flex flex-col items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.035] p-3 text-xs font-bold text-slate-300 transition hover:border-fuchsia-400/30 hover:text-fuchsia-300"
                      >
                        <Video className="h-4 w-4" />
                        Video
                      </button>
                    </div>
                  </section>
                </div>

                <div className="border-t border-white/[0.08] p-4">
                  <button
                    type="button"
                    onClick={() =>
                      navigate(`/profile/${activeParticipant.username}`)
                    }
                    className="w-full rounded-xl border border-lime-400/35 bg-lime-400/10 px-4 py-3 text-xs font-black uppercase tracking-[0.12em] text-lime-300 transition hover:bg-lime-400/15"
                  >
                    View full profile
                  </button>
                </div>
              </>
            ) : (
              <div className="flex h-full items-center justify-center p-6 text-center">
                <div>
                  <p className="text-sm font-black text-white">City profile</p>
                  <p className="mt-2 text-xs leading-5 text-slate-500">
                    Open a conversation to see connection details.
                  </p>
                </div>
              </div>
            )}
          </aside>
        </div>
      </div>

      {/* Mobile chat overlay */}
      {showMobileChat && (
        <div className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-[#050713] lg:hidden">
          {chatPanel}
        </div>
      )}

      {/* Thread context menu */}
      {contextMenu && (
        <>
          <div
            className="fixed inset-0 z-[999] bg-black/20"
            onClick={() => setContextMenu(null)}
          />
          <div
            className="fixed z-[1000] min-w-[220px] overflow-hidden rounded-2xl border border-white/10 bg-[#0b0d19]/98 py-1 shadow-[0_24px_80px_rgba(0,0,0,0.65)] backdrop-blur-2xl"
            style={{
              left: Math.min(contextMenu.x, window.innerWidth - 240),
              top: Math.min(contextMenu.y, window.innerHeight - 210),
            }}
          >
            <div className="border-b border-white/[0.08] px-4 py-3">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
                Street with
              </p>
              <p className="mt-1 truncate text-sm font-black text-white">
                {contextMenu.otherUsername}
              </p>
            </div>
            <button
              type="button"
              onClick={async () => {
                try {
                  await blockUser(user!.id, contextMenu.otherUserId);
                  toast.success(`Blocked ${contextMenu.otherUsername}`);
                  setContextMenu(null);
                  fetchThreadsRef.current?.();
                } catch (err: any) {
                  toast.error(err.message || "Failed to block user");
                }
              }}
              className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-semibold text-red-300 transition hover:bg-red-500/10"
            >
              <Ban className="h-4 w-4" /> Block user
            </button>
            <button
              type="button"
              onClick={async () => {
                const reason = prompt("Report reason:");
                if (!reason?.trim()) return;
                try {
                  await reportMessage(
                    contextMenu.otherUserId,
                    contextMenu.threadId,
                    reason.trim(),
                  );
                  toast.success("Report submitted");
                  setContextMenu(null);
                } catch (err: any) {
                  toast.error(err.message || "Failed to submit report");
                }
              }}
              className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-semibold text-amber-300 transition hover:bg-amber-500/10"
            >
              <Flag className="h-4 w-4" /> Report thread
            </button>
            <button
              type="button"
              onClick={async () => {
                try {
                  await deleteThread(contextMenu.threadId, user!.id);
                  toast.success("Thread removed from inbox");
                  setContextMenu(null);
                  if (activeConversationId === contextMenu.threadId) {
                    setActiveConversationId(null);
                    setShowMobileChat(false);
                  }
                  fetchThreadsRef.current?.();
                } catch (err: any) {
                  toast.error(err.message || "Failed to remove thread");
                }
              }}
              className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-semibold text-slate-300 transition hover:bg-white/[0.05]"
            >
              <Trash2 className="h-4 w-4" /> Remove from inbox
            </button>
          </div>
        </>
      )}
    </div>
  );
}