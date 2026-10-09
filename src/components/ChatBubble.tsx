/**
 * ChatBubble — Floating quick-chat powered by Utromail.
 *
 * Features:
 * - Inbox sidebar: shows up to 10 recent threads with unread badges
 * - Click a thread to open the chat panel
 * - Send/receive messages in real-time via Utromail tables
 * - Real-time message subscription (postgres_changes)
 * - Optimistic message insertion
 * - Virtualized message list (react-virtuoso)
 * - Online status indicators
 * - Minimize / close support
 *
 * Triggered globally via double-tap/click anywhere on any page.
 */

import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import {
  X,
  Minus,
  CheckCheck,
  Clock,
  Send,
  MessageCircle,
  ArrowLeft,
  Loader2,
  Search,
} from 'lucide-react'
import { Virtuoso } from 'react-virtuoso'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../lib/store'
import { useChatStore } from '../lib/chatStore'
import { usePresenceStore } from '../lib/presenceStore'
import {
  getThreads,
  getThreadMessages,
  sendMessage,
  markThreadAsRead,
} from '../services/utromailService'
import type { UtromailThread } from '../types/mail'
import { cn } from '../lib/utils'
import AvatarWithFrame from './profile/AvatarWithFrame'

// ─── Types ───────────────────────────────────────────────────────────────────

interface ChatBubbleMessage {
  id: string
  thread_id: string
  sender_id: string
  body: string
  sent_at: string
  read_at?: string | null
  sender_username?: string
  sender_avatar?: string | null
  sender_name?: string
  isPending?: boolean
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(dateStr: string): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  if (diff < 60000) return 'Now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m`
  if (diff < 86400000) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

function formatMessageTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function getOtherParticipant(thread: UtromailThread, userId: string) {
  if (thread.other_user_id) {
    return {
      user_id: thread.other_user_id,
      username: thread.other_username || 'Unknown',
      display_name: thread.other_display_name || thread.other_username || 'Unknown',
      avatar_url: thread.other_avatar_url || null,
    }
  }
  const members = thread.members || []
  const seen = new Set<string>()
  const unique = members.filter(m => {
    if (seen.has(m.user_id)) return false
    seen.add(m.user_id)
    return true
  })
  return unique.find(m => m.user_id !== userId) || unique[0] || null
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function ChatBubble() {
  const { user, profile } = useAuthStore()
  const { isOpen, isMinimized, activeUserId, activeUsername, activeUserAvatar: _activeUserAvatar, closeChatBubble, toggleMinimize } = useChatStore()
  const onlineUserIds = usePresenceStore(s => s.onlineUserIds)

  const [view, setView] = useState<'inbox' | 'chat'>('inbox')
  const [threads, setThreads] = useState<UtromailThread[]>([])
  const [threadsLoading, setThreadsLoading] = useState(false)
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatBubbleMessage[]>([])
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [inputText, setInputText] = useState('')
  const [sending, setSending] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  const activeIsOnline = Boolean(activeUserId && onlineUserIds.has(activeUserId))
  const activeThread = useMemo(
    () => threads.find(t => t.id === activeThreadId) || null,
    [threads, activeThreadId]
  )
  const otherParticipant = activeThread ? getOtherParticipant(activeThread, user?.id || '') : null

  const filteredThreads = useMemo(() => {
    if (!searchQuery.trim()) return threads.slice(0, 10)
    const q = searchQuery.toLowerCase()
    return threads
      .filter(t =>
        (t.other_username || '').toLowerCase().includes(q) ||
        (t.other_display_name || '').toLowerCase().includes(q) ||
        (t.last_message?.body || '').toLowerCase().includes(q)
      )
      .slice(0, 10)
  }, [threads, searchQuery])

  // ─── Load inbox threads ─────────────────────────────────────────────────────

  const loadThreads = useCallback(async () => {
    if (!user?.id) return
    setThreadsLoading(true)
    try {
      const data = await getThreads(user.id, 'inbox')
      setThreads(data.slice(0, 10))
    } catch (err) {
      console.error('[ChatBubble] loadThreads error:', err)
    } finally {
      setThreadsLoading(false)
    }
  }, [user?.id])

  // ─── Open a thread ──────────────────────────────────────────────────────────

  const openThread = useCallback(async (thread: UtromailThread) => {
    setActiveThreadId(thread.id)
    setView('chat')
    setMessagesLoading(true)

    try {
      await markThreadAsRead(thread.id, user!.id)
    } catch { /* ignore */ }

    try {
      const msgs = await getThreadMessages(thread.id)
      setMessages(msgs.map((m: any) => ({
        id: m.id,
        thread_id: m.thread_id,
        sender_id: m.sender_id,
        body: m.body,
        sent_at: m.sent_at,
        read_at: (m as any).is_read ? m.sent_at : null,
        sender_username: m.sender_username,
        sender_avatar: m.sender_avatar,
        sender_name: m.sender_name,
      })))
    } catch (err) {
      console.error('[ChatBubble] loadMessages error:', err)
    } finally {
      setMessagesLoading(false)
    }

    const other = getOtherParticipant(thread, user!.id)
    if (other) {
      useChatStore.getState().openChatBubble(other.user_id, other.display_name || other.username, other.avatar_url)
    }
  }, [user])

  const findThreadWithUser = useCallback(async (targetUserId: string) => {
    if (!user?.id) return
    try {
      const data = await getThreads(user.id, 'inbox')
      const thread = data.find(t => t.other_user_id === targetUserId)
      if (thread) {
        setThreads(prev => {
          const exists = prev.some(t => t.id === thread.id)
          return exists ? prev : [thread, ...prev].slice(0, 10)
        })
        setTimeout(() => openThread(thread), 0)
      }
    } catch { /* ignore */ }
  }, [user?.id, openThread])

  useEffect(() => {
    if (isOpen && user?.id) {
      loadThreads()
      if (activeUserId && activeUserId !== user.id) {
        findThreadWithUser(activeUserId)
      }
    }
  }, [isOpen, user?.id, loadThreads, activeUserId, findThreadWithUser])

  // ─── Real-time message subscription ─────────────────────────────────────────

  useEffect(() => {
    if (!activeThreadId) {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
      return
    }

    const channel = supabase.channel(`chatbubble:${activeThreadId}`)
    channelRef.current = channel

    channel
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'utromail_messages',
          filter: `thread_id=eq.${activeThreadId}`,
        },
        (payload) => {
          const msg = payload.new as any
          setMessages(prev => {
            if (prev.some(m => m.id === msg.id)) return prev
            return [...prev, {
              id: msg.id,
              thread_id: msg.thread_id,
              sender_id: msg.sender_id,
              body: msg.body,
              sent_at: msg.sent_at,
              read_at: (msg as any).is_read ? msg.sent_at : null,
              sender_username: msg.sender_username,
              sender_avatar: msg.sender_avatar,
              sender_name: msg.sender_name,
            }]
          })
        }
      )
      .subscribe()

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
    }
  }, [activeThreadId])

  // ─── Send message ───────────────────────────────────────────────────────────

  const handleSend = useCallback(async () => {
    const text = inputText.trim()
    if (!text || !activeThreadId || !user?.id || sending) return

    setInputText('')
    setSending(true)

    const optimisticId = `pending-${Date.now()}`
    const now = new Date().toISOString()

    setMessages(prev => [...prev, {
      id: optimisticId,
      thread_id: activeThreadId,
      sender_id: user.id,
      body: text,
      sent_at: now,
      sender_username: profile?.username,
      sender_avatar: profile?.avatar_url,
      sender_name: profile?.display_name || profile?.username,
      isPending: true,
    }])

    try {
      const recipientId = activeThread?.other_user_id || otherParticipant?.user_id
      const recipientMail = activeThread?.other_utromail_address || undefined
      const sent = await sendMessage({
        senderId: user.id,
        senderMail: `${profile?.username || 'user'}@utromail`,
        recipientId,
        recipientMail,
        body: text,
      })

      setMessages(prev =>
        prev.map(m => m.id === optimisticId ? {
          id: sent.id,
          thread_id: sent.thread_id,
          sender_id: sent.sender_id,
          body: sent.body,
          sent_at: sent.sent_at,
          read_at: (sent as any).is_read ? sent.sent_at : null,
          sender_username: profile?.username,
          sender_avatar: profile?.avatar_url,
          sender_name: profile?.display_name || profile?.username,
        } : m)
      )

      loadThreads()
    } catch (err: any) {
      console.error('[ChatBubble] send error:', err)
      setMessages(prev =>
        prev.map(m => m.id === optimisticId ? { ...m, isPending: false } : m)
      )
    } finally {
      setSending(false)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [inputText, activeThreadId, user, profile, sending, loadThreads])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  useEffect(() => {
    if (messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages.length])

  if (!isOpen) return null

  return (
    <div
      className={cn(
        'fixed bottom-4 right-4 z-[9999] flex flex-col overflow-hidden rounded-3xl border border-cyan-300/20 bg-slate-950/95 shadow-[0_0_60px_rgba(45,212,191,0.15)] backdrop-blur-2xl transition-all duration-300',
        isMinimized ? 'h-14 w-72' : 'h-[520px] w-[380px]',
      )}
    >
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-cyan-300/10 bg-slate-950/80 px-3 py-2.5">
        <div className="flex items-center gap-2">
          {view === 'chat' && (
            <button
              onClick={() => { setView('inbox'); setActiveThreadId(null); }}
              className="mr-1 rounded-lg p-1 text-zinc-400 hover:bg-white/5 hover:text-white"
            >
              <ArrowLeft size={16} />
            </button>
          )}
          <MessageCircle size={16} className="text-cyan-400" />
          <span className="text-sm font-bold text-white">
            {view === 'chat'
              ? (otherParticipant?.display_name || otherParticipant?.username || activeUsername || 'Chat')
              : 'Inbox'}
          </span>
          {view === 'chat' && activeIsOnline && (
            <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]" />
          )}
        </div>
        <div className="flex items-center gap-1">
          <button onClick={toggleMinimize} className="rounded-lg p-1.5 text-zinc-400 hover:bg-white/5 hover:text-white">
            <Minus size={14} />
          </button>
          <button onClick={closeChatBubble} className="rounded-lg p-1.5 text-zinc-400 hover:bg-white/5 hover:text-white">
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Body */}
      {isMinimized ? (
        <div className="flex flex-1 items-center justify-center">
          <span className="text-xs text-zinc-500">
            {threads.reduce((sum, t) => sum + (t.unread_count || 0), 0) > 0
              ? `${threads.reduce((sum, t) => sum + (t.unread_count || 0), 0)} new`
              : 'Tap to chat'}
          </span>
        </div>
      ) : view === 'inbox' ? (
        /* Inbox View */
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="shrink-0 border-b border-white/5 px-3 py-2">
            <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5">
              <Search size={14} className="text-zinc-500" />
              <input
                type="text"
                placeholder="Search conversations..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-transparent text-sm text-white outline-none placeholder:text-zinc-600"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {threadsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 size={20} className="animate-spin text-zinc-500" />
              </div>
            ) : filteredThreads.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <MessageCircle size={32} className="mb-2 text-zinc-700" />
                <p className="text-sm text-zinc-500">No conversations yet</p>
                <p className="mt-1 text-xs text-zinc-600">Double-tap anywhere to chat</p>
              </div>
            ) : (
              filteredThreads.map(thread => {
                const other = getOtherParticipant(thread, user?.id || '')
                const isOnline = other?.user_id ? onlineUserIds.has(other.user_id) : false
                const unread = thread.unread_count || 0
                return (
                  <button
                    key={thread.id}
                    onClick={() => openThread(thread)}
                    className="flex w-full items-center gap-3 border-b border-white/5 px-3 py-2.5 text-left transition-colors hover:bg-white/5"
                  >
                    <div className="relative shrink-0">
                      <AvatarWithFrame avatarUrl={other?.avatar_url || null} username={other?.username || 'U'} size="sm" className="h-10 w-10 rounded-xl" />
                      {isOnline && (
                        <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-slate-950 bg-emerald-400" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <span className="truncate text-sm font-bold text-white">
                          {other?.display_name || other?.username || 'Unknown'}
                        </span>
                        <span className="shrink-0 text-[10px] text-zinc-500">
                          {thread.last_message?.sent_at ? formatTime(thread.last_message.sent_at) : ''}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <p className="truncate text-xs text-zinc-400">
                          {thread.last_message?.body || 'No messages yet'}
                        </p>
                        {unread > 0 && (
                          <span className="ml-2 shrink-0 rounded-full bg-cyan-500 px-1.5 py-0.5 text-[10px] font-bold text-black">
                            {unread}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </div>
      ) : (
        /* Chat View */
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 overflow-hidden">
            {messagesLoading ? (
              <div className="flex h-full items-center justify-center">
                <Loader2 size={20} className="animate-spin text-zinc-500" />
              </div>
            ) : messages.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-zinc-500">
                No messages yet. Say hello!
              </div>
            ) : (
              <Virtuoso
                className="h-full"
                totalCount={messages.length}
                itemContent={(index) => {
                  const msg = messages[index]
                  const isMe = msg.sender_id === user?.id
                  return (
                    <div className={cn('flex gap-2 px-3 py-1.5', isMe ? 'flex-row-reverse' : 'flex-row')}>
                      {!isMe && (
                        <AvatarWithFrame avatarUrl={msg.sender_avatar || null} username={msg.sender_username || 'U'} size="xs" className="h-7 w-7 shrink-0 rounded-lg" />
                      )}
                      <div className={cn('flex max-w-[75%] flex-col', isMe ? 'items-end' : 'items-start')}>
                        <div className={cn(
                          'break-words rounded-2xl border px-3 py-2 text-sm leading-relaxed',
                          isMe ? 'rounded-tr-md border-cyan-300/20 bg-cyan-400/15 text-cyan-50' : 'rounded-tl-md border-fuchsia-300/15 bg-white/7 text-slate-200',
                          msg.isPending && 'opacity-60',
                        )}>
                          {msg.body}
                        </div>
                        <div className="mt-0.5 flex items-center gap-1 px-1">
                          <span className="text-[10px] text-zinc-600">{formatMessageTime(msg.sent_at)}</span>
                          {isMe && msg.isPending && <Clock size={10} className="animate-pulse text-zinc-500" />}
                          {isMe && !msg.isPending && msg.read_at && <CheckCheck size={10} className="text-cyan-400" />}
                        </div>
                      </div>
                    </div>
                  )
                }}
                followOutput="smooth"
              />
            )}
            <div ref={messagesEndRef} />
          </div>
          <div className="shrink-0 border-t border-cyan-300/10 bg-slate-950/80 p-2.5">
            <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-1.5">
              <input
                ref={inputRef}
                type="text"
                placeholder="Type a message..."
                value={inputText}
                onChange={e => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                className="w-full bg-transparent text-sm text-white outline-none placeholder:text-zinc-600"
              />
              <button
                onClick={handleSend}
                disabled={!inputText.trim() || sending}
                className="shrink-0 rounded-xl bg-cyan-500/20 p-1.5 text-cyan-400 transition hover:bg-cyan-500/30 disabled:opacity-30"
              >
                {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
