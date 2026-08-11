import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useSingOffStore } from '../store/useSingOffStore'
import type {
  SingOffParticipant,
  SingOffQueueEntry,
  SingOffRound,
  SingOffDecision,
  SingOffChatMessage,
} from '../types'

export function useSingOffRealtime(sessionId: string | null, userId?: string) {
  const {
    upsertParticipant,
    removeParticipant,
    upsertQueueEntry,
    setQueue,
    setRounds,
    setCurrentRound,
    upsertDecision,
    setDecisions,
    addChatMessage,
    setCountdown,
    clearCountdown,
    setActiveGift,
    setMaiWinnerEffect,
    setLiveKit,
    setMyQueueEntry,
    setSession,
  } = useSingOffStore.getState()

  // Initial load of backlog chat + queue
  useEffect(() => {
    if (!sessionId) return
    const load = async () => {
      const { data: chat, error: chatErr } = await supabase
        .from('mai_singoff_chat')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true })
        .limit(100)
      if (!chatErr && chat) {
        chat.forEach((m) => addChatMessage(m as unknown as SingOffChatMessage))
      }
      const { data: queue } = await supabase
        .from('mai_singoff_queue')
        .select('*')
        .eq('session_id', sessionId)
        .in('status', ['waiting', 'called', 'countdown', 'on_stage'])
        .order('sort_order', { ascending: true })
      if (queue) {
        const entries = queue as unknown as SingOffQueueEntry[]
        entries.forEach((e) => upsertQueueEntry(e))
        if (userId) setMyQueueEntry(entries.find((e) => e.user_id === userId) ?? null)
      }
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, userId])

  useEffect(() => {
    if (!sessionId) return

    const channels: any[] = []

    channels.push(
      supabase
        .channel(`singoff:sessions:${sessionId}`)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'mai_singoff_sessions', filter: `id=eq.${sessionId}` }, (payload) => {
          setSession((payload.new as any))
        })
        .subscribe(),
    )

    channels.push(
      supabase
        .channel(`singoff:participants:${sessionId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'mai_singoff_participants', filter: `session_id=eq.${sessionId}` }, (payload: any) => {
          const p = (payload.new ?? payload.old) as unknown as SingOffParticipant
          if (payload.eventType === 'DELETE') {
            if (p?.user_id) removeParticipant(p.user_id)
            return
          }
          if (!p) return
          upsertParticipant({
            user_id: p.user_id,
            display_name: p.display_name ?? p.user_id,
            avatar_url: p.avatar_url ?? null,
            level: p.level ?? 0,
            troll_coins: p.troll_coins ?? 0,
            role: p.role,
            position: p.position,
            can_publish: p.can_publish,
          })
        })
        .subscribe(),
    )

    channels.push(
      supabase
        .channel(`singoff:queue:${sessionId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'mai_singoff_queue', filter: `session_id=eq.${sessionId}` }, (payload: any) => {
          const q = (payload.new ?? payload.old) as unknown as SingOffQueueEntry
          if (payload.eventType === 'DELETE') return
          if (!q) return
          upsertQueueEntry(q)
          if (userId && q.user_id === userId) setMyQueueEntry(q)
        })
        .subscribe(),
    )

    channels.push(
      supabase
        .channel(`singoff:rounds:${sessionId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'mai_singoff_rounds', filter: `session_id=eq.${sessionId}` }, (payload: any) => {
          const r = (payload.new ?? payload.old) as unknown as SingOffRound
          if (payload.eventType === 'DELETE' || !r) return
          // Re-read all rounds to keep ordering simple
          supabase
            .from('mai_singoff_rounds')
            .select('*')
            .eq('session_id', sessionId)
            .order('round_number', { ascending: true })
            .then(({ data }) => {
              if (data) setRounds(data as unknown as SingOffRound[])
            })
        })
        .subscribe(),
    )

    channels.push(
      supabase
        .channel(`singoff:decisions:${sessionId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'mai_singoff_decisions', filter: `session_id=eq.${sessionId}` }, (payload: any) => {
          const d = (payload.new ?? payload.old) as unknown as Omit<SingOffDecision, 'id'> & { id: string }
          if (payload.eventType === 'DELETE' || !d) return
          upsertDecision(d as SingOffDecision)
        })
        .subscribe(),
    )

    return () => {
      channels.forEach((ch) => supabase.removeChannel(ch))
    }
  }, [sessionId])

  // Broadcast channel: gifts, Mai Winner effect, kicks, countdown triggers
  useEffect(() => {
    if (!sessionId) return
    const channel = supabase.channel(`mai-singoff:${sessionId}`)
    channel
      .on('broadcast', { event: 'gift_sent' }, (payload: any) => {
        const gift = (payload?.payload as any) ?? {}
        const { sender_id, gift_id, gift_name } = gift
        // Resolve gift object from catalog to show icon in popup
        const catalogGift = require('@/lib/giftConstants').OFFICIAL_GIFTS.find((g: any) => g.id === gift_id)
        if (catalogGift) setActiveGift(catalogGift, gift.recipient_id ?? sender_id)
        // Also add a chat line for the gift so spectators see it
        addChatMessage({
          id: (Date.now() as unknown) as never,
          session_id: sessionId,
          user_id: sender_id ?? null,
          sender_name: gift.sender_name ?? 'Someone',
          body: `${gift.gift_name ?? gift_name} for ${gift.coins} 🪙`,
          role_at_time: null,
          is_gift: true,
          gift_data: gift,
          created_at: new Date().toISOString(),
        } as unknown as SingOffChatMessage)
      })
      .on('broadcast', { event: 'mai_winner' }, (payload: any) => {
        const w = (payload?.payload as any) ?? {}
        setMaiWinnerEffect(w.challenger_id, w.challenger_name)
      })
      .on('broadcast', { event: 'countdown_started' }, (payload: any) => {
        const c = (payload?.payload as any) ?? {}
        setCountdown(c.target_user_id, c.start_at)
      })
      .on('broadcast', { event: 'user_kicked' }, (payload: any) => {
        const k = (payload?.payload as any) ?? {}
        if (userId && k.user_id === userId) setLiveKit({ isConnected: false })
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [sessionId, userId])
}
