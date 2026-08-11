import React, { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../lib/store'
import { sendMessage } from '../../services/utromailService'
import { cn } from '../../lib/utils'
import { toast } from 'sonner'
import { X, Send, Mail, Coins, Loader2, CheckCircle, Clock } from 'lucide-react'
import { RealtimeChannel } from '@supabase/supabase-js'

interface BroadcastMessageModalProps {
  isOpen: boolean
  onClose: () => void
  broadcasterId: string
  broadcasterProfile: any
  streamId: string
}

interface FollowerUser {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  utromail_address: string | null
  is_following: boolean
  follower_count: number
}

interface MessageThread {
  id: string
  otherUserId: string
  otherUsername: string
  otherAvatarUrl: string | null
  otherUtromailAddress: string | null
  lastMessage: string | null
  lastMessageAt: string | null
  unreadCount: number
  isPaid: boolean
  wiredAmount: number | null
}

interface ChatMessage {
  id: string
  thread_id: string
  sender_id: string
  recipient_id?: string | null
  body: string
  sent_at: string
  is_paid: boolean
  wired_amount: number | null
  sender_name?: string
  sender_username?: string
}

export default function BroadcastMessageModal({
  isOpen,
  onClose,
  broadcasterId,
  broadcasterProfile,
  streamId,
}: BroadcastMessageModalProps) {
  const { user } = useAuthStore()
  const [activeTab, setActiveTab] = useState<'followers' | 'following' | 'chats'>('followers')
  const [users, setUsers] = useState<FollowerUser[]>([])
  const [selectedUser, setSelectedUser] = useState<FollowerUser | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputMessage, setInputMessage] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [isPaidMessage, setIsPaidMessage] = useState(false)
  const [wiredAmount, setWiredAmount] = useState(50)
  const [chats, setChats] = useState<MessageThread[]>([])
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const channelRef = useRef<RealtimeChannel | null>(null)

  const isHost = user?.id === broadcasterId

  useEffect(() => {
    if (!isOpen) return
    if (!isHost) return
    fetchFollowers()
    fetchFollowing()
    fetchChatThreads()
  }, [isOpen, isHost, broadcasterId])

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

  useEffect(() => {
    if (!isOpen || !selectedUser) return
    fetchMessages(selectedUser.id)
    setupRealtimeChannel(selectedUser.id)
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
    }
  }, [selectedUser, isOpen])

  const fetchFollowers = async () => {
    try {
      const { data, error } = await supabase
        .from('user_follows')
        .select(`
          follower_id,
          user_profiles!user_follows_follower_id_fkey(
            id,
            username,
            display_name,
            avatar_url,
            utromail_address
          )
        `)
        .eq('followed_id', broadcasterId)
        .eq('status', 'accepted')
      if (error) throw error
      const followers = (data || []).map((row: any) => ({
        id: row.user_profiles?.id || '',
        username: row.user_profiles?.username || 'Unknown',
        display_name: row.user_profiles?.display_name || null,
        avatar_url: row.user_profiles?.avatar_url || null,
        utromail_address: row.user_profiles?.utromail_address || null,
        is_following: true,
        follower_count: 0,
      }))
      setUsers(followers)
    } catch (err) {
      console.warn('[BroadcastMessageModal] Failed to fetch followers:', err)
    }
  }

  const fetchFollowing = async () => {
    try {
      const { data, error } = await supabase
        .from('user_follows')
        .select(`
          followed_id,
          user_profiles!user_follows_followed_id_fkey(
            id,
            username,
            display_name,
            avatar_url,
            utromail_address
          )
        `)
        .eq('follower_id', broadcasterId)
        .eq('status', 'accepted')
      if (error) throw error
      const following = (data || []).map((row: any) => ({
        id: row.user_profiles?.id || '',
        username: row.user_profiles?.username || 'Unknown',
        display_name: row.user_profiles?.display_name || null,
        avatar_url: row.user_profiles?.avatar_url || null,
        utromail_address: row.user_profiles?.utromail_address || null,
        is_following: true,
        follower_count: 0,
      }))
      setUsers(following)
    } catch (err) {
      console.warn('[BroadcastMessageModal] Failed to fetch following:', err)
    }
  }

  const fetchChatThreads = async () => {
    try {
      const { data, error } = await supabase
        .from('utromail_threads')
        .select(`
          id,
          last_message_at,
          utromail_messages(id, body, sender_id, sent_at, is_paid, wired_amount),
          utromail_thread_members(user_id, folder)
        `)
        .or(`created_by.eq.${broadcasterId}`)
        .order('last_message_at', { ascending: false })
        .limit(30)
      if (error) throw error

      const threads: MessageThread[] = (data || []).map((t: any) => {
        const msgs = t.utromail_messages || []
        const members = t.utromail_thread_members || []
        const otherMember = members.find((m: any) => m.user_id !== broadcasterId)
        const lastMsg = msgs.length > 0 ? msgs[msgs.length - 1] : null
        const paidMsg = msgs.find((m: any) => m.is_paid)
        return {
          id: t.id,
          otherUserId: otherMember?.user_id || '',
          otherUsername: otherMember?.user_profiles?.username || 'Unknown',
          otherAvatarUrl: otherMember?.user_profiles?.avatar_url || null,
          otherUtromailAddress: otherMember?.user_profiles?.utromail_address || null,
          lastMessage: lastMsg?.body || null,
          lastMessageAt: t.last_message_at,
          unreadCount: 0,
          isPaid: !!paidMsg,
          wiredAmount: paidMsg?.wired_amount || null,
        }
      })
      setChats(threads)
    } catch (err) {
      console.warn('[BroadcastMessageModal] Failed to fetch chat threads:', err)
    }
  }

  const fetchMessages = async (otherUserId: string) => {
    try {
      const { data, error } = await supabase
        .from('utromail_threads')
        .select(`
          id,
          utromail_messages(id, body, sender_id, sent_at, is_paid, wired_amount)
        `)
        .or(`created_by.eq.${broadcasterId}`)
        .maybeSingle()
      if (error) throw error

      const thread = data
      if (!thread) {
        setMessages([])
        return
      }

      const threadMessages = (thread.utromail_messages || [])
        .filter((m: any) => {
          const senderId = m.sender_id
          const recipientId = m.recipient_id
          return (
            (senderId === broadcasterId && recipientId === otherUserId) ||
            (senderId === otherUserId && recipientId === broadcasterId)
          )
        })
        .sort((a: any, b: any) => new Date(a.sent_at).getTime() - new Date(b.sent_at).getTime())

      setMessages(threadMessages as ChatMessage[])
    } catch (err) {
      console.warn('[BroadcastMessageModal] Failed to fetch messages:', err)
    }
  }

  const setupRealtimeChannel = (otherUserId: string) => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current)
    }

    const channel = supabase
      .channel(`utromail:${broadcasterId}:${otherUserId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'utromail_messages',
          filter: `thread_id=in.(${chats.map((c) => c.id).join(',') || 'none'})`,
        },
        (payload) => {
          const newMsg = payload.new as ChatMessage
          if (
            (newMsg.sender_id === broadcasterId && newMsg.recipient_id === otherUserId) ||
            (newMsg.sender_id === otherUserId && newMsg.recipient_id === broadcasterId)
          ) {
            setMessages((prev) => [...prev, newMsg])
          }
        }
      )
      .subscribe()

    channelRef.current = channel
  }

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || !selectedUser || !user) return
    setIsSending(true)
    try {
      await sendMessage({
        senderId: user.id,
        senderMail: `${user.id}@tromail`,
        recipientId: selectedUser.id,
        body: inputMessage.trim(),
        messageType: isPaidMessage ? 'normal' : 'normal',
      })
      setInputMessage('')
      setIsPaidMessage(false)
      setWiredAmount(50)
      toast.success('Message sent')
      fetchMessages(selectedUser.id)
      fetchChatThreads()
    } catch (err: any) {
      toast.error(err.message || 'Failed to send message')
    } finally {
      setIsSending(false)
    }
  }

  const handleSendPaidMessage = async () => {
    if (!inputMessage.trim() || !selectedUser || !user) return
    if (wiredAmount <= 0) {
      toast.error('Wired amount must be greater than 0')
      return
    }
    setIsSending(true)
    try {
      await sendMessage({
        senderId: user.id,
        senderMail: `${user.id}@tromail`,
        recipientId: selectedUser.id,
        body: inputMessage.trim(),
        messageType: 'normal',
      })
      setInputMessage('')
      setIsPaidMessage(false)
      setWiredAmount(50)
      toast.success(`Paid message sent (${wiredAmount} coins wired)`)
      fetchMessages(selectedUser.id)
      fetchChatThreads()
    } catch (err: any) {
      toast.error(err.message || 'Failed to send paid message')
    } finally {
      setIsSending(false)
    }
  }

  const handleSelectUser = (user: FollowerUser) => {
    setSelectedUser(user)
    setActiveTab('chats')
  }

  const handleBackToUsers = () => {
    setSelectedUser(null)
    setMessages([])
    setActiveTab('followers')
  }

  if (!isOpen) return null

  return (
    <div className="pointer-events-auto fixed inset-0 z-[90] flex items-center justify-center bg-black/70 px-4 py-4 backdrop-blur-xl">
      <div className="relative w-full max-w-2xl max-h-[calc(100dvh-2rem)] overflow-hidden rounded-[32px] border border-cyan-300/25 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.18),transparent_36%),radial-gradient(circle_at_bottom_right,rgba(168,85,247,0.18),transparent_42%),rgba(2,6,23,0.96)] text-white shadow-[0_0_55px_rgba(34,211,238,0.22)]">
        <div className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-2xl border border-white/10 bg-white/5 text-white/70 transition hover:border-rose-300/35 hover:bg-rose-500/15 hover:text-white z-10"
            aria-label="Close messages"
          >
            <X className="h-5 w-5" />
          </button>

          <div className="pr-12">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/25 bg-cyan-500/10 px-3 py-1 text-xs font-black uppercase tracking-[0.22em] text-cyan-200">
              <Mail className="h-4 w-4" />
              Messages
            </div>
            <h2 className="mt-4 text-2xl font-black tracking-tight">Broadcast Messages</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-300">
              Send messages to users who follow you or whom you follow. Enable wired messages to send paid messages.
            </p>
          </div>

          {/* Tab navigation */}
          <div className="mt-5 flex gap-2">
            <button
              type="button"
              onClick={() => { setActiveTab('followers'); setSelectedUser(null); setMessages([]) }}
              className={cn(
                'rounded-xl px-4 py-2 text-sm font-bold transition',
                activeTab === 'followers'
                  ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-300/30'
                  : 'bg-white/5 text-white/60 border border-white/10 hover:bg-white/10'
              )}
            >
              Followers
            </button>
            <button
              type="button"
              onClick={() => { setActiveTab('following'); setSelectedUser(null); setMessages([]) }}
              className={cn(
                'rounded-xl px-4 py-2 text-sm font-bold transition',
                activeTab === 'following'
                  ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-300/30'
                  : 'bg-white/5 text-white/60 border border-white/10 hover:bg-white/10'
              )}
            >
              Following
            </button>
            <button
              type="button"
              onClick={() => { setActiveTab('chats'); setSelectedUser(null); setMessages([]) }}
              className={cn(
                'rounded-xl px-4 py-2 text-sm font-bold transition',
                activeTab === 'chats'
                  ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-300/30'
                  : 'bg-white/5 text-white/60 border border-white/10 hover:bg-white/10'
              )}
            >
              Chats
            </button>
          </div>

          {/* Content area */}
          <div className="mt-4">
            {selectedUser ? (
              <div className="grid gap-4 lg:grid-cols-[1fr_2fr]">
                {/* User list sidebar */}
                <div className="rounded-3xl border border-white/10 bg-black/25 p-4 max-h-[400px] overflow-y-auto">
                  <button
                    type="button"
                    onClick={handleBackToUsers}
                    className="mb-3 flex items-center gap-2 text-sm font-bold text-cyan-300 hover:text-cyan-200"
                  >
                    <X className="h-4 w-4" />
                    Back
                  </button>
                  <p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-200/75 mb-3">
                    {selectedUser.username}
                  </p>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="h-10 w-10 rounded-full bg-cyan-500/20 flex items-center justify-center text-cyan-300 text-sm font-bold">
                      {selectedUser.username.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white">{selectedUser.display_name || selectedUser.username}</p>
                      <p className="text-xs text-slate-400">@{selectedUser.username}</p>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                    <p className="text-xs font-bold text-white/60">Messages</p>
                    <p className="mt-1 text-sm text-white">{messages.length} messages</p>
                  </div>
                </div>

                {/* Chat area */}
                <div className="rounded-3xl border border-white/10 bg-black/25 p-4 flex flex-col" style={{ minHeight: '400px' }}>
                  <div className="flex-1 overflow-y-auto space-y-3 mb-4">
                    {messages.length === 0 ? (
                      <div className="flex items-center justify-center h-full text-slate-400 text-sm">
                        No messages yet. Start a conversation!
                      </div>
                    ) : (
                      messages.map((msg) => (
                        <div
                          key={msg.id}
                          className={cn(
                            'rounded-2xl p-3 max-w-[80%]',
                            msg.sender_id === broadcasterId
                              ? 'bg-cyan-500/15 border border-cyan-300/20 ml-auto'
                              : 'bg-white/5 border border-white/10'
                          )}
                        >
                          <p className="text-sm text-white">{msg.body}</p>
                          {msg.is_paid && (
                            <div className="mt-1 flex items-center gap-1 text-xs text-amber-400">
                              <Coins className="h-3 w-3" />
                              {msg.wired_amount} coins wired
                            </div>
                          )}
                          <p className="mt-1 text-[10px] text-white/40">
                            {new Date(msg.sent_at).toLocaleTimeString()}
                          </p>
                        </div>
                      ))
                    )}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* Paid message toggle */}
                  <div className="flex items-center gap-3 mb-3">
                    <label className="flex items-center gap-2 text-sm font-bold text-white/80 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isPaidMessage}
                        onChange={(e) => setIsPaidMessage(e.target.checked)}
                        className="rounded border-white/20 bg-black/30 text-cyan-500 focus:ring-cyan-500/50"
                      />
                      <Coins className="h-4 w-4 text-amber-400" />
                      Wired Message
                    </label>
                    {isPaidMessage && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-white/50">Amount:</span>
                        <input
                          type="number"
                          min={1}
                          max={10000}
                          value={wiredAmount}
                          onChange={(e) => setWiredAmount(Math.max(0, Number(e.target.value)))}
                          className="w-20 rounded-lg border border-white/10 bg-black/30 px-2 py-1 text-sm font-bold text-white outline-none focus:border-cyan-300/50"
                        />
                        <span className="text-xs text-white/50">coins</span>
                      </div>
                    )}
                  </div>

                  {/* Message input */}
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={inputMessage}
                      onChange={(e) => setInputMessage(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault()
                          if (isPaidMessage) {
                            handleSendPaidMessage()
                          } else {
                            handleSendMessage()
                          }
                        }
                      }}
                      placeholder="Type a message..."
                      className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white outline-none placeholder:text-white/30 focus:border-cyan-300/50"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (isPaidMessage) {
                          handleSendPaidMessage()
                        } else {
                          handleSendMessage()
                        }
                      }}
                      disabled={isSending || !inputMessage.trim()}
                      className="grid h-10 w-10 place-items-center rounded-xl bg-cyan-500/20 text-cyan-300 transition hover:bg-cyan-500/30 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {isSending ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <Send className="h-5 w-5" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-3xl border border-white/10 bg-black/25 p-4">
                <p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-200/75 mb-3">
                  {activeTab === 'followers' ? 'Your Followers' : activeTab === 'following' ? 'You Follow' : 'Recent Chats'}
                </p>
                {users.length === 0 && chats.length === 0 ? (
                  <div className="py-8 text-center text-slate-400 text-sm">
                    No users found
                  </div>
                ) : (
                  <div className="space-y-2">
                    {activeTab === 'chats' ? (
                      chats.map((chat) => (
                        <button
                          key={chat.id}
                          type="button"
                          onClick={() => {
                            const user = users.find((u) => u.id === chat.otherUserId)
                            if (user) {
                              setSelectedUser(user)
                            } else {
                              setSelectedUser({
                                id: chat.otherUserId,
                                username: chat.otherUsername,
                                display_name: null,
                                avatar_url: chat.otherAvatarUrl,
                                utromail_address: chat.otherUtromailAddress,
                                is_following: false,
                                follower_count: 0,
                              })
                            }
                          }}
                          className="w-full flex items-center gap-3 p-3 rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/10 transition text-left"
                        >
                          <div className="h-10 w-10 rounded-full bg-cyan-500/20 flex items-center justify-center text-cyan-300 text-sm font-bold">
                            {chat.otherUsername.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-white truncate">{chat.otherUsername}</p>
                            <p className="text-xs text-slate-400 truncate">{chat.lastMessage || 'No messages yet'}</p>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            {chat.isPaid && (
                              <span className="flex items-center gap-1 text-[10px] text-amber-400">
                                <Coins className="h-3 w-3" />
                                Wired
                              </span>
                            )}
                            {chat.lastMessageAt && (
                              <span className="text-[10px] text-white/30">
                                {new Date(chat.lastMessageAt).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        </button>
                      ))
                    ) : (
                      users.map((u) => (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => handleSelectUser(u)}
                          className="w-full flex items-center gap-3 p-3 rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/10 transition text-left"
                        >
                          <div className="h-10 w-10 rounded-full bg-cyan-500/20 flex items-center justify-center text-cyan-300 text-sm font-bold">
                            {u.username.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-white truncate">{u.display_name || u.username}</p>
                            <p className="text-xs text-slate-400">@{u.username}</p>
                          </div>
                          {u.is_following && (
                            <CheckCircle className="h-5 w-5 text-emerald-400" />
                          )}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}