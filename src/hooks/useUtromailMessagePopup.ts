import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/lib/store'
import { toast } from 'sonner'

export interface UtromailIncomingMessage {
  id: string
  thread_id: string
  sender_id: string
  sender_mail_address: string
  body: string
  sent_at: string
  sender?: {
    id: string
    username: string
    avatar_url: string | null
  }
}

export interface UtromailMessagePopupState {
  visible: boolean
  message: UtromailIncomingMessage | null
}

export function useUtromailMessagePopup() {
  const navigate = useNavigate()
  const { user, profile } = useAuthStore()
  const [state, setState] = useState<UtromailMessagePopupState>({
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

  const showPopup = useCallback((message: UtromailIncomingMessage) => {
    console.log('[UtromailPopup] showPopup called:', message)
    if (message.sender_id === user?.id) return
    if (dismissedRef.current.has(message.id)) return
    clearTimers()
    setState({ visible: true, message })
    popupTimerRef.current = window.setTimeout(() => {
      setState((prev) => {
        console.log('[UtromailPopup] auto-dismissing after 8s')
        return { ...prev, visible: false }
      })
    }, 8000)
  }, [user?.id, clearTimers])

  const dismiss = useCallback(() => {
    if (state.message) {
      dismissedRef.current.add(state.message.id)
    }
    clearTimers()
    setState({ visible: false, message: null })
  }, [state.message, clearTimers])

  const handleOpenThread = useCallback((threadId: string) => {
    clearTimers()
    setState((prev) => ({ ...prev, visible: false }))
    navigate(`/utromail/${threadId}`)
  }, [clearTimers, navigate])

  const handleViewProfile = useCallback((userId: string) => {
    clearTimers()
    setState((prev) => ({ ...prev, visible: false }))
    navigate(`/profile/${userId}`)
  }, [clearTimers, navigate])

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
    const channelName = `utromail-message-popup:${user.id}`
    console.log('[UtromailPopup] subscribing to channel:', channelName)

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'utromail_messages',
          filter: `recipient_id=eq.${user.id}`,
        },
        async (payload) => {
          console.log('[UtromailPopup] received INSERT payload:', payload)
          const newMsg = payload.new as any
          if (!newMsg?.id) return
          if (newMsg.sender_id === user.id) {
            console.log('[UtromailPopup] ignoring own message')
            return
          }
          const { data: senderProfile } = await supabase
            .from('user_profiles')
            .select('id, username, avatar_url')
            .eq('id', newMsg.sender_id)
            .maybeSingle()
          console.log('[UtromailPopup] sender profile:', senderProfile)
          showPopup({
            id: newMsg.id,
            thread_id: newMsg.thread_id,
            sender_id: newMsg.sender_id,
            sender_mail_address: newMsg.sender_mail_address || '',
            body: newMsg.body || '',
            sent_at: newMsg.sent_at || newMsg.created_at || new Date().toISOString(),
            sender: senderProfile || undefined,
          })
        }
      )
      .subscribe((status, err) => {
        console.log('[UtromailPopup] channel status:', status, err)
      })
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
    handleOpenThread,
    handleViewProfile,
    handleBlockUser,
  }
}
