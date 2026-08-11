import React, { useState, useCallback, useEffect, useRef } from 'react'
import { Send, Smile, User } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/lib/store'
import { useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import ProfileFrame from '@/components/profile/ProfileFrame'
import { useUserFrame } from '@/hooks/useUserFrame'
import { getAnonymousDisplayName } from '@/lib/anonymousIdentity'

/** Small avatar for chat messages — extracts useUserFrame out of .map() */
function ChatAvatar({ userId, avatarUrl, username }: { userId?: string; avatarUrl: string; username: string }) {
  const frame = useUserFrame(userId)
  return (
    <ProfileFrame frame={frame} avatarUrl={avatarUrl} username={username} size="xs" />
  )
}

interface ChatMessage {
  id: string
  user_id?: string
  username: string
  content: string
  createdAt: number
  avatarUrl?: string | null
}

interface GamingChatProps {
  streamId: string
  className?: string
  guestChatLimit?: number
  canPinMessages?: boolean
  hostId?: string
}

const MAX_MESSAGES = 100

export function GamingChat({ streamId, className }: GamingChatProps) {
  const { user, profile } = useAuthStore()
  const navigate = useNavigate()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isVisible, setIsVisible] = useState(true)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const channel = supabase.channel(`floating-chat:${streamId}`)
    channelRef.current = channel

    channel
      .on('broadcast', { event: 'floating_chat' }, (payload: any) => {
        const msg = payload.payload
        if (!msg) return

        const chatMsg: ChatMessage = {
          id: msg.id || `${Date.now()}-${Math.random()}`,
          username: msg.username || 'Anonymous',
          content: msg.content || msg.message || '',
          createdAt: msg.createdAt || Date.now(),
          avatarUrl: msg.avatarUrl || msg.avatar_url || null,
        }

        setMessages((prev) => {
          const next = [...prev, chatMsg]
          return next.length > MAX_MESSAGES ? next.slice(-MAX_MESSAGES) : next
        })
      })
      .subscribe()

    return () => {
      if (channel) {
        supabase.removeChannel(channel)
      }
      channelRef.current = null
    }
  }, [streamId])

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    }
  }, [messages])

  const sendMessage = useCallback(async () => {
    const text = input.trim()
    if (!text) return

    if (!user) {
      navigate('/auth?mode=login')
      return
    }

    setInput('')

    const displayName = user
      ? (profile?.username || 'You')
      : getAnonymousDisplayName()

    const avatar = user ? (profile?.avatar_url || null) : null

    const optimisticMsg: ChatMessage = {
      id: `local-${Date.now()}`,
      username: displayName,
      content: text,
      createdAt: Date.now(),
      avatarUrl: avatar,
    }

    setMessages((prev) => [...prev, optimisticMsg])

    try {
      const edgeUrl = import.meta.env.VITE_EDGE_FUNCTIONS_URL
      if (edgeUrl) {
        await fetch(`${edgeUrl}/send-message`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            streamId,
            userId: user?.id || null,
            username: displayName,
            content: text,
            type: 'chat',
            isGuest: !user,
          }),
        })
      }

      const chatChannel = channelRef.current
      if (chatChannel) {
        chatChannel.send({
          type: 'broadcast',
          event: 'floating_chat',
          payload: {
            id: optimisticMsg.id,
            username: displayName,
            content: text,
            createdAt: Date.now(),
            avatarUrl: avatar,
          },
        })
      }
    } catch (err: any) {
      console.error('[GamingChat] Send failed:', err)
      toast.error('Failed to send message')
    }
  }, [input, user, profile, streamId, navigate])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        sendMessage()
      }
    },
    [sendMessage],
  )

  const formatTime = (ts: number) => {
    const d = new Date(ts)
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className={cn('flex h-full flex-col overflow-hidden', className)} style={{ minHeight: 200 }}>
      <div
        ref={containerRef}
        className="flex-1 space-y-1.5 overflow-y-auto p-2"
      >
        {messages.length === 0 ? (
          <p className="py-4 text-center text-xs text-slate-500">No messages yet</p>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className="group flex items-start gap-2 rounded-lg px-1.5 py-1 hover:bg-white/5">
              {msg.avatarUrl ? (
                <ChatAvatar userId={msg.user_id} avatarUrl={msg.avatarUrl} username={msg.username || 'User'} />
              ) : (
                <div className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-purple-500/20 text-[8px] font-black text-purple-300">
                  {msg.username.slice(0, 1).toUpperCase()}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-[10px] font-black text-purple-300">{msg.username}</span>
                  <span className="text-[8px] text-slate-600">{formatTime(msg.createdAt)}</span>
                </div>
                <p className="text-[11px] leading-4 text-slate-200">{msg.content}</p>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="shrink-0 flex items-center gap-2 border-t border-white/10 p-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Send a message..."
          className="min-w-0 flex-1 rounded-lg border border-white/10 bg-black/30 px-3 py-1.5 text-xs text-white placeholder:text-slate-500 focus:border-cyan-400/30 focus:outline-none"
        />
        <button
          onClick={sendMessage}
          disabled={!input.trim()}
          className="rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-black text-white transition hover:bg-purple-500 disabled:opacity-40"
        >
          <Send className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}

export default GamingChat
