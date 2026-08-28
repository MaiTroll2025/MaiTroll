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

function getMessageTimestamp(message: UtromailMessage) {
  return message.sent_at || message.created_at
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

  const realtimeChannelsRef = useRef<ReturnType<
    typeof supabase.channel
  >[]>([])

  const pendingMessagesRef = useRef<
    Map<string, string>
  >(new Map())

  const shouldStickToBottomRef = useRef(true)

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
    fetchThreads()
  }, [fetchThreads])

  /*
   * ------------------------------------------------------------
   * KEEP CONVERSATION AT TOP
   * ------------------------------------------------------------
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

        if (index === -1) {
          return prev
        }

        const existing = prev[index]

        const updated: UtromailThread = {
          ...existing,

          last_message_at:
            timestamp ||
            existing.last_message_at ||
            new Date().toISOString(),

          last_message: previewBody
            ? {
                ...(existing.last_message || {}),
                body: previewBody,
                sent_at:
                  timestamp ||
                  existing.last_message?.sent_at ||
                  new Date().toISOString(),
                created_at:
                  timestamp ||
                  existing.last_message?.created_at ||
                  new Date().toISOString(),
              }
            : existing.last_message,
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

        /*
         * Refresh the thread list after opening so unread count
         * disappears immediately.
         */
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

    fetchMessages(activeThreadId)
  }, [activeThreadId, fetchMessages])

  /*
   * ------------------------------------------------------------
   * PREMIUM AUTO SCROLL
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

            /*
             * If this realtime message corresponds to an
             * optimistic message, replace the temporary one.
             */
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

            /*
             * Fetch complete row because realtime payload may
             * not contain all message fields.
             */
            const { data: fullMsg } = await supabase
              .from('utromail_messages')
              .select('*')
              .eq('id', newMsg.id)
              .maybeSingle()

            const msgData = fullMsg || newMsg

            /*
             * Our optimistic sender message already exists.
             * Never duplicate our own message.
             */
            if (msgData.sender_id === user.id) {
              setMessages((prev) => {
                if (
                  prev.some(
                    (message) => message.id === msgData.id,
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
              message_type: msgData.message_type,
              is_starred: false,
              is_draft: false,
              parent_message_id:
                msgData.parent_message_id,
              sent_at: msgData.sent_at,
              created_at: msgData.created_at,
              updated_at: msgData.updated_at,

              sender_name:
                (senderProfile as any)?.display_name ||
                (senderProfile as any)?.username ||
                null,

              sender_username:
                (senderProfile as any)?.username ||
                null,

              sender_avatar:
                (senderProfile as any)?.avatar_url ||
                null,

              is_read: true,
              local_status: 'sent',
            }

            setMessages((prev) => {
              if (
                prev.some(
                  (message) => message.id === mappedMsg.id,
                )
              ) {
                return prev
              }

              return [...prev, mappedMsg]
            })

            /*
             * Incoming message immediately becomes the newest
             * message in the inbox.
             */
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

      supabase.removeChannel(channel)
    }
  }, [
    activeThreadId,
    moveThreadToTop,
    scrollToBottom,
    user?.id,
  ])

  /*
   * ------------------------------------------------------------
   * REALTIME THREAD LIST
   *
   * This keeps the inbox alive even when the user is not inside
   * the conversation.
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

          /*
           * Ignore messages created by this user here.
           * handleSend already updates the inbox instantly.
           */
          if (newMsg.sender_id === user.id) return

          try {
            const threadIdFromMessage =
              newMsg.thread_id

            /*
             * If this is the currently opened conversation,
             * the active channel handles the actual message.
             */
            if (
              threadIdFromMessage ===
              activeThreadId
            ) {
              return
            }

            /*
             * Refreshing the thread list here is intentionally
             * lightweight. It guarantees the conversation gets
             * its correct participant/unread metadata.
             */
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

      supabase.removeChannel(channel)
    }
  }, [activeThreadId, user?.id])

  /*
   * ------------------------------------------------------------
   * JAIL STATUS LISTENER
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
          fetchThreads()
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user?.id, fetchThreads])

  /*
   * ------------------------------------------------------------
   * SEND MESSAGE
   *
   * Optimistic UI:
   * The message appears BEFORE Supabase finishes.
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

    /*
     * We use the last existing message to determine the
     * recipient exactly like the original system.
     */
    const lastMsg = messages[messages.length - 1]

    if (!lastMsg) {
      toast.error(
        'Unable to determine the recipient.',
      )
      return
    }

    const recipientId =
      lastMsg.sender_id === user.id
        ? lastMsg.recipient_id!
        : lastMsg.sender_id

    const recipientMail =
      lastMsg.sender_id === user.id
        ? lastMsg.recipient_mail_address!
        : lastMsg.sender_mail_address

    /*
     * Unique temporary ID.
     */
    const localId = `local-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}`

    const now = new Date().toISOString()

    /*
     * PREMIUM INSTANT MESSAGE
     */
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

      message_type: 'direct',

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
        profile?.username || null,

      sender_avatar:
        profile?.avatar_url || null,

      is_read: false,

      local_status: 'sending',
    }

    /*
     * Put message into UI immediately.
     */
    setMessages((prev) => [
      ...prev,
      optimisticMessage,
    ])

    /*
     * Immediately move conversation to top of inbox.
     */
    moveThreadToTop(
      activeThreadId,
      body,
      now,
    )

    /*
     * Clear input immediately.
     */
    setReplyText('')

    /*
     * Scroll immediately.
     */
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

      /*
       * Replace optimistic message with real DB message.
       */
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
                }
              : message,
          ),
        )
      } else {
        /*
         * If the service doesn't return the created row,
         * still mark the optimistic message as sent.
         */
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

      /*
       * Keep conversation at the very top.
       */
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

      /*
       * Mark the bubble failed rather than silently
       * disappearing.
       */
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

      /*
       * Put text back in composer.
       */
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

  /*
   * ------------------------------------------------------------
   * UI
   * ------------------------------------------------------------
   */

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-[#05030C] text-white">
      {/* Premium neon atmosphere */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-32 -top-32 h-80 w-80 rounded-full bg-[#00BFFF]/10 blur-[120px]" />

        <div className="absolute -right-32 top-20 h-96 w-96 rounded-full bg-[#BF00FF]/10 blur-[130px]" />

        <div className="absolute bottom-0 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-[#00BFFF]/5 blur-[120px]" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-50 flex h-16 items-center justify-between border-b border-white/[0.08] bg-[#07050F]/85 px-4 backdrop-blur-2xl">
        <button
          type="button"
          className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-white transition active:scale-95"
          onClick={() =>
            activeThreadId
              ? backToThreads()
              : navigate(-1)
          }
        >
          <ArrowLeft size={18} />
        </button>

        <div className="text-center">
          <div className="flex items-center justify-center gap-1.5">
            <Sparkles
              size={12}
              className="text-[#00BFFF]"
            />

            <h1 className="text-[13px] font-black uppercase tracking-[0.22em]">
              {activeThreadId
                ? activeOther?.display_name ||
                  activeOther?.username ||
                  'Chat'
                : 'Messages'}
            </h1>

            <Sparkles
              size={12}
              className="text-[#BF00FF]"
            />
          </div>

          {activeThreadId && (
            <p className="mt-0.5 text-[8px] font-bold uppercase tracking-[0.22em] text-[#00BFFF]/70">
              Live conversation
            </p>
          )}
        </div>

        <div className="w-10" />
      </header>

      <main className="relative z-10 h-[calc(100vh-64px)]">
        {/* ======================================================
            THREAD LIST
            ====================================================== */}

        {!activeThreadId ? (
          <div className="flex h-full flex-col">
            {/* Search */}
            <div className="border-b border-white/[0.06] bg-[#07050F]/80 p-3 backdrop-blur-xl">
              <div className="relative">
                <Search
                  size={16}
                  className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-600"
                />

                <input
                  value={searchQuery}
                  onChange={(e) =>
                    setSearchQuery(e.target.value)
                  }
                  placeholder="Search your conversations..."
                  className="h-11 w-full rounded-2xl border border-white/10 bg-white/[0.035] pl-10 pr-4 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-[#00BFFF]/40 focus:bg-white/[0.055] focus:ring-2 focus:ring-[#00BFFF]/10"
                />
              </div>
            </div>

            {/* Inbox */}
            <div className="flex-1 overflow-y-auto">
              {loadingThreads ? (
                <div className="flex items-center justify-center py-20">
                  <div className="relative">
                    <div className="absolute -inset-3 rounded-full bg-[#00BFFF]/20 blur-xl" />

                    <Loader2 className="relative h-6 w-6 animate-spin text-[#00BFFF]" />
                  </div>
                </div>
              ) : filteredThreads.length === 0 ? (
                <div className="flex flex-col items-center justify-center px-6 py-24 text-center">
                  <div className="grid h-16 w-16 place-items-center rounded-2xl border border-white/10 bg-gradient-to-br from-[#00BFFF]/10 to-[#BF00FF]/10">
                    <MessageCircle
                      size={28}
                      className="text-zinc-600"
                    />
                  </div>

                  <p className="mt-4 text-sm font-black text-zinc-300">
                    No conversations
                  </p>

                  <p className="mt-1 max-w-xs text-xs leading-5 text-zinc-600">
                    Your newest conversations will appear
                    here instantly.
                  </p>
                </div>
              ) : (
                <div className="space-y-1 p-2">
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

                      const avatarLetter =
                        displayName
                          .charAt(0)
                          .toUpperCase()

                      const unread =
                        (thread.unread_count || 0) >
                        0

                      return (
                        <button
                          key={thread.id}
                          type="button"
                          onClick={() =>
                            openThread(thread.id)
                          }
                          className={`group relative flex w-full items-center gap-3 overflow-hidden rounded-2xl p-3 text-left transition duration-200 active:scale-[0.985] ${
                            index === 0
                              ? 'bg-gradient-to-r from-[#00BFFF]/[0.08] via-[#BF00FF]/[0.06] to-transparent'
                              : 'hover:bg-white/[0.025]'
                          }`}
                        >
                          {/* Active/new glow */}
                          {index === 0 && (
                            <div className="absolute inset-y-3 left-0 w-[2px] rounded-full bg-gradient-to-b from-[#00BFFF] to-[#BF00FF] shadow-[0_0_12px_rgba(0,191,255,0.8)]" />
                          )}

                          {/* Avatar */}
                          <div className="relative shrink-0">
                            <div className="absolute -inset-0.5 rounded-full bg-gradient-to-br from-[#00BFFF] to-[#BF00FF] opacity-60 blur-[2px]" />

                            <div className="relative flex h-12 w-12 items-center justify-center rounded-full border-2 border-[#090611] bg-gradient-to-br from-[#00BFFF] to-[#BF00FF] text-sm font-black text-white">
                              {avatarLetter}
                            </div>

                            {unread && (
                              <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-[#07050F] bg-[#BF00FF] shadow-[0_0_10px_rgba(191,0,255,0.8)]" />
                            )}
                          </div>

                           {/* Thread info */}
                           <div className="min-w-0 flex-1">
                             <div className="flex items-center justify-between gap-2">
                               <div className="flex items-center gap-1.5">
                                 <p
                                   className={`truncate text-sm ${
                                     unread
                                       ? 'font-black text-white'
                                       : 'font-bold text-zinc-300'
                                   }`}
                                 >
                                   {displayName}
                                 </p>
                                 {thread.other_is_jailed && (
                                   <Lock className="h-3.5 w-3.5 text-red-400" title="In custody" />
                                 )}
                               </div>

                               {lastMessage && (
                                 <span
                                   className={`shrink-0 text-[9px] ${
                                     unread
                                       ? 'font-black text-[#00BFFF]'
                                       : 'text-zinc-600'
                                   }`}
                                 >
                                   {formatTime(
                                     lastMessage.sent_at ||
                                       lastMessage.created_at,
                                   )}
                                 </span>
                               )}
                             </div>

                            <div className="mt-1 flex items-center gap-2">
                              <p
                                className={`min-w-0 flex-1 truncate text-xs ${
                                  unread
                                    ? 'font-semibold text-zinc-200'
                                    : 'text-zinc-600'
                                }`}
                              >
                                {lastMessage
                                  ? lastMessage.body
                                  : 'No messages'}
                              </p>

                              {unread && (
                                <span className="grid min-w-5 place-items-center rounded-full bg-gradient-to-r from-[#00BFFF] to-[#BF00FF] px-1.5 py-0.5 text-[9px] font-black text-white shadow-[0_0_12px_rgba(191,0,255,0.35)]">
                                  {thread.unread_count}
                                </span>
                              )}
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
          /* ====================================================
             CHAT
             ==================================================== */
          <div className="flex h-full flex-col">
            {/* Conversation identity */}
            <div className="relative flex items-center gap-3 overflow-hidden border-b border-white/[0.07] bg-[#07050F]/90 px-4 py-3 backdrop-blur-2xl">
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#00BFFF]/[0.04] via-transparent to-[#BF00FF]/[0.05]" />

              <div className="relative">
                <div className="absolute -inset-1 rounded-full bg-gradient-to-br from-[#00BFFF] to-[#BF00FF] opacity-50 blur-[3px]" />

                <div className="relative flex h-11 w-11 items-center justify-center rounded-full border-2 border-[#090611] bg-gradient-to-br from-[#00BFFF] to-[#BF00FF] text-sm font-black">
                  {(
                    activeOther?.display_name ||
                    activeOther?.username ||
                    '?'
                  )
                    .charAt(0)
                    .toUpperCase()}
                </div>

                <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-[#07050F] bg-[#38FCA3] shadow-[0_0_8px_rgba(56,252,163,0.8)]" />
              </div>

              <div className="relative min-w-0 flex-1">
                <p className="truncate text-sm font-black text-white">
                  {activeOther?.display_name ||
                    activeOther?.username ||
                    'Unknown'}
                </p>

                <p className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.18em] text-[#38FCA3]">
                  Active conversation
                </p>
              </div>
            </div>

            {/* Messages */}
            <div className="relative flex-1 overflow-y-auto">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(0,191,255,0.06),transparent_28%),radial-gradient(circle_at_90%_20%,rgba(191,0,255,0.07),transparent_30%)]" />

              <div className="relative min-h-full p-4">
                {msgLoading ? (
                  <div className="flex items-center justify-center py-20">
                    <Loader2 className="h-6 w-6 animate-spin text-[#00BFFF]" />
                  </div>
                ) : (
                  <div className="space-y-2">
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
                                ? 'mt-3'
                                : ''
                            }`}
                          >
                            <div
                              className={`relative max-w-[82%] ${
                                isOwn
                                  ? 'items-end'
                                  : 'items-start'
                              }`}
                            >
                              {/* Sending glow */}
                              {isOwn &&
                                msg.local_status ===
                                  'sending' && (
                                  <div className="absolute -inset-1 rounded-3xl bg-[#00BFFF]/20 blur-lg" />
                                )}

                              <div
                                className={`relative rounded-3xl px-4 py-3 ${
                                  isOwn
                                    ? 'rounded-br-md bg-gradient-to-br from-[#00BFFF] to-[#BF00FF] text-white shadow-[0_8px_30px_rgba(0,191,255,0.15)]'
                                    : 'rounded-bl-md border border-white/[0.09] bg-white/[0.045] text-zinc-100 backdrop-blur-xl'
                                }`}
                              >
                                <p className="whitespace-pre-wrap break-words text-sm leading-6">
                                  {msg.body}
                                </p>

                                <div
                                  className={`mt-1.5 flex items-center justify-end gap-1.5 text-[9px] ${
                                    isOwn
                                      ? 'text-white/65'
                                      : 'text-zinc-600'
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
            <div className="relative border-t border-white/[0.08] bg-[#07050F]/95 p-3 pb-[calc(12px+env(safe-area-inset-bottom,0px))] backdrop-blur-2xl">
              <div
                className={`relative flex items-end gap-2 rounded-2xl border bg-white/[0.035] px-3 py-2 transition-all duration-200 ${
                  replyText.trim()
                    ? 'border-[#00BFFF]/30 shadow-[0_0_25px_rgba(0,191,255,0.07)]'
                    : 'border-white/10'
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
                  className="max-h-28 min-h-[38px] flex-1 resize-none bg-transparent px-1 py-2 text-sm leading-5 text-white outline-none placeholder:text-zinc-600"
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
                  className="relative grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-xl bg-gradient-to-br from-[#00BFFF] to-[#BF00FF] text-white shadow-[0_0_20px_rgba(0,191,255,0.25)] transition active:scale-90 disabled:opacity-30"
                >
                  <span className="absolute inset-0 bg-white/10 opacity-0 transition group-hover:opacity-100" />

                  {sending ? (
                    <Loader2
                      size={17}
                      className="animate-spin"
                    />
                  ) : (
                    <Send size={17} />
                  )}
                </button>
              </div>

              <p className="mt-1.5 text-center text-[8px] font-bold uppercase tracking-[0.18em] text-zinc-700">
                Enter to send · Shift + Enter for new line
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}