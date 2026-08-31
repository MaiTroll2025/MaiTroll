// ============================================================
// UTROMAIL - PREMIUM MESSENGER PAGE
// Logic preserved: threads, requests, realtime, typing,
// read receipts, polling, compose, delete, block, report.
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
  Lock,
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

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - d.getTime();

  if (diff < 60000) return "Just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
  if (diff < 86400000) {
    return d.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return d.toLocaleDateString([], {
    month: "short",
    day: "numeric",
  });
}

function formatMessageTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getOtherParticipant(thread: UtromailThread, userId: string) {
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

function getInitials(name?: string | null) {
  if (!name) return "?";

  const parts = name.trim().split(/\s+/);

  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }

  return name.slice(0, 2).toUpperCase();
}

export default function UtromailPage() {
  const navigate = useNavigate();
  const { threadId } = useParams();
  const [searchParams] = useSearchParams();

  const { user, profile } = useAuthStore();

  const onlineUserIds = usePresenceStore((s) => s.onlineUserIds);

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
  const [userMailAddress, setUserMailAddress] = useState("");

  const [contextMenu, setContextMenu] = useState<{
    threadId: string;
    otherUserId: string;
    otherUsername: string;
    x: number;
    y: number;
  } | null>(null);

  useEffect(() => {
    if (!threadId) return
    if (activeConversationId === threadId) return
    setActiveConversationId(threadId)
    setShowMobileChat(true)
  }, [threadId, activeConversationId])

  // ============================================================
  // CHAT STATE
  // ============================================================

  const [messages, setMessages] = useState<UtromailMessage[]>([]);
  const [msgLoading, setMsgLoading] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const [isOtherTyping, setIsOtherTyping] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sentMessageIdsRef = useRef<Set<string>>(new Set());

  // ============================================================
  // ACCOUNT
  // ============================================================

  useEffect(() => {
    if (!user?.id) return;

    getUtromailAccount(user.id).then((account) => {
      if (account) {
        setUserMailAddress(account.mail_address);
      }
    });
  }, [user?.id]);

  const senderMail =
    userMailAddress || `${profile?.username || "user"}@utromail`;

  // ============================================================
  // THREADS
  // ============================================================

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

  fetchThreadsRef.current = fetchThreads;

  useEffect(() => {
    fetchThreads();
  }, [fetchThreads]);

  // ============================================================
  // LOAD ACTIVE MESSAGES
  // ============================================================

  useEffect(() => {
    if (!activeConversationId || !user?.id) {
      setMessages([]);
      return;
    }

    const fetchMessages = async () => {
      setMsgLoading(true);

      try {
        const msgs = await getThreadMessages(activeConversationId);

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
            {
              onConflict: "message_id,user_id",
            },
          );
        }

        fetchThreadsRef.current?.();
      } catch (err) {
        console.error("Error fetching messages:", err);
      } finally {
        setMsgLoading(false);
      }
    };

    fetchMessages();
  }, [activeConversationId, user?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [messages]);

  // ============================================================
  // POLLING FALLBACK
  // ============================================================

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
    }, 5000);

    return () => clearInterval(pollInterval);
  }, [activeConversationId, user?.id]);

  useEffect(() => {
    if (!user?.id) return;

    const pollInterval = setInterval(() => {
      fetchThreadsRef.current?.();
    }, 60000);

    return () => clearInterval(pollInterval);
  }, [user?.id]);

  // ============================================================
  // SEND MESSAGE
  // ============================================================

  const handleSend = async () => {
    if (!replyText.trim() || !activeConversationId || !user) return;

    const activeThread = threads.find(
      (t) => t.id === activeConversationId,
    );

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

      if (sentMsg?.id) {
        sentMessageIdsRef.current.add(sentMsg.id);

        setTimeout(() => {
          sentMessageIdsRef.current.delete(sentMsg.id);
        }, 10000);

        const optimisticMsg: UtromailMessage = {
          id: sentMsg.id,
          thread_id: activeConversationId,
          sender_id: user.id,
          sender_mail_address: senderMail,
          recipient_id: recipientId,
          recipient_mail_address: recipientMail,
          subject: "Direct Message",
          body,
          body_html: null,
          message_type: "normal",
          is_starred: false,
          is_draft: false,
          parent_message_id: lastMsg.id,
          sent_at: sentMsg.sent_at || new Date().toISOString(),
          created_at: sentMsg.created_at || new Date().toISOString(),
          updated_at: sentMsg.updated_at || new Date().toISOString(),
          sender_name: profile?.display_name || profile?.username || null,
          sender_username: profile?.username || null,
          sender_avatar: profile?.avatar_url || null,
          is_read: false,
        };

        setMessages((prev) => {
          if (prev.some((m) => m.id === optimisticMsg.id)) {
            return prev;
          }
          return [...prev, optimisticMsg];
        });
      }

      fetchThreadsRef.current?.();
    } catch (err: any) {
      toast.error(err.message || "Failed to send");
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

  // ============================================================
  // CONVERSATION
  // ============================================================

  const openConversation = (id: string) => {
    setActiveConversationId(id);
    setShowMobileChat(true);
  };

  const closeMobileChat = () => {
    setShowMobileChat(false);
    setActiveConversationId(null);
  };

  // ============================================================
  // REALTIME NOTIFICATIONS
  // ============================================================

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

          fetchThreadsRef.current?.();

          if (
            notif?.message_id &&
            notif.message_id !== activeConversationId
          ) {
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
      supabase.removeChannel(notifChannel);
    };
  }, [user?.id, activeConversationId]);

  // ============================================================
  // JAIL REALTIME
  // ============================================================

  useEffect(() => {
    if (!user?.id) return;

    const jailChannel = supabase
      .channel(`utromail-jail:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "jail",
        },
        () => {
          fetchThreadsRef.current?.();

          if (activeConversationId) {
            setMessages((prev) => prev);
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(jailChannel);
    };
  }, [user?.id, activeConversationId]);

  // ============================================================
  // REALTIME MESSAGES
  // ============================================================

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

            const isOwnMessage = newMsg.sender_id === user.id;

            const mappedMsg: UtromailMessage = {
              id: newMsg.id,
              thread_id: newMsg.thread_id,
              sender_id: newMsg.sender_id,
              sender_mail_address: newMsg.sender_mail_address,
              recipient_id: newMsg.recipient_id,
              recipient_mail_address: newMsg.recipient_mail_address,
              subject: newMsg.subject,
              body: newMsg.body,
              body_html: newMsg.body_html,
              message_type: newMsg.message_type,
              is_starred: newMsg.is_starred || false,
              is_draft: newMsg.is_draft || false,
              parent_message_id: newMsg.parent_message_id,
              sent_at: newMsg.sent_at,
              created_at: newMsg.created_at,
              updated_at: newMsg.updated_at,
              sender_name: isOwnMessage
                ? profile?.display_name || profile?.username || null
                : undefined,
              sender_username: isOwnMessage
                ? profile?.username || null
                : undefined,
              sender_avatar: isOwnMessage
                ? profile?.avatar_url || null
                : undefined,
              is_read: false,
            };

            if (isOwnMessage) {
              sentMessageIdsRef.current.delete(newMsg.id);
            }

            let senderName = mappedMsg.sender_name;
            let senderUsername = mappedMsg.sender_username;
            let senderAvatar = mappedMsg.sender_avatar;

            if (!isOwnMessage) {
              const { data: senderProfile } = await supabase
                .from("user_profiles")
                .select("username, display_name, avatar_url")
                .eq("id", newMsg.sender_id)
                .maybeSingle();

              senderName =
                (senderProfile as any)?.display_name ||
                (senderProfile as any)?.username ||
                null;
              senderUsername =
                (senderProfile as any)?.username || null;
              senderAvatar =
                (senderProfile as any)?.avatar_url || null;
            }

            setMessages((prev) => {
              if (prev.some((m) => m.id === mappedMsg.id)) {
                return prev;
              }

              return [
                ...prev,
                {
                  ...mappedMsg,
                  sender_name: senderName,
                  sender_username: senderUsername,
                  sender_avatar: senderAvatar,
                },
              ];
            });

            if (!isOwnMessage) {
              await markThreadAsRead(
                activeConversationId,
                user.id,
              );
            }

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
      supabase.removeChannel(msgChannel);
    };
  }, [activeConversationId, user?.id]);

  // ============================================================
  // TYPING
  // ============================================================

  const broadcastTyping = () => {
    if (!activeConversationId || !user?.id) return;

    const thread = threads.find(
      (t) => t.id === activeConversationId,
    );

    if (!thread?.other_user_id) return;

    const typingCh = supabase.channel(
      `utromail-typing:${activeConversationId}`,
      {
        config: {
          broadcast: {
            self: false,
          },
        },
      },
    );

    typingCh.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await typingCh.send({
          type: "broadcast",
          event: "typing",
          payload: {
            userId: user.id,
            isTyping: true,
          },
        });
      }
    });
  };

  useEffect(() => {
    if (!activeConversationId || !user?.id) return;

    const thread = threads.find(
      (t) => t.id === activeConversationId,
    );

    const otherUserId = thread?.other_user_id;

    if (!otherUserId) return;

    const typingChannel = supabase.channel(
      `utromail-typing:${activeConversationId}`,
      {
        config: {
          broadcast: {
            self: false,
          },
        },
      },
    );

    typingChannel
      .on(
        "broadcast",
        { event: "typing" },
        (payload: any) => {
          const {
            userId: typingUserId,
            isTyping,
          } = payload.payload || {};

          if (
            typingUserId &&
            typingUserId !== user.id &&
            typingUserId === otherUserId
          ) {
            setIsOtherTyping(!!isTyping);
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(typingChannel);
    };
  }, [activeConversationId, user?.id, threads]);

  useEffect(() => {
    if (!isOtherTyping) return;

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(
      () => setIsOtherTyping(false),
      5000,
    );

    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [isOtherTyping]);

  // ============================================================
  // READ RECEIPTS
  // ============================================================

  useEffect(() => {
    if (
      !activeConversationId ||
      !user?.id ||
      messages.length === 0
    ) {
      return;
    }

    const unreadFromOther = messages.filter(
      (m) => m.sender_id !== user.id && !m.is_read,
    );

    if (unreadFromOther.length === 0) return;

    const markRead = async () => {
      try {
        const readStatusRows = unreadFromOther.map((m) => ({
          message_id: m.id,
          user_id: user.id,
          read_at: new Date().toISOString(),
        }));

        await supabase
          .from("utromail_read_status")
          .upsert(readStatusRows, {
            onConflict: "message_id,user_id",
          });

        const readIds = new Set(
          unreadFromOther.map((m) => m.id),
        );

        setMessages((prev) =>
          prev.map((m) =>
            readIds.has(m.id)
              ? {
                  ...m,
                  is_read: true,
                }
              : m,
          ),
        );

        await markThreadAsRead(
          activeConversationId,
          user.id,
        );

        fetchThreadsRef.current?.();
      } catch (err) {
        console.error(
          "[UtromailPage] Error marking messages as read:",
          err,
        );
      }
    };

    markRead();
  }, [
    activeConversationId,
    user?.id,
    messages.length,
  ]);

  // ============================================================
  // DELETE
  // ============================================================

  const deleteThreads = async (threadIds: string[]) => {
    if (!user?.id || threadIds.length === 0) return;

    const confirmed = window.confirm(
      `Delete ${threadIds.length} conversation${
        threadIds.length === 1 ? "" : "s"
      }?`,
    );

    if (!confirmed) return;

    try {
      await Promise.all(
        threadIds.map((id) =>
          deleteThread(id, user.id),
        ),
      );

      toast.success("Conversation deleted");

      setThreads((prev) =>
        prev.filter(
          (thread) => !threadIds.includes(thread.id),
        ),
      );

      if (
        activeConversationId &&
        threadIds.includes(activeConversationId)
      ) {
        closeMobileChat();
      }

      fetchThreadsRef.current?.();
    } catch (err: any) {
      toast.error(
        err?.message || "Failed to delete",
      );
    }
  };

  const handleDeleteConversation = () => {
    if (!activeConversationId) return;

    void deleteThreads([activeConversationId]);
  };

  // ============================================================
  // FILTERING
  // ============================================================

  const activeThread = threads.find(
    (t) => t.id === activeConversationId,
  );

  const filteredThreads = threads.filter((t) => {
    if (!searchQuery) return true;

    const q = searchQuery.toLowerCase();

    const lastMsgPreview =
      t.last_message?.body?.toLowerCase() || "";

    const participant = getOtherParticipant(
      t,
      user?.id || "",
    );

    const nameMatch =
      participant?.display_name
        ?.toLowerCase()
        .includes(q) ||
      participant?.username
        ?.toLowerCase()
        .includes(q) ||
      false;

    return (
      lastMsgPreview.includes(q) ||
      nameMatch ||
      t.subject?.toLowerCase().includes(q)
    );
  });

  const filteredThreadIds = filteredThreads.map(
    (thread) => thread.id,
  );

  const allFilteredThreadsSelected =
    filteredThreadIds.length > 0 &&
    filteredThreadIds.every((id) =>
      selectedThreadIds.has(id),
    );

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

    void deleteThreads(
      Array.from(selectedThreadIds),
    );
  };

  const handleDeleteAllFilteredThreads = () => {
    if (filteredThreadIds.length === 0) return;

    void deleteThreads(filteredThreadIds);
  };

  // ============================================================
  // AUTO COMPOSE
  // ============================================================

  const recipientId =
    searchParams.get("recipientId") ||
    searchParams.get("recipient") ||
    searchParams.get("user") ||
    undefined;

  const subject =
    searchParams.get("subject") || undefined;

  const autoCompose =
    !!(recipientId && threadId === undefined);

  if (showCompose || autoCompose) {
    const replyTo = recipientId
      ? {
          recipientId,
          subject,
          recipientMail: undefined,
        }
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

  // ============================================================
  // ACTIVE CONTACT
  // ============================================================

  const activeParticipant = activeThread
    ? getOtherParticipant(
        activeThread,
        user?.id || "",
      )
    : null;

  const isActiveParticipantOnline =
    activeParticipant?.user_id != null &&
    onlineUserIds.has(
      activeParticipant.user_id,
    );

  // ============================================================
  // CHAT PANEL
  // ============================================================

  const chatPanel = activeConversationId ? (
    <div className="flex h-full min-h-0 flex-col bg-[#0a0d14]">
      {/* ======================================================
          CHAT HEADER
      ====================================================== */}

      <header className="flex min-h-[72px] shrink-0 items-center justify-between border-b border-white/[0.07] bg-[#0d1018]/95 px-3 backdrop-blur-xl sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={closeMobileChat}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-slate-400 transition hover:bg-white/[0.06] hover:text-white lg:hidden"
            aria-label="Back to conversations"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>

          {activeThread && (
            <>
              <div className="relative shrink-0">
                {activeThread.other_avatar_url ? (
                  <img
                    src={activeThread.other_avatar_url}
                    alt=""
                    className="h-11 w-11 rounded-full border border-white/10 object-cover"
                  />
                ) : (
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-[#5965f2] to-[#8056d9] text-sm font-bold text-white">
                    {getInitials(
                      activeThread.other_display_name ||
                        activeThread.other_username,
                    )}
                  </div>
                )}

                {isActiveParticipantOnline && (
                  <span className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-[3px] border-[#0d1018] bg-emerald-400" />
                )}
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="truncate text-[15px] font-semibold text-white">
                    {activeThread.other_display_name ||
                      activeThread.other_username ||
                      "Unknown"}
                  </h2>

                  {activeThread.other_is_jailed && (
                    <Lock className="h-3.5 w-3.5 shrink-0 text-red-400" />
                  )}
                </div>

                {isOtherTyping ? (
                  <p className="mt-0.5 flex items-center gap-1.5 text-xs font-medium text-[#7d8cff]">
                    <span className="flex gap-1">
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#7d8cff]" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#7d8cff] [animation-delay:120ms]" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#7d8cff] [animation-delay:240ms]" />
                    </span>
                    typing...
                  </p>
                ) : (
                  <p className="truncate text-xs text-slate-500">
                    {isActiveParticipantOnline
                      ? "Online"
                      : activeThread.other_utromail_address ||
                        "UTroMail"}
                  </p>
                )}
              </div>
            </>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            className="grid h-10 w-10 place-items-center rounded-xl text-slate-400 transition hover:bg-white/[0.06] hover:text-white"
            aria-label="Start voice call"
          >
            <Phone className="h-[17px] w-[17px]" />
          </button>

          <button
            type="button"
            className="grid h-10 w-10 place-items-center rounded-xl text-slate-400 transition hover:bg-white/[0.06] hover:text-white"
            aria-label="Start video call"
          >
            <Video className="h-[17px] w-[17px]" />
          </button>

          <button
            type="button"
            onClick={handleDeleteConversation}
            className="grid h-10 w-10 place-items-center rounded-xl text-slate-500 transition hover:bg-red-500/10 hover:text-red-400"
            aria-label="Delete conversation"
          >
            <Trash2 className="h-[17px] w-[17px]" />
          </button>
        </div>
      </header>

      {/* ======================================================
          MESSAGE AREA
      ====================================================== */}

      <div className="relative min-h-0 flex-1 overflow-hidden bg-[#090c13]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(91,102,242,0.055),transparent_34%)]" />

        <div className="relative h-full overflow-y-auto px-3 py-6 sm:px-6 sm:py-8">
          {msgLoading ? (
            <div className="flex h-full items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-full bg-white/[0.04]">
                  <Loader2 className="h-5 w-5 animate-spin text-[#7d8cff]" />
                </div>

                <span className="text-xs text-slate-500">
                  Loading conversation...
                </span>
              </div>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex h-full items-center justify-center text-center">
              <div className="max-w-sm">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.035]">
                  <Send className="h-6 w-6 text-[#7d8cff]" />
                </div>

                <h3 className="mt-5 text-lg font-semibold text-white">
                  Start the conversation
                </h3>

                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Send a message to start chatting with{" "}
                  {activeThread?.other_display_name ||
                    activeThread?.other_username ||
                    "this member"}.
                </p>
              </div>
            </div>
          ) : (
            <div className="mx-auto flex w-full max-w-3xl flex-col">
              <div className="mb-7 flex items-center gap-3">
                <div className="h-px flex-1 bg-white/[0.06]" />

                <span className="rounded-full border border-white/[0.07] bg-white/[0.025] px-3 py-1 text-[10px] font-medium text-slate-500">
                  Today
                </span>

                <div className="h-px flex-1 bg-white/[0.06]" />
              </div>

              {messages.map((msg, idx) => {
                const isOwn =
                  msg.sender_id === user?.id;

                const previous = messages[idx - 1];
                const next = messages[idx + 1];

                const startsGroup =
                  !previous ||
                  previous.sender_id !==
                    msg.sender_id;

                const endsGroup =
                  !next ||
                  next.sender_id !==
                    msg.sender_id;

                return (
                  <div
                    key={msg.id}
                    className={`flex items-end gap-2.5 ${
                      isOwn
                        ? "justify-end"
                        : "justify-start"
                    } ${
                      startsGroup && idx > 0
                        ? "mt-5"
                        : ""
                    }`}
                  >
                    {!isOwn && (
                      <div className="w-8 shrink-0 self-end">
                        {endsGroup &&
                          (msg.sender_avatar ? (
                            <img
                              src={msg.sender_avatar}
                              alt=""
                              className="h-8 w-8 rounded-full border border-white/10 object-cover"
                            />
                          ) : (
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-[#5965f2] to-[#8056d9] text-[10px] font-bold text-white">
                              {getInitials(
                                msg.sender_name ||
                                  msg.sender_username,
                              )}
                            </div>
                          ))}
                      </div>
                    )}

                    <div
                      className={`flex max-w-[84%] flex-col sm:max-w-[72%] ${
                        isOwn
                          ? "items-end"
                          : "items-start"
                      }`}
                    >
                      {startsGroup && !isOwn && (
                        <button
                          type="button"
                          onClick={() => {
                            const senderUsername =
                              msg.sender_username ||
                              activeThread?.other_username;

                            if (senderUsername) {
                              navigate(
                                `/profile/${encodeURIComponent(
                                  senderUsername,
                                )}`,
                              );
                            }
                          }}
                          className="mb-1.5 ml-1 flex items-center gap-1.5 text-left text-[11px] font-medium text-slate-400 transition hover:text-white"
                        >
                          {msg.sender_name ||
                            msg.sender_username ||
                            activeThread?.other_username ||
                            "Member"}

                          {msg.sender_is_jailed && (
                            <Lock className="h-3 w-3 text-red-400" />
                          )}
                        </button>
                      )}

                      <div
                        className={`relative px-4 py-2.5 text-[14px] leading-[1.55] ${
                          isOwn
                            ? [
                                "bg-gradient-to-br",
                                "from-[#5965f2]",
                                "to-[#6d57c9]",
                                "text-white",
                                "shadow-[0_6px_22px_rgba(55,65,170,0.18)]",
                                startsGroup
                                  ? "rounded-2xl"
                                  : "rounded-t-2xl",
                                endsGroup
                                  ? "rounded-bl-2xl rounded-br-md"
                                  : "rounded-b-2xl",
                              ].join(" ")
                            : [
                                "border",
                                "border-white/[0.07]",
                                "bg-[#151922]",
                                "text-slate-200",
                                startsGroup
                                  ? "rounded-2xl"
                                  : "rounded-t-2xl",
                                endsGroup
                                  ? "rounded-br-2xl rounded-bl-md"
                                  : "rounded-b-2xl",
                              ].join(" ")
                        }`}
                      >
                        <p className="whitespace-pre-wrap break-words">
                          {msg.body}
                        </p>
                      </div>

                      {endsGroup && (
                        <div
                          className={`mt-1.5 flex items-center gap-1.5 px-1 text-[10px] text-slate-600 ${
                            isOwn
                              ? "justify-end"
                              : "justify-start"
                          }`}
                        >
                          <span>
                            {formatMessageTime(
                              msg.sent_at,
                            )}
                          </span>

                          {isOwn &&
                            (msg.is_read ? (
                              <CheckCheck
                                className="h-3.5 w-3.5 text-[#8290ff]"
                                aria-label="Read"
                              />
                            ) : (
                              <Check
                                className="h-3.5 w-3.5 text-slate-600"
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
                <div className="mt-4 flex items-end gap-2.5">
                  <div className="h-8 w-8" />

                  <div className="flex items-center gap-1 rounded-2xl rounded-bl-md border border-white/[0.07] bg-[#151922] px-4 py-3">
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#7d8cff]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#7d8cff] [animation-delay:120ms]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#7d8cff] [animation-delay:240ms]" />
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
      </div>

      {/* ======================================================
          COMPOSER
      ====================================================== */}

      <footer className="shrink-0 border-t border-white/[0.07] bg-[#0d1018]/95 px-3 py-3 backdrop-blur-xl sm:px-5 sm:py-4">
        <div className="mx-auto flex max-w-3xl items-end gap-1.5 rounded-2xl border border-white/[0.08] bg-[#141821] p-1.5 transition focus-within:border-[#6672f2]/40 focus-within:bg-[#171b25]">
          <button
            type="button"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-slate-500 transition hover:bg-white/[0.05] hover:text-slate-200"
            aria-label="Attach image"
          >
            <Image className="h-[18px] w-[18px]" />
          </button>

          <button
            type="button"
            className="hidden h-10 w-10 shrink-0 place-items-center rounded-xl text-slate-500 transition hover:bg-white/[0.05] hover:text-slate-200 sm:grid"
            aria-label="Add emoji"
          >
            <Smile className="h-[18px] w-[18px]" />
          </button>

          <textarea
            ref={inputRef}
            value={replyText}
            onChange={(event) => {
              setReplyText(event.target.value);

              if (event.target.value.length > 0) {
                broadcastTyping();
              }
            }}
            onKeyDown={handleKeyDown}
            placeholder={`Message ${
              activeThread?.other_username ||
              "member"
            }`}
            rows={1}
            className="max-h-36 min-h-[40px] flex-1 resize-none bg-transparent px-2 py-2.5 text-sm leading-5 text-white outline-none placeholder:text-slate-600"
          />

          <button
            type="button"
            onClick={handleSend}
            disabled={
              sending ||
              !replyText.trim()
            }
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#5965f2] text-white shadow-[0_4px_16px_rgba(89,101,242,0.25)] transition hover:bg-[#6874ff] hover:shadow-[0_5px_20px_rgba(89,101,242,0.35)] disabled:cursor-not-allowed disabled:opacity-30"
            aria-label="Send message"
          >
            {sending ? (
              <Loader2 className="h-[17px] w-[17px] animate-spin" />
            ) : (
              <Send className="h-[17px] w-[17px]" />
            )}
          </button>
        </div>

        <p className="mt-2 hidden text-center text-[10px] text-slate-700 sm:block">
          Enter to send · Shift + Enter for a new line
        </p>
      </footer>
    </div>
  ) : (
    // ==========================================================
    // EMPTY CHAT STATE
    // ==========================================================

    <div className="relative flex h-full min-h-[520px] items-center justify-center overflow-hidden bg-[#0a0d14] p-6 text-center">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_38%,rgba(89,101,242,0.08),transparent_30%)]" />

      <div className="relative max-w-md">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl border border-white/[0.08] bg-white/[0.025] shadow-[0_20px_70px_rgba(0,0,0,0.25)]">
          <Send className="h-8 w-8 text-[#707cff]" />
        </div>

        <p className="mt-6 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#707cff]">
          UTroMail
        </p>

        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
          Your conversations,
          <br />
          all in one place.
        </h2>

        <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-slate-500">
          Select a conversation to continue chatting,
          or start a new message with someone in MaiTroll.
        </p>

        <button
          type="button"
          onClick={() => setShowCompose(true)}
          className="mt-7 inline-flex items-center gap-2 rounded-xl bg-[#5965f2] px-5 py-3 text-sm font-semibold text-white shadow-[0_8px_25px_rgba(89,101,242,0.2)] transition hover:bg-[#6874ff] hover:shadow-[0_10px_30px_rgba(89,101,242,0.3)]"
        >
          <PenSquare className="h-4 w-4" />
          New message
        </button>
      </div>
    </div>
  );

  // ============================================================
  // PAGE
  // ============================================================

  return (
    <div className="relative h-full min-h-0 overflow-hidden bg-[#07090e] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(89,101,242,0.045),transparent_25%),radial-gradient(circle_at_90%_0%,rgba(128,86,217,0.035),transparent_25%)]" />

      <div className="relative mx-auto flex h-full min-h-0 w-full max-w-[1680px] flex-col px-2 py-2 sm:px-3 sm:py-3 lg:px-4">
        {/* ====================================================
            PAGE HEADER
        ==================================================== */}

        <div className="mb-3 hidden shrink-0 items-center justify-between px-1 lg:flex">
          <div>
            <div className="flex items-center gap-3">
              <div>
                <h1 className="text-2xl font-semibold tracking-tight text-white">
                  UTroMail
                </h1>

                <p className="mt-0.5 text-xs text-slate-500">
                  Private conversations inside MaiTroll
                </p>
              </div>

              {unreadCount > 0 && (
                <span className="rounded-full border border-[#5965f2]/20 bg-[#5965f2]/10 px-2.5 py-1 text-[10px] font-semibold text-[#8791ff]">
                  {unreadCount} unread
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs text-slate-600">
            <span>
              <strong className="font-semibold text-slate-300">
                {threads.length}
              </strong>{" "}
              conversations
            </span>

            <span className="h-4 w-px bg-white/[0.07]" />

            <button
              type="button"
              onClick={() => setShowCompose(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-[#5965f2] px-4 py-2.5 font-semibold text-white shadow-[0_5px_18px_rgba(89,101,242,0.18)] transition hover:bg-[#6874ff]"
            >
              <PenSquare className="h-3.5 w-3.5" />
              New message
            </button>
          </div>
        </div>

        {/* ====================================================
            MAIN THREE-COLUMN LAYOUT
        ==================================================== */}

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-2.5 lg:grid-cols-[310px_minmax(0,1fr)] xl:grid-cols-[320px_minmax(0,1fr)_270px]">
          {/* ==================================================
              CONVERSATION SIDEBAR
          ================================================== */}

          <aside
            className={`min-h-0 overflow-hidden rounded-2xl border border-white/[0.07] bg-[#0d1017] ${
              showMobileChat
                ? "hidden lg:flex"
                : "flex"
            } flex-col pb-[calc(72px+env(safe-area-inset-bottom,0px))] md:pb-0`}
          >
            {/* Sidebar header */}

            <div className="border-b border-white/[0.07] p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-[15px] font-semibold text-white">
                    Messages
                  </h2>

                  <p className="mt-0.5 text-[11px] text-slate-500">
                    {threads.length} conversations
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setShowCompose(true)}
                  className="grid h-9 w-9 place-items-center rounded-xl bg-[#5965f2] text-white shadow-[0_5px_18px_rgba(89,101,242,0.2)] transition hover:bg-[#6874ff]"
                  aria-label="New message"
                >
                  <PenSquare className="h-4 w-4" />
                </button>
              </div>

              {/* Search */}

              <div className="relative mt-4">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" />

                <input
                  type="search"
                  placeholder="Search conversations"
                  value={searchQuery}
                  onChange={(event) =>
                    setSearchQuery(
                      event.target.value,
                    )
                  }
                  className="h-10 w-full rounded-xl border border-white/[0.07] bg-[#080b11] pl-9 pr-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-[#5965f2]/40 focus:bg-[#0a0d14]"
                />
              </div>

              <div className="mt-3 flex items-center justify-between">
                <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-slate-600">
                  Inbox
                </span>

                <button
                  type="button"
                  onClick={() => {
                    setSelectMode(
                      (value) => !value,
                    );
                    setSelectedThreadIds(
                      new Set(),
                    );
                  }}
                  className="text-[11px] font-medium text-slate-500 transition hover:text-white"
                >
                  {selectMode
                    ? "Done"
                    : "Select"}
                </button>
              </div>
            </div>

            {/* Selection controls */}

            {selectMode && (
              <div className="border-b border-white/[0.07] bg-white/[0.02] p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-300">
                    {selectedThreadIds.size} selected
                  </span>

                  <button
                    type="button"
                    onClick={
                      toggleAllFilteredThreads
                    }
                    className="text-[10px] font-medium text-[#7d8cff]"
                  >
                    {allFilteredThreadsSelected
                      ? "Clear all"
                      : "Select all"}
                  </button>
                </div>

                <div className="mt-2 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={
                      handleDeleteFilteredThreads
                    }
                    disabled={
                      selectedThreadIds.size ===
                      0
                    }
                    className="rounded-lg bg-red-500/10 px-2 py-2 text-[10px] font-semibold text-red-400 transition hover:bg-red-500/15 disabled:opacity-30"
                  >
                    Delete selected
                  </button>

                  <button
                    type="button"
                    onClick={
                      handleDeleteAllFilteredThreads
                    }
                    disabled={
                      filteredThreadIds.length ===
                      0
                    }
                    className="rounded-lg border border-red-500/10 bg-red-500/[0.04] px-2 py-2 text-[10px] font-semibold text-red-400 transition hover:bg-red-500/10 disabled:opacity-30"
                  >
                    Delete all
                  </button>
                </div>
              </div>
            )}

            {/* Requests */}

            {requests.length > 0 && (
              <div className="border-b border-white/[0.07] p-3">
                <button
                  type="button"
                  onClick={() =>
                    navigate(
                      "/utromail/requests",
                    )
                  }
                  className="flex w-full items-center gap-3 rounded-xl border border-amber-400/10 bg-amber-400/[0.035] p-3 text-left transition hover:bg-amber-400/[0.06]"
                >
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-amber-400/10 text-xs font-bold text-amber-300">
                    !
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-amber-200">
                      Message requests
                    </p>

                    <p className="mt-0.5 truncate text-[10px] text-slate-600">
                      People outside your connections
                    </p>
                  </div>

                  <span className="rounded-full bg-amber-400/10 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
                    {requests.length}
                  </span>
                </button>
              </div>
            )}

            {/* Thread list */}

            <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
              {loading ? (
                <div className="flex h-40 items-center justify-center">
                  <Loader2 className="h-5 w-5 animate-spin text-[#707cff]" />
                </div>
              ) : filteredThreads.length === 0 ? (
                <div className="px-6 py-14 text-center">
                  <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-white/[0.025]">
                    <Search className="h-5 w-5 text-slate-700" />
                  </div>

                  <p className="mt-4 text-sm font-medium text-slate-400">
                    No conversations found
                  </p>

                  <button
                    type="button"
                    onClick={() =>
                      setShowCompose(true)
                    }
                    className="mt-2 text-xs font-medium text-[#7884ff] transition hover:text-[#98a1ff]"
                  >
                    Start a new conversation
                  </button>
                </div>
              ) : (
                <div className="space-y-0.5">
                  {filteredThreads.map(
                    (thread) => {
                      const lastMsg =
                        thread.last_message;

                      const isActive =
                        activeConversationId ===
                        thread.id;

                      const isUnread =
                        (thread.unread_count ||
                          0) > 0;

                      const displayName =
                        thread.other_display_name ||
                        thread.other_username ||
                        "Unknown";

                      const avatarUrl =
                        thread.other_avatar_url;

                      const isOtherOnline =
                        thread.other_user_id !=
                          null &&
                        onlineUserIds.has(
                          thread.other_user_id,
                        );

                      return (
                        <button
                          key={thread.id}
                          type="button"
                          onClick={() => {
                            if (selectMode) {
                              toggleThreadSelection(
                                thread.id,
                              );
                              return;
                            }

                            openConversation(
                              thread.id,
                            );
                          }}
                          onContextMenu={(
                            event,
                          ) => {
                            event.preventDefault();

                            if (
                              thread.other_user_id
                            ) {
                              setContextMenu({
                                threadId:
                                  thread.id,
                                otherUserId:
                                  thread.other_user_id,
                                otherUsername:
                                  thread.other_username ||
                                  "Unknown",
                                x: event.clientX,
                                y: event.clientY,
                              });
                            }
                          }}
                          onTouchStart={(
                            event,
                          ) => {
                            const touch =
                              event.touches[0];

                            const timer =
                              setTimeout(
                                () => {
                                  if (
                                    thread.other_user_id
                                  ) {
                                    setContextMenu(
                                      {
                                        threadId:
                                          thread.id,
                                        otherUserId:
                                          thread.other_user_id,
                                        otherUsername:
                                          thread.other_username ||
                                          "Unknown",
                                        x: touch.clientX,
                                        y: touch.clientY,
                                      },
                                    );
                                  }
                                },
                                600,
                              );

                            const cleanup =
                              () =>
                                clearTimeout(
                                  timer,
                                );

                            event.currentTarget.addEventListener(
                              "touchend",
                              cleanup,
                              {
                                once: true,
                              },
                            );

                            event.currentTarget.addEventListener(
                              "touchmove",
                              cleanup,
                              {
                                once: true,
                              },
                            );
                          }}
                          className={`group relative flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition ${
                            selectedThreadIds.has(
                              thread.id,
                            )
                              ? "bg-red-500/[0.08]"
                              : isActive
                                ? "bg-[#5965f2]/[0.10]"
                                : "hover:bg-white/[0.035]"
                          }`}
                        >
                          {isActive && (
                            <span className="absolute bottom-3 left-0 top-3 w-0.5 rounded-full bg-[#6874ff]" />
                          )}

                          {selectMode && (
                            <span
                              className={`grid h-5 w-5 shrink-0 place-items-center rounded-md border ${
                                selectedThreadIds.has(
                                  thread.id,
                                )
                                  ? "border-red-400 bg-red-500 text-white"
                                  : "border-white/15 text-transparent"
                              }`}
                            >
                              <Check className="h-3.5 w-3.5" />
                            </span>
                          )}

                          <div className="relative shrink-0">
                            {avatarUrl ? (
                              <img
                                src={avatarUrl}
                                alt=""
                                className={`h-11 w-11 rounded-full object-cover ${
                                  isActive
                                    ? "ring-2 ring-[#6874ff]/60 ring-offset-2 ring-offset-[#0d1017]"
                                    : "border border-white/[0.07]"
                                }`}
                              />
                            ) : (
                              <div
                                className={`flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-[#5965f2] to-[#8056d9] text-xs font-bold text-white ${
                                  isActive
                                    ? "ring-2 ring-[#6874ff]/60 ring-offset-2 ring-offset-[#0d1017]"
                                    : ""
                                }`}
                              >
                                {getInitials(
                                  displayName,
                                )}
                              </div>
                            )}

                            {isOtherOnline && (
                              <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-[#0d1017] bg-emerald-400" />
                            )}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex min-w-0 items-center gap-1.5">
                                <p
                                  className={`truncate text-[13px] ${
                                    isUnread
                                      ? "font-semibold text-white"
                                      : "font-medium text-slate-300"
                                  }`}
                                >
                                  {displayName}
                                </p>

                                {thread.other_is_jailed && (
                                  <Lock className="h-3 w-3 shrink-0 text-red-400" />
                                )}
                              </div>

                              <span
                                className={`shrink-0 text-[10px] ${
                                  isUnread
                                    ? "font-medium text-[#7d8cff]"
                                    : "text-slate-700"
                                }`}
                              >
                                {thread.last_message_at
                                  ? formatTime(
                                      thread.last_message_at,
                                    )
                                  : ""}
                              </span>
                            </div>

                            <div className="mt-1 flex items-center gap-2">
                              <p
                                className={`min-w-0 flex-1 truncate text-[11px] ${
                                  isUnread
                                    ? "font-medium text-slate-300"
                                    : "text-slate-600"
                                }`}
                              >
                                {lastMsg?.body ||
                                  "No messages yet"}
                              </p>

                              {isUnread && (
                                <span className="grid min-w-[18px] place-items-center rounded-full bg-[#5965f2] px-1.5 py-0.5 text-[9px] font-bold text-white">
                                  {thread.unread_count}
                                </span>
                              )}
                            </div>
                          </div>
                        </button>
                      );
                    },
                  )}
                </div>
              )}
            </div>

            {/* Sidebar bottom */}

            <div className="border-t border-white/[0.07] p-3">
              <button
                type="button"
                onClick={() =>
                  setShowCompose(true)
                }
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.025] px-4 py-2.5 text-xs font-semibold text-slate-300 transition hover:border-[#5965f2]/30 hover:bg-[#5965f2]/[0.07] hover:text-white"
              >
                <PenSquare className="h-3.5 w-3.5" />
                New message
              </button>
            </div>
          </aside>

          {/* ==================================================
              MAIN CHAT
          ================================================== */}

          <main
            className={`min-h-0 overflow-hidden rounded-2xl border border-white/[0.07] bg-[#0a0d14] ${
              showMobileChat
                ? "flex"
                : "hidden lg:flex"
            } flex-col`}
          >
            {chatPanel}
          </main>

          {/* ==================================================
              PROFILE / CONTACT PANEL
          ================================================== */}

          <aside className="hidden min-h-0 overflow-hidden rounded-2xl border border-white/[0.07] bg-[#0d1017] xl:flex xl:flex-col">
            {activeThread &&
            activeParticipant ? (
              <>
                <div className="border-b border-white/[0.07] px-5 pb-6 pt-7 text-center">
                  <div className="relative mx-auto w-fit">
                    {activeThread.other_avatar_url ? (
                      <img
                        src={
                          activeThread.other_avatar_url
                        }
                        alt=""
                        className="h-20 w-20 rounded-full border border-white/10 object-cover"
                      />
                    ) : (
                      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-[#5965f2] to-[#8056d9] text-xl font-bold text-white">
                        {getInitials(
                          activeParticipant.display_name ||
                            activeParticipant.username,
                        )}
                      </div>
                    )}

                    {isActiveParticipantOnline && (
                      <span className="absolute bottom-0.5 right-0.5 h-4 w-4 rounded-full border-[3px] border-[#0d1017] bg-emerald-400" />
                    )}
                  </div>

                  <h3 className="mt-4 truncate text-base font-semibold text-white">
                    {activeParticipant.display_name ||
                      activeParticipant.username}
                  </h3>

                  <p className="mt-1 truncate text-xs text-slate-600">
                    @{activeParticipant.username}
                  </p>

                  {isActiveParticipantOnline && (
                    <span className="mt-3 inline-flex items-center gap-1.5 text-[10px] font-medium text-emerald-400">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                      Online now
                    </span>
                  )}
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto p-4">
                  <section className="rounded-xl border border-white/[0.07] bg-white/[0.018] p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-600">
                      Contact
                    </p>

                    <div className="mt-4 space-y-3.5">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-xs text-slate-600">
                          Status
                        </span>

                        <span className="text-xs font-medium text-slate-300">
                          {isActiveParticipantOnline
                            ? "Online"
                            : "Offline"}
                        </span>
                      </div>

                      <div className="h-px bg-white/[0.05]" />

                      <div className="flex items-center justify-between gap-3">
                        <span className="text-xs text-slate-600">
                          Mail
                        </span>

                        <span className="max-w-[145px] truncate text-xs font-medium text-slate-300">
                          {activeParticipant.utromail_address ||
                            "UTroMail"}
                        </span>
                      </div>

                      <div className="h-px bg-white/[0.05]" />

                      <div className="flex items-center justify-between gap-3">
                        <span className="text-xs text-slate-600">
                          Messages
                        </span>

                        <span className="text-xs font-medium text-slate-300">
                          {messages.length}
                        </span>
                      </div>
                    </div>
                  </section>

                  <section className="mt-3 rounded-xl border border-white/[0.07] bg-white/[0.018] p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-600">
                      Actions
                    </p>

                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        className="flex flex-col items-center justify-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-xs font-medium text-slate-400 transition hover:bg-white/[0.05] hover:text-white"
                      >
                        <Phone className="h-4 w-4" />
                        Call
                      </button>

                      <button
                        type="button"
                        className="flex flex-col items-center justify-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-xs font-medium text-slate-400 transition hover:bg-white/[0.05] hover:text-white"
                      >
                        <Video className="h-4 w-4" />
                        Video
                      </button>
                    </div>
                  </section>
                </div>

                <div className="border-t border-white/[0.07] p-4">
                  <button
                    type="button"
                    onClick={() =>
                      navigate(
                        `/profile/${activeParticipant.username}`,
                      )
                    }
                    className="w-full rounded-xl border border-white/[0.08] bg-white/[0.025] px-4 py-2.5 text-xs font-semibold text-slate-300 transition hover:border-[#5965f2]/30 hover:bg-[#5965f2]/[0.07] hover:text-white"
                  >
                    View profile
                  </button>
                </div>
              </>
            ) : (
              <div className="flex h-full items-center justify-center p-6 text-center">
                <div>
                  <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-white/[0.025]">
                    <Search className="h-5 w-5 text-slate-700" />
                  </div>

                  <p className="mt-4 text-sm font-medium text-slate-400">
                    Contact details
                  </p>

                  <p className="mt-2 text-xs leading-5 text-slate-600">
                    Select a conversation to view
                    contact information.
                  </p>
                </div>
              </div>
            )}
          </aside>
        </div>
      </div>

      {/* ======================================================
          MOBILE CHAT
      ====================================================== */}

      {showMobileChat && (
        <div className="fixed inset-0 z-[200] flex flex-col overflow-hidden bg-[#0a0d14] lg:hidden">
          {chatPanel}
        </div>
      )}

      {/* ======================================================
          CONTEXT MENU
      ====================================================== */}

      {contextMenu && (
        <>
          <div
            className="fixed inset-0 z-[999] bg-black/20"
            onClick={() =>
              setContextMenu(null)
            }
          />

          <div
            className="fixed z-[1000] min-w-[220px] overflow-hidden rounded-xl border border-white/[0.08] bg-[#12161f]/98 py-1 shadow-[0_24px_80px_rgba(0,0,0,0.55)] backdrop-blur-2xl"
            style={{
              left: Math.min(
                contextMenu.x,
                window.innerWidth - 240,
              ),
              top: Math.min(
                contextMenu.y,
                window.innerHeight - 210,
              ),
            }}
          >
            <div className="border-b border-white/[0.07] px-4 py-3">
              <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-slate-600">
                Conversation
              </p>

              <p className="mt-1 truncate text-sm font-semibold text-white">
                {contextMenu.otherUsername}
              </p>
            </div>

            <button
              type="button"
              onClick={async () => {
                try {
                  await blockUser(
                    user!.id,
                    contextMenu.otherUserId,
                  );

                  toast.success(
                    `Blocked ${contextMenu.otherUsername}`,
                  );

                  setContextMenu(null);
                  fetchThreadsRef.current?.();
                } catch (err: any) {
                  toast.error(
                    err.message ||
                      "Failed to block user",
                  );
                }
              }}
              className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-medium text-red-400 transition hover:bg-red-500/[0.08]"
            >
              <Ban className="h-4 w-4" />
              Block user
            </button>

            <button
              type="button"
              onClick={async () => {
                const reason = prompt(
                  "Report reason:",
                );

                if (!reason?.trim()) return;

                try {
                  await reportMessage(
                    contextMenu.otherUserId,
                    contextMenu.threadId,
                    reason.trim(),
                  );

                  toast.success(
                    "Report submitted",
                  );

                  setContextMenu(null);
                } catch (err: any) {
                  toast.error(
                    err.message ||
                      "Failed to submit report",
                  );
                }
              }}
              className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-medium text-amber-400 transition hover:bg-amber-500/[0.08]"
            >
              <Flag className="h-4 w-4" />
              Report conversation
            </button>

            <button
              type="button"
              onClick={async () => {
                try {
                  await deleteThread(
                    contextMenu.threadId,
                    user!.id,
                  );

                  toast.success(
                    "Conversation removed",
                  );

                  setContextMenu(null);

                  if (
                    activeConversationId ===
                    contextMenu.threadId
                  ) {
                    setActiveConversationId(
                      null,
                    );

                    setShowMobileChat(false);
                  }

                  fetchThreadsRef.current?.();
                } catch (err: any) {
                  toast.error(
                    err.message ||
                      "Failed to remove conversation",
                  );
                }
              }}
              className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-medium text-slate-400 transition hover:bg-white/[0.05] hover:text-white"
            >
              <Trash2 className="h-4 w-4" />
              Remove conversation
            </button>
          </div>
        </>
      )}
    </div>
  );
}