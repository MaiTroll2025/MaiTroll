import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/lib/store'
import { toast } from 'sonner'

export interface IncomingMessage {
  id: string
  conversation_id: string
  sender_id: string
  body: string
  created_at: string
  sender?: {
    id: string
    username: string
    avatar_url: string | null
  }
}

export interface IncomingMessagePopupState {
  visible: boolean
  message: IncomingMessage | null
}

export function useIncomingMessagePopup() {
  const { user, profile } = useAuthStore()
  const [state, setState] = useState<IncomingMessagePopupState>({
    visible: false,
    message: null,
  })
  const channelRef = useRef<any>(null)
  const popupTimerRef = useRef<number | null>(null)
  const dismissedRef = useRef<Set<string>>(new Set())

  const clearTimers = useCallback(() => {
    if (popupTimerRef.current) {
      window.clearTimeout(popupTimerRef.current)
      popupTimerRef.current = null
    }
  }, [])

  const showPopup = useCallback((message: IncomingMessage) => {
    if (!profile?.incoming_message_popups_enabled && profile?.incoming_message_popups_enabled !== undefined) {
      return
    }
    if (dismissedRef.current.has(message.id)) return
    clearTimers()
    setState({ visible: true, message })
    popupTimerRef.current = window.setTimeout(() => {
      setState((prev) => ({ ...prev, visible: false }))
    }, 8000)
  }, [profile?.incoming_message_popups_enabled, clearTimers])

  const dismiss = useCallback(() => {
    if (state.message) {
      dismissedRef.current.add(state.message.id)
    }
    clearTimers()
    setState({ visible: false, message: null })
  }, [state.message, clearTimers])

  const handleOpenMessage = useCallback(() => {
    clearTimers()
    setState((prev) => ({ ...prev, visible: false }))
  }, [clearTimers])

  const handleBlockUser = useCallback(async () => {
    if (!state.message?.sender_id) return
    const { blockUser } = await import('@/lib/blocking')
    const ok = await blockUser(state.message.sender_id)
    if (ok) {
      toast.success('User blocked')
    }
    dismiss()
  }, [state.message?.sender_id, dismiss])

  useEffect(() => {
    if (!user?.id) return
    const channelName = `incoming-message-popup:${user.id}`
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'conversation_messages',
          filter: `sender_id=neq.${user.id}`,
        },
        async (payload) => {
          const newMsg = payload.new as any
          if (!newMsg?.conversation_id) return
          const { data: members } = await supabase
            .from('conversation_members')
            .select('user_id')
            .eq('conversation_id', newMsg.conversation_id)
            .eq('user_id', user.id)
            .maybeSingle()
          if (!members) return
          const { data: senderProfile } = await supabase
            .from('user_profiles')
            .select('id, username, avatar_url')
            .eq('id', newMsg.sender_id)
            .maybeSingle()
          showPopup({
            id: newMsg.id,
            conversation_id: newMsg.conversation_id,
            sender_id: newMsg.sender_id,
            body: newMsg.body || '',
            created_at: newMsg.created_at,
            sender: senderProfile || undefined,
          })
        }
      )
      .subscribe()
    channelRef.current = channel
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
    }
  }, [user?.id, showPopup])

  useEffect(() => {
    return () => {
      clearTimers()
    }
  }, [clearTimers])

  return {
    ...state,
    dismiss,
    handleOpenMessage,
    handleBlockUser,
  }
}
