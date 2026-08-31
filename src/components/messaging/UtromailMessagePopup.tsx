import React, { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { X, MessageSquare, User, Shield } from 'lucide-react'
import { useAuthStore } from '@/lib/store'
import { blockUser } from '@/lib/blocking'
import { cn } from '@/lib/utils'

interface UtromailMessagePopupProps {
  message: {
    id: string
    threadId: string
    senderId: string
    senderUsername: string
    senderAvatarUrl: string | null
    content: string
    createdAt: string
  }
  onClose: () => void
  onOpenThread: (threadId: string) => void
  onViewProfile: (userId: string) => void
}

export default function UtromailMessagePopup({
  message,
  onClose,
  onOpenThread,
  onViewProfile,
}: UtromailMessagePopupProps) {
  const { user } = useAuthStore()
  const [isBlocking, setIsBlocking] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const popupRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [onClose])

  const handleBlock = async () => {
    if (!user?.id || !message.senderId) return
    setIsBlocking(true)
    try {
      const result = await blockUser(user.id, message.senderId)
      if (result.success) {
        toast.success('User blocked')
        onClose()
      } else {
        toast.error(result.error || 'Failed to block user')
      }
    } finally {
      setIsBlocking(false)
      setShowConfirm(false)
    }
  }

  return (
    <div className="fixed inset-x-0 bottom-4 z-[100] flex justify-center px-4 pointer-events-none">
      <div
        ref={popupRef}
        className={cn(
          'pointer-events-auto w-full max-w-sm rounded-2xl border border-white/10 bg-slate-950/95 shadow-2xl backdrop-blur-xl',
          'animate-in slide-in-from-bottom-4 duration-300',
        )}
      >
        <div className="flex items-start gap-3 p-4">
          <div className="shrink-0">
            {message.senderAvatarUrl ? (
              <img
                src={message.senderAvatarUrl}
                alt={message.senderUsername}
                className="h-10 w-10 rounded-full object-cover border border-white/10"
              />
            ) : (
              <div className="h-10 w-10 rounded-full bg-white/10 flex items-center justify-center">
                <User className="h-5 w-5 text-white/50" />
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-black text-white truncate">{message.senderUsername}</p>
            <p className="mt-1 text-xs text-slate-300 line-clamp-2">{message.content}</p>
            <p className="mt-1 text-[10px] text-slate-500">
              {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 rounded-lg p-1 text-zinc-400 hover:bg-white/10 hover:text-white transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex items-center gap-2 border-t border-white/10 p-3">
          <button
            onClick={() => onOpenThread(message.threadId)}
            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border border-cyan-400/30 bg-cyan-500/15 px-3 py-2 text-xs font-black text-cyan-300 hover:bg-cyan-500/25 transition-colors"
          >
            <MessageSquare className="h-3.5 w-3.5" />
            Open Message
          </button>
          <button
            onClick={() => onViewProfile(message.senderId)}
            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-black text-slate-300 hover:bg-white/10 transition-colors"
          >
            <User className="h-3.5 w-3.5" />
            View Profile
          </button>
          {!showConfirm ? (
            <button
              onClick={() => setShowConfirm(true)}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-rose-400/30 bg-rose-500/15 px-3 py-2 text-xs font-black text-rose-300 hover:bg-rose-500/25 transition-colors"
            >
              <Shield className="h-3.5 w-3.5" />
              Block
            </button>
          ) : (
            <div className="flex items-center gap-1">
              <button
                onClick={handleBlock}
                disabled={isBlocking}
                className="rounded-xl border border-rose-400/30 bg-rose-500/20 px-3 py-2 text-xs font-black text-rose-300 hover:bg-rose-500/30 disabled:opacity-50"
              >
                {isBlocking ? '...' : 'Confirm'}
              </button>
              <button
                onClick={() => setShowConfirm(false)}
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-black text-slate-400 hover:bg-white/10"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
