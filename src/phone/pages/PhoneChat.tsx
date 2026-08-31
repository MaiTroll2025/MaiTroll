import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuthStore } from '@/lib/store'
import { supabase } from '@/lib/supabase'
import {
  ArrowLeft,
  Send,
  Search,
  Loader2,
  MessageCircle,
  Check,
  CheckCheck,
  Sparkles,
  Lock,
  ChevronRight,
} from 'lucide-react'
import {
  getThreads,
  getThreadMessages,
  sendMessage,
  markThreadAsRead,
  getOtherParticipant,
} from '@/services/utromailService'
import type {
  UtromailThread,
  UtromailMessage,
} from '@/types/mail'
import { toast } from 'sonner'

type LocalMessage = UtromailMessage & {
  local_status?: 'sending' | 'sent' | 'failed'
  local_id?: string
}

function formatTime(dateStr: string): string {
  const d = new Date(dateStr)
  const now = new Date()
  const diff = now.getTime() - d.getTime()

  if (diff < 60000) return 'Just now'

  if (diff < 3600000) {
    return `${Math.floor(diff / 60000)}m`
  }

  if (diff < 86400000) {
    return d.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return d.toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
  })
}

function getMessageTimestamp(message: UtromailMessage): string {
  return message.sent_at || message.created_at
}

function getInitial(name?: string | null): string {
  return (name || '?').charAt(0).toUpperCase()
}

export default function PhoneChat() {
  const navigate = useNavigate()
  const { threadId } = useParams()
  const { user, profile } = useAuthStore()

  const [threads, setThreads] = useState<UtromailThread[]>([])
  const [loadingThreads, setLoadingThreads] = useState(true)

  const [activeThreadId, setActiveThreadId] = useState<string | null>(
    threadId || null,
  )

  const [messages, setMessages] = useState<LocalMessage[]>([])
  const [msgLoading, setMsgLoading] = useState(false)

  const [replyText, setReplyText] = useState('')
  const [sending, setSending] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const realtimeChannelsRef = useRef<
    ReturnType<typeof supabase.channel>[]
  >([])

  const pendingMessagesRef = useRef<Map<string, string>>(new Map())

  /*
   * ------------------------------------------------------------
   * THREADS
   * ------------------------------------------------------------
   */

  const fetchThreads = useCallback(async () => {
    if (!user?.id) return

    try {
      const data = await getThreads(user.id, 'inbox')
      setThreads(data || [])
    } catch (err) {
      console.error('[PhoneChat] Error fetching threads:', err)
    } finally {
      setLoadingThreads(false)
    }
  }, [user?.id])

  useEffect(() => {
    void fetchThreads()
  }, [fetchThreads])

  /*
   * ------------------------------------------------------------
   * MOVE THREAD TO TOP
   * ------------------------------------------------------------
   *
   * IMPORTANT:
   * UtromailThread.last_message is typed as a complete
   * UtromailMessage. We therefore never construct a partial
   * last_message object here.
   */

  const moveThreadToTop = useCallback(
    (
      threadIdToMove: string,
      previewBody?: string,
      timestamp?: string,
    ) => {
      setThreads((prev) => {
        const index = prev.findIndex(
          (thread) => thread.id === threadIdToMove,
        )

        if (index === -1) return prev

        const existing = prev[index]

        const messageTime =
          timestamp ||
          existing.last_message_at ||
          new Date().toISOString()

        let updatedLastMessage = existing.last_message

        if (existing.last_message && previewBody) {
          updatedLastMessage = {
            ...existing.last_message,
            body: previewBody,
            sent_at: messageTime,
            created_at: messageTime,
            updated_at: messageTime,
          }
        }

        const updated: UtromailThread = {
          ...existing,
          last_message_at: messageTime,
          last_message: updatedLastMessage,
        }

        return [
          updated,
          ...prev.filter(
            (thread) => thread.id !== threadIdToMove,
          ),
        ]
      })
    },
    [],
  )

  /*
   * ------------------------------------------------------------
   * LOAD ACTIVE CONVERSATION
   * ------------------------------------------------------------
   */

  const fetchMessages = useCallback(
    async (tid: string) => {
      if (!user?.id) return

      setMsgLoading(true)

      try {
        const msgs = await getThreadMessages(tid)

        setMessages(
          (msgs || []).map((message) => ({
            ...message,
            local_status: 'sent',
          })),
        )

        await markThreadAsRead(tid, user.id)
        await fetchThreads()

        requestAnimationFrame(() => {
          setTimeout(() => {
            bottomRef.current?.scrollIntoView({
              behavior: 'auto',
            })
          }, 30)
        })
      } catch (err) {
        console.error(
          '[PhoneChat] Error fetching messages:',
          err,
        )
      } finally {
        setMsgLoading(false)
      }
    },
    [fetchThreads, user?.id],
  )

  useEffect(() => {
    if (!activeThreadId) {
      setMessages([])
      return
    }

    void fetchMessages(activeThreadId)
  }, [activeThreadId, fetchMessages])

  /*
   * ------------------------------------------------------------
   * SCROLL
   * ------------------------------------------------------------
   */

  const scrollToBottom = useCallback(
    (behavior: ScrollBehavior = 'smooth') => {
      requestAnimationFrame(() => {
        bottomRef.current?.scrollIntoView({
          behavior,
          block: 'end',
        })
      })
    },
    [],
  )

  /*
   * ------------------------------------------------------------
   * REALTIME ACTIVE CHAT
   * ------------------------------------------------------------
   */

  useEffect(() => {
    if (!activeThreadId || !user?.id) return

    const channel = supabase
      .channel(`phone-premium-chat:${activeThreadId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'utromail_messages',
          filter: `thread_id=eq.${activeThreadId}`,
        },
        async (payload) => {
          try {
            const newMsg = payload.new as any

            if (!newMsg?.id) return

            const matchingLocalId =
              pendingMessagesRef.current.get(newMsg.id)

            if (matchingLocalId) {
              setMessages((prev) =>
                prev.map((message) =>
                  message.local_id === matchingLocalId
                    ? {
                        ...message,
                        id: newMsg.id,
                        local_status: 'sent',
                      }
                    : message,
                ),
              )

              pendingMessagesRef.current.delete(newMsg.id)
              return
            }

            const { data: fullMsg } = await supabase
              .from('utromail_messages')
              .select('*')
              .eq('id', newMsg.id)
              .maybeSingle()

            const msgData = fullMsg || newMsg

            if (msgData.sender_id === user.id) {
              setMessages((prev) => {
                if (
                  prev.some(
                    (message) =>
                      message.id === msgData.id,
                  )
                ) {
                  return prev
                }

                return prev
              })

              return
            }

            const { data: senderProfile } = await supabase
              .from('user_profiles')
              .select(
                'username, display_name, avatar_url',
              )
              .eq('id', msgData.sender_id)
              .maybeSingle()

            const mappedMsg: LocalMessage = {
              id: msgData.id,
              thread_id: msgData.thread_id,
              sender_id: msgData.sender_id,
              sender_mail_address:
                msgData.sender_mail_address,
              recipient_id: msgData.recipient_id,
              recipient_mail_address:
                msgData.recipient_mail_address,
              subject: msgData.subject,
              body: msgData.body,
              body_html: msgData.body_html,
              message_type:
                msgData.message_type || 'normal',
              is_starred:
                msgData.is_starred ?? false,
              is_draft:
                msgData.is_draft ?? false,
              parent_message_id:
                msgData.parent_message_id,
              sent_at:
                msgData.sent_at || msgData.created_at,
              created_at: msgData.created_at,
              updated_at:
                msgData.updated_at ||
                msgData.created_at,

              sender_name:
                (senderProfile as any)?.display_name ||
                (senderProfile as any)?.username ||
                undefined,

              sender_username:
                (senderProfile as any)?.username ||
                undefined,

              sender_avatar:
                (senderProfile as any)?.avatar_url ||
                undefined,

              is_read: true,
              local_status: 'sent',
            }

            setMessages((prev) => {
              if (
                prev.some(
                  (message) =>
                    message.id === mappedMsg.id,
                )
              ) {
                return prev
              }

              return [...prev, mappedMsg]
            })

            moveThreadToTop(
              activeThreadId,
              mappedMsg.body,
              getMessageTimestamp(mappedMsg),
            )

            await markThreadAsRead(
              activeThreadId,
              user.id,
            )

            scrollToBottom('smooth')
          } catch (err) {
            console.error(
              '[PhoneChat] Realtime message error:',
              err,
            )
          }
        },
      )
      .subscribe()

    realtimeChannelsRef.current.push(channel)

    return () => {
      realtimeChannelsRef.current =
        realtimeChannelsRef.current.filter(
          (item) => item !== channel,
        )

      void supabase.removeChannel(channel)
    }
  }, [
    activeThreadId,
    moveThreadToTop,
    scrollToBottom,
    user?.id,
  ])

  /*
   * ------------------------------------------------------------
   * REALTIME INBOX
   * ------------------------------------------------------------
   */

  useEffect(() => {
    if (!user?.id) return

    const channel = supabase
      .channel(`phone-premium-inbox:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'utromail_messages',
        },
        async (payload) => {
          const newMsg = payload.new as any

          if (!newMsg?.thread_id) return
          if (newMsg.sender_id === user.id) return

          try {
            const threadIdFromMessage =
              newMsg.thread_id

            if (
              threadIdFromMessage === activeThreadId
            ) {
              return
            }

            const latestThreads = await getThreads(
              user.id,
              'inbox',
            )

            setThreads(latestThreads || [])
          } catch (err) {
            console.error(
              '[PhoneChat] Inbox realtime error:',
              err,
            )
          }
        },
      )
      .subscribe()

    realtimeChannelsRef.current.push(channel)

    return () => {
      realtimeChannelsRef.current =
        realtimeChannelsRef.current.filter(
          (item) => item !== channel,
        )

      void supabase.removeChannel(channel)
    }
  }, [activeThreadId, user?.id])

  /*
   * ------------------------------------------------------------
   * JAIL STATUS
   * ------------------------------------------------------------
   */

  useEffect(() => {
    if (!user?.id) return

    const channel = supabase
      .channel(`phone-chat-jail:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'jail',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          void fetchThreads()
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [user?.id, fetchThreads])

  /*
   * ------------------------------------------------------------
   * SEND MESSAGE
   * ------------------------------------------------------------
   */

  const handleSend = async () => {
    if (
      !replyText.trim() ||
      !activeThreadId ||
      !user ||
      sending
    ) {
      return
    }

    const activeThread = threads.find(
      (thread) => thread.id === activeThreadId,
    )

    if (!activeThread) return

    const body = replyText.trim()
    const lastMsg = messages[messages.length - 1]

    if (!lastMsg) {
      toast.error(
        'Unable to determine the recipient.',
      )
      return
    }

    const recipientId =
      lastMsg.sender_id === user.id
        ? lastMsg.recipient_id
        : lastMsg.sender_id

    const recipientMail =
      lastMsg.sender_id === user.id
        ? lastMsg.recipient_mail_address
        : lastMsg.sender_mail_address

    if (!recipientId || !recipientMail) {
      toast.error(
        'Unable to determine the recipient.',
      )
      return
    }

    const localId = `local-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}`

    const now = new Date().toISOString()

    const optimisticMessage: LocalMessage = {
      id: localId,
      local_id: localId,
      thread_id: activeThreadId,
      sender_id: user.id,
      sender_mail_address:
        `${profile?.username || 'user'}@utromail`,
      recipient_id: recipientId,
      recipient_mail_address: recipientMail,
      subject: 'Direct Message',
      body,
      body_html: null,

      // MessageType does not contain "direct".
      // Normal is the correct type for a regular private message.
      message_type: 'normal',

      is_starred: false,
      is_draft: false,
      parent_message_id: lastMsg.id,
      sent_at: now,
      created_at: now,
      updated_at: now,

      sender_name:
        profile?.display_name ||
        profile?.username ||
        'You',

      sender_username:
        profile?.username || undefined,

      sender_avatar:
        profile?.avatar_url || undefined,

      is_read: false,
      local_status: 'sending',
    }

    setMessages((prev) => [
      ...prev,
      optimisticMessage,
    ])

    moveThreadToTop(
      activeThreadId,
      body,
      now,
    )

    setReplyText('')
    scrollToBottom('smooth')
    setSending(true)

    try {
      const sentMessage = await sendMessage({
        senderId: user.id,

        senderMail:
          `${profile?.username || 'user'}@utromail`,

        recipientId,
        recipientMail,

        subject: 'Direct Message',
        body,
        parentMessageId: lastMsg.id,
      })

      if (sentMessage?.id) {
        pendingMessagesRef.current.set(
          sentMessage.id,
          localId,
        )

        setMessages((prev) =>
          prev.map((message) =>
            message.local_id === localId
              ? {
                  ...message,
                  id: sentMessage.id,
                  local_status: 'sent',
                  sent_at:
                    sentMessage.sent_at ||
                    message.sent_at,
                  created_at:
                    sentMessage.created_at ||
                    message.created_at,
                  updated_at:
                    sentMessage.updated_at ||
                    message.updated_at,
                  message_type:
                    sentMessage.message_type ||
                    message.message_type,
                  is_read:
                    sentMessage.is_read ??
                    message.is_read,
                }
              : message,
          ),
        )
      } else {
        setMessages((prev) =>
          prev.map((message) =>
            message.local_id === localId
              ? {
                  ...message,
                  local_status: 'sent',
                }
              : message,
          ),
        )
      }

      moveThreadToTop(
        activeThreadId,
        body,
        sentMessage?.sent_at || now,
      )
    } catch (err: any) {
      console.error(
        '[PhoneChat] Send failed:',
        err,
      )

      setMessages((prev) =>
        prev.map((message) =>
          message.local_id === localId
            ? {
                ...message,
                local_status: 'failed',
              }
            : message,
        ),
      )

      setReplyText(body)

      toast.error(
        err?.message ||
          'Message could not be sent',
      )
    } finally {
      setSending(false)

      requestAnimationFrame(() => {
        inputRef.current?.focus()
      })
    }
  }

  /*
   * ------------------------------------------------------------
   * KEYBOARD
   * ------------------------------------------------------------
   */

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLTextAreaElement>,
  ) => {
    if (
      e.key === 'Enter' &&
      !e.shiftKey
    ) {
      e.preventDefault()
      void handleSend()
    }
  }

  /*
   * ------------------------------------------------------------
   * NAVIGATION
   * ------------------------------------------------------------
   */

  const openThread = (tid: string) => {
    setActiveThreadId(tid)
    navigate(`/utromail/${tid}`)
  }

  const backToThreads = () => {
    setActiveThreadId(null)
    setMessages([])
    navigate('/utromail')
  }

  /*
   * ------------------------------------------------------------
   * SEARCH
   * ------------------------------------------------------------
   */

  const filteredThreads = useMemo(() => {
    const query =
      searchQuery.trim().toLowerCase()

    if (!query) return threads

    return threads.filter((thread) => {
      const other = getOtherParticipant(
        thread,
        user?.id || '',
      )

      const name =
        other?.username ||
        other?.display_name ||
        ''

      const preview =
        thread.last_message?.body || ''

      return (
        name
          .toLowerCase()
          .includes(query) ||
        preview
          .toLowerCase()
          .includes(query)
      )
    })
  }, [
    searchQuery,
    threads,
    user?.id,
  ])

  /*
   * ------------------------------------------------------------
   * ACTIVE PARTICIPANT
   * ------------------------------------------------------------
   */

  const activeThread = threads.find(
    (thread) => thread.id === activeThreadId,
  )

  const activeOther = activeThread
    ? getOtherParticipant(
        activeThread,
        user?.id || '',
      )
    : null

  const activeDisplayName =
    activeOther?.display_name ||
    activeOther?.username ||
    'Unknown'

  /*
   * ------------------------------------------------------------
   * UI
   * ------------------------------------------------------------
   */

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-[#03040A] text-white">
      {/* PREMIUM ATMOSPHERE */}

      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-[28rem] w-[28rem] rounded-full bg-[#00BFFF]/10 blur-[140px]" />

        <div className="absolute -right-40 top-0 h-[32rem] w-[32rem] rounded-full bg-[#BF00FF]/10 blur-[150px]" />

        <div className="absolute bottom-[-12rem] left-1/2 h-[28rem] w-[28rem] -translate-x-1/2 rounded-full bg-[#00BFFF]/[0.045] blur-[140px]" />

        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.035),transparent_35%)]" />
      </div>

      {/* TOP HEADER */}

      <header className="sticky top-0 z-50 border-b border-white/[0.07] bg-[#05060D]/80 backdrop-blur-2xl">
        <div className="mx-auto flex h-[68px] w-full max-w-3xl items-center justify-between px-4">
          <button
            type="button"
            onClick={() =>
              activeThreadId
                ? backToThreads()
                : navigate(-1)
            }
            className="group grid h-10 w-10 place-items-center rounded-xl border border-white/[0.08] bg-white/[0.035] text-white/75 shadow-[0_8px_30px_rgba(0,0,0,0.25)] transition-all hover:border-white/[0.15] hover:bg-white/[0.07] hover:text-white active:scale-95"
            aria-label="Back"
          >
            <ArrowLeft
              size={18}
              className="transition-transform group-hover:-translate-x-0.5"
            />
          </button>

          <div className="text-center">
            <div className="flex items-center justify-center gap-2">
              <Sparkles
                size={12}
                className="text-[#00BFFF]"
              />

              <h1 className="text-[12px] font-black uppercase tracking-[0.28em] text-white">
                {activeThreadId
                  ? activeDisplayName
                  : 'UTroMail'}
              </h1>

              <Sparkles
                size={12}
                className="text-[#BF00FF]"
              />
            </div>

            <p className="mt-1 text-[8px] font-black uppercase tracking-[0.25em] text-white/30">
              {activeThreadId
                ? 'Private conversation'
                : 'Messages'}
            </p>
          </div>

          <div className="h-10 w-10" />
        </div>
      </header>

      <main className="relative z-10 mx-auto h-[calc(100vh-68px)] w-full max-w-3xl">
        {!activeThreadId ? (
          /* INBOX */
          <div className="flex h-full flex-col">
            {/* Search */}

            <div className="border-b border-white/[0.06] bg-[#05060D]/70 p-4 backdrop-blur-2xl">
              <div className="relative">
                <Search
                  size={16}
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-white/25"
                />

                <input
                  value={searchQuery}
                  onChange={(e) =>
                    setSearchQuery(e.target.value)
                  }
                  placeholder="Search conversations"
                  className="h-12 w-full rounded-2xl border border-white/[0.08] bg-white/[0.035] pl-11 pr-4 text-sm font-medium text-white outline-none transition-all placeholder:text-white/25 focus:border-[#00BFFF]/35 focus:bg-white/[0.055] focus:ring-4 focus:ring-[#00BFFF]/[0.06]"
                />

                <div className="pointer-events-none absolute inset-y-0 right-4 flex items-center">
                  <span className="rounded-lg border border-white/[0.06] bg-white/[0.025] px-2 py-1 text-[8px] font-black uppercase tracking-wider text-white/20">
                    Mail
                  </span>
                </div>
              </div>
            </div>

            {/* Inbox heading */}

            <div className="flex items-center justify-between px-5 pb-2 pt-5">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#00BFFF]">
                  Your inbox
                </p>

                <h2 className="mt-1 text-xl font-black tracking-tight">
                  Conversations
                </h2>
              </div>

              {threads.length > 0 && (
                <div className="rounded-full border border-white/[0.07] bg-white/[0.035] px-3 py-1.5 text-[9px] font-bold text-white/40">
                  {threads.length}{' '}
                  {threads.length === 1
                    ? 'thread'
                    : 'threads'}
                </div>
              )}
            </div>

            {/* Thread list */}

            <div className="flex-1 overflow-y-auto px-3 pb-6 pt-2">
              {loadingThreads ? (
                <div className="flex items-center justify-center py-24">
                  <div className="relative">
                    <div className="absolute -inset-5 rounded-full bg-[#00BFFF]/10 blur-2xl" />

                    <Loader2 className="relative h-6 w-6 animate-spin text-[#00BFFF]" />
                  </div>
                </div>
              ) : filteredThreads.length === 0 ? (
                <div className="flex flex-col items-center justify-center px-6 py-28 text-center">
                  <div className="relative">
                    <div className="absolute -inset-4 rounded-[2rem] bg-gradient-to-br from-[#00BFFF]/10 to-[#BF00FF]/10 blur-xl" />

                    <div className="relative grid h-20 w-20 place-items-center rounded-[1.7rem] border border-white/[0.09] bg-white/[0.035] shadow-2xl">
                      <MessageCircle
                        size={30}
                        className="text-white/20"
                      />
                    </div>
                  </div>

                  <p className="mt-6 text-base font-black text-white/75">
                    No conversations yet
                  </p>

                  <p className="mt-2 max-w-xs text-xs leading-5 text-white/30">
                    When someone messages you,
                    your conversation will appear
                    here.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredThreads.map(
                    (thread, index) => {
                      const other =
                        getOtherParticipant(
                          thread,
                          user?.id || '',
                        )

                      const lastMessage =
                        thread.last_message

                      const displayName =
                        other?.display_name ||
                        other?.username ||
                        'Unknown'

                      const unread =
                        (thread.unread_count || 0) >
                        0

                      const isTop = index === 0

                      return (
                        <button
                          key={thread.id}
                          type="button"
                          onClick={() =>
                            openThread(thread.id)
                          }
                          className={`group relative flex w-full items-center gap-3 overflow-hidden rounded-[1.35rem] border p-3.5 text-left transition-all duration-200 active:scale-[0.985] ${
                            unread
                              ? 'border-[#00BFFF]/15 bg-gradient-to-r from-[#00BFFF]/[0.075] via-[#BF00FF]/[0.045] to-white/[0.015] shadow-[0_10px_40px_rgba(0,0,0,0.16)]'
                              : 'border-white/[0.055] bg-white/[0.018] hover:border-white/[0.10] hover:bg-white/[0.035]'
                          }`}
                        >
                          {isTop && (
                            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#00BFFF]/50 to-transparent" />
                          )}

                          {unread && (
                            <div className="absolute inset-y-4 left-0 w-[2px] rounded-r-full bg-gradient-to-b from-[#00BFFF] to-[#BF00FF] shadow-[0_0_12px_rgba(0,191,255,0.7)]" />
                          )}

                          {/* Avatar */}

                          <div className="relative shrink-0">
                            <div className="absolute -inset-1 rounded-full bg-gradient-to-br from-[#00BFFF] to-[#BF00FF] opacity-25 blur-md transition-opacity group-hover:opacity-45" />

                            <div className="relative flex h-[52px] w-[52px] items-center justify-center overflow-hidden rounded-full border-2 border-[#070812] bg-gradient-to-br from-[#00BFFF] via-[#6D5CFF] to-[#BF00FF] text-sm font-black shadow-xl">
                              {other?.avatar_url ? (
                                <img
                                  src={
                                    other.avatar_url
                                  }
                                  alt=""
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <span>
                                  {getInitial(
                                    displayName,
                                  )}
                                </span>
                              )}
                            </div>

                            {unread && (
                              <span className="absolute -right-0.5 -top-0.5 h-3.5 w-3.5 rounded-full border-2 border-[#080811] bg-[#00BFFF] shadow-[0_0_12px_rgba(0,191,255,0.9)]" />
                            )}
                          </div>

                          {/* Thread body */}

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <div className="flex min-w-0 flex-1 items-center gap-1.5">
                                <p
                                  className={`truncate text-sm ${
                                    unread
                                      ? 'font-black text-white'
                                      : 'font-bold text-white/75'
                                  }`}
                                >
                                  {displayName}
                                </p>

                                {thread.other_is_jailed && (
                                  <Lock
                                    className="h-3.5 w-3.5 shrink-0 text-red-400"
                                    aria-label="In custody"
                                  />
                                )}
                              </div>

                              {lastMessage && (
                                <span
                                  className={`shrink-0 text-[9px] ${
                                    unread
                                      ? 'font-black text-[#00BFFF]'
                                      : 'font-medium text-white/25'
                                  }`}
                                >
                                  {formatTime(
                                    lastMessage.sent_at ||
                                      lastMessage.created_at,
                                  )}
                                </span>
                              )}
                            </div>

                            <div className="mt-1.5 flex items-center gap-2">
                              <p
                                className={`min-w-0 flex-1 truncate text-xs ${
                                  unread
                                    ? 'font-semibold text-white/60'
                                    : 'text-white/30'
                                }`}
                              >
                                {lastMessage
                                  ? lastMessage.body
                                  : 'No messages yet'}
                              </p>

                              {unread && (
                                <span className="grid min-w-5 place-items-center rounded-full bg-gradient-to-r from-[#00BFFF] to-[#BF00FF] px-1.5 py-0.5 text-[9px] font-black text-white shadow-[0_0_14px_rgba(191,0,255,0.35)]">
                                  {thread.unread_count}
                                </span>
                              )}

                              <ChevronRight
                                size={14}
                                className="shrink-0 text-white/15 transition-transform group-hover:translate-x-0.5 group-hover:text-white/35"
                              />
                            </div>
                          </div>
                        </button>
                      )
                    },
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* CHAT */
          <div className="flex h-full flex-col">
            {/* Conversation identity */}

            <div className="relative shrink-0 overflow-hidden border-b border-white/[0.07] bg-[#05060D]/80 px-4 py-3 backdrop-blur-2xl">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_50%,rgba(0,191,255,0.07),transparent_30%),radial-gradient(circle_at_90%_50%,rgba(191,0,255,0.07),transparent_30%)]" />

              <div className="relative flex items-center gap-3">
                <div className="relative shrink-0">
                  <div className="absolute -inset-1 rounded-full bg-gradient-to-br from-[#00BFFF] to-[#BF00FF] opacity-35 blur-md" />

                  <div className="relative flex h-11 w-11 items-center justify-center overflow-hidden rounded-full border-2 border-[#070812] bg-gradient-to-br from-[#00BFFF] via-[#6D5CFF] to-[#BF00FF] text-sm font-black">
                    {activeOther?.avatar_url ? (
                      <img
                        src={
                          activeOther.avatar_url
                        }
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      getInitial(activeDisplayName)
                    )}
                  </div>

                  <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-[#070812] bg-[#38FCA3] shadow-[0_0_9px_rgba(56,252,163,0.8)]" />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-black text-white">
                    {activeDisplayName}
                  </p>

                  <div className="mt-0.5 flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#38FCA3] shadow-[0_0_6px_rgba(56,252,163,0.8)]" />

                    <p className="text-[8px] font-black uppercase tracking-[0.2em] text-white/35">
                      Private conversation
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Messages */}

            <div className="relative flex-1 overflow-y-auto">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_5%,rgba(0,191,255,0.055),transparent_28%),radial-gradient(circle_at_90%_15%,rgba(191,0,255,0.06),transparent_30%)]" />

              <div className="relative min-h-full px-4 pb-5 pt-4">
                {msgLoading ? (
                  <div className="flex items-center justify-center py-24">
                    <div className="relative">
                      <div className="absolute -inset-4 rounded-full bg-[#00BFFF]/10 blur-xl" />

                      <Loader2 className="relative h-6 w-6 animate-spin text-[#00BFFF]" />
                    </div>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex min-h-[60%] items-center justify-center">
                    <div className="text-center">
                      <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-white/[0.07] bg-white/[0.025]">
                        <MessageCircle
                          size={22}
                          className="text-white/20"
                        />
                      </div>

                      <p className="mt-4 text-xs font-black uppercase tracking-[0.16em] text-white/30">
                        Start the conversation
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {messages.map(
                      (msg, index) => {
                        const isOwn =
                          msg.sender_id ===
                          user?.id

                        const previous =
                          messages[index - 1]

                        const grouped =
                          previous &&
                          previous.sender_id ===
                            msg.sender_id

                        return (
                          <div
                            key={
                              msg.local_id ||
                              msg.id
                            }
                            className={`flex ${
                              isOwn
                                ? 'justify-end'
                                : 'justify-start'
                            } ${
                              !grouped
                                ? 'mt-4'
                                : 'mt-1'
                            }`}
                          >
                            <div
                              className={`relative max-w-[84%] ${
                                isOwn
                                  ? 'items-end'
                                  : 'items-start'
                              }`}
                            >
                              {isOwn &&
                                msg.local_status ===
                                  'sending' && (
                                  <div className="absolute -inset-1 rounded-[1.6rem] bg-[#00BFFF]/15 blur-lg" />
                                )}

                              <div
                                className={`relative overflow-hidden rounded-[1.45rem] px-4 py-3 shadow-[0_8px_30px_rgba(0,0,0,0.12)] ${
                                  isOwn
                                    ? `rounded-br-md bg-gradient-to-br from-[#00BFFF] via-[#397CFF] to-[#BF00FF] text-white ${
                                        msg.local_status ===
                                        'sending'
                                          ? 'opacity-75'
                                          : ''
                                      }`
                                    : 'rounded-bl-md border border-white/[0.08] bg-white/[0.045] text-white/90 backdrop-blur-xl'
                                }`}
                              >
                                <p className="whitespace-pre-wrap break-words text-sm leading-6">
                                  {msg.body}
                                </p>

                                <div
                                  className={`mt-1.5 flex items-center justify-end gap-1.5 text-[9px] ${
                                    isOwn
                                      ? 'text-white/60'
                                      : 'text-white/25'
                                  }`}
                                >
                                  <span>
                                    {msg.local_status ===
                                    'sending'
                                      ? 'Sending…'
                                      : msg.local_status ===
                                        'failed'
                                      ? 'Failed'
                                      : formatTime(
                                          getMessageTimestamp(
                                            msg,
                                          ),
                                        )}
                                  </span>

                                  {isOwn &&
                                    msg.local_status !==
                                      'failed' &&
                                    (msg.local_status ===
                                    'sending' ? (
                                      <Loader2
                                        size={11}
                                        className="animate-spin"
                                      />
                                    ) : msg.is_read ? (
                                      <CheckCheck
                                        size={12}
                                        className="text-white"
                                      />
                                    ) : (
                                      <Check
                                        size={12}
                                      />
                                    ))}
                                </div>
                              </div>
                            </div>
                          </div>
                        )
                      },
                    )}

                    <div
                      ref={bottomRef}
                      className="h-1"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Composer */}

            <div className="relative shrink-0 border-t border-white/[0.07] bg-[#05060D]/85 px-3 pb-[calc(10px+env(safe-area-inset-bottom,0px))] pt-3 backdrop-blur-2xl">
              <div
                className={`relative flex items-end gap-2 rounded-[1.35rem] border bg-white/[0.035] p-1.5 transition-all duration-200 ${
                  replyText.trim()
                    ? 'border-[#00BFFF]/30 bg-white/[0.045] shadow-[0_0_35px_rgba(0,191,255,0.08)]'
                    : 'border-white/[0.08]'
                }`}
              >
                <textarea
                  ref={inputRef}
                  value={replyText}
                  onChange={(e) =>
                    setReplyText(
                      e.target.value,
                    )
                  }
                  onKeyDown={handleKeyDown}
                  placeholder={`Message ${
                    activeOther?.username ||
                    'member'
                  }...`}
                  rows={1}
                  className="max-h-28 min-h-[42px] flex-1 resize-none bg-transparent px-3 py-2.5 text-sm leading-5 text-white outline-none placeholder:text-white/20"
                />

                <button
                  type="button"
                  onClick={() =>
                    void handleSend()
                  }
                  disabled={
                    !replyText.trim() ||
                    sending
                  }
                  className="group relative grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-xl bg-gradient-to-br from-[#00BFFF] to-[#BF00FF] text-white shadow-[0_0_24px_rgba(0,191,255,0.22)] transition-all hover:shadow-[0_0_30px_rgba(191,0,255,0.3)] active:scale-90 disabled:cursor-not-allowed disabled:opacity-25"
                  aria-label="Send message"
                >
                  <span className="absolute inset-0 bg-white/20 opacity-0 transition-opacity group-hover:opacity-100" />

                  {sending ? (
                    <Loader2
                      size={17}
                      className="relative animate-spin"
                    />
                  ) : (
                    <Send
                      size={17}
                      className="relative -ml-0.5"
                    />
                  )}
                </button>
              </div>

              <div className="mt-2 flex items-center justify-center gap-2 text-[8px] font-black uppercase tracking-[0.18em] text-white/15">
                <span>Enter to send</span>
                <span className="h-0.5 w-0.5 rounded-full bg-white/15" />
                <span>
                  Shift + Enter for new line
                </span>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
