import { useCallback } from 'react'
import { toast } from 'sonner'
import { useAuthStore } from '@/lib/store'
import { supabase } from '@/lib/supabase'
import { OFFICIAL_GIFTS, GiftItem } from '@/lib/giftConstants'
import * as Service from '../services/singoffService'
import { useSingOffStore } from '../store/useSingOffStore'
import type { SingOffQueueEntry } from '../types'

export function useSingOffActions() {
  const { user, profile } = useAuthStore()

  const loadSession = useCallback(
    async (sid: string) => {
      const s = useSingOffStore.getState()
      s.setConnected(false)
      s.setError(null)
      const state = await Service.loadSessionState(sid, user?.id ?? '')
      if (!state) {
        s.setError('Could not load the Sing Off session.')
        toast.error('Could not load the Sing Off session.')
        return
      }
      s.initFromState(state)
      await Service.joinSession(sid, user?.id ?? '')
    },
    [user?.id],
  )

const startShow = useCallback(
    async (config: Record<string, any> = {}) => {
      if (!user?.id) return null
      const res = await Service.createSession(user.id, config)
      if (res.success && res.session_id) {
        toast.success('Sing Off stage created. Share the room to bring the crowd live!')
        return res.session_id
      }
      toast.error((res as any).error || 'Could not start the show.')
      return null
    },
    [user?.id],
  )

  const startLiveShow = useCallback(
    async (sid: string) => {
      if (!user?.id) return
      const res = await Service.startShow(sid, user.id)
      if (res.success) {
        toast.success('Show is live!')
      } else {
        toast.error(res.error || 'Could not start the show.')
      }
    },
    [user?.id],
  )

  const endLiveShow = useCallback(
    async (sid: string) => {
      if (!user?.id) return
      const res = await Service.endShow(sid, user.id)
      if (res.success) {
        toast.success('Show ended.')
        window.history.pushState(null, '', '/mai-sing-off')
      } else {
        toast.error(res.error || 'Could not end the show.')
      }
    },
    [user?.id],
  )

  const requestQueue = useCallback(
    async (requestedPosition: string | null = null) => {
      if (!user?.id) return
      const s = useSingOffStore.getState()
      const sid = s.session?.id
      if (!sid) return
      const res = await Service.requestQueue(
        sid,
        user.id,
        profile?.display_name ?? user.user_metadata?.full_name ?? 'Troll',
        profile?.avatar_url ?? null,
        profile?.level ?? 1,
        profile?.troll_coins ?? 0,
        requestedPosition,
      )
      if (res.success) {
        toast.success('You joined the queue!')
      } else {
        toast.error(res.error || 'Could not join the queue.')
      }
    },
    [user?.id, profile],
  )

  const callToStage = useCallback(
    async (targetUserId: string, position: string) => {
      if (!user?.id) return
      const s = useSingOffStore.getState()
      const sid = s.session?.id
      if (!sid) return
      const res = await Service.callToStage(sid, targetUserId, position, user.id)
      if (res.success) {
        const startAt = Date.now() + 10000
        Service.broadcastCountdown(sid, targetUserId, startAt)
        s.setCountdown(targetUserId, startAt)
        toast.success('Challenger called — 10 seconds to the stage!')
      } else {
        toast.error(res.error || 'Could not call to stage.')
      }
    },
    [user?.id],
  )

  const moveHost = useCallback(
    async (targetPosition: 'host_stage' | 'host_judge') => {
      if (!user?.id) return
      const s = useSingOffStore.getState()
      const sid = s.session?.id
      if (!sid) return
      const res = await Service.moveHost(sid, user.id, targetPosition)
      if (res.success) {
        s.setHostPosition(targetPosition)
      } else {
        toast.error(res.error || 'Could not move.')
      }
    },
    [user?.id],
  )

  /** Role-based seat claim: user (or staff on behalf of a target) takes an
   * eligible seat and publishes their LiveKit track to that box. */
  const claimSeat = useCallback(
    async (position: string, targetUserId?: string) => {
      if (!user?.id) return { success: false, error: 'not logged in' }
      const s = useSingOffStore.getState()
      const sid = s.session?.id
      if (!sid) return { success: false, error: 'no active session' }

      const me = targetUserId ?? user.id
      // Resolve the role that matches the seat being claimed.
      const positionRole: Record<string, string> = {
        challenger_a: 'challenger',
        challenger_b: 'challenger',
        host_stage: 'host',
        host_judge: 'host',
        judge_1: 'judge',
        judge_2: 'judge',
        judge_3: 'judge',
        judge_4: 'judge',
        ceo: 'ceo_judge',
      }
      const role = positionRole[position]
      if (!role) return { success: false, error: 'invalid seat' }

      const res = await Service.claimSeat(sid, me, position, role, user.id)
      if (res.success) {
        toast.success(`You took the ${position.replace('_', ' ')} seat!`)
      } else {
        toast.error(res.error || 'Could not claim that seat.')
      }
      return res
    },
    [user?.id],
  )

  const startRound = useCallback(async () => {
    if (!user?.id) return
    const s = useSingOffStore.getState()
    const sid = s.session?.id
    if (!sid) return
    const res = await Service.startRound(sid, user.id)
    if (res.success) {
      toast.success(`Round ${res.round_number} begins!`)
    } else {
      toast.error(res.error || 'Could not start the round.')
    }
  }, [user?.id])

  const endRound = useCallback(async () => {
    if (!user?.id) return
    const s = useSingOffStore.getState()
    const sid = s.session?.id
    const round = s.currentRound
    if (!sid || !round) return
    const res = await Service.endRound(sid, round.id, user.id)
    if (res.success) {
      s.resolveRound(round.id, res.winner_id ?? null)
      toast.success('Round resolved!')
    } else {
      toast.error(res.error || 'Not enough votes yet.')
    }
  }, [user?.id])

  const submitDecision = useCallback(
    async (challengerId: string, decision: 'no' | 'yes', isMaiWinner = false) => {
      if (!user?.id) return
      const s = useSingOffStore.getState()
      const sid = s.session?.id
      const round = s.currentRound
      if (!sid || !round) return
      const res = isMaiWinner
        ? await Service.maiWinner(sid, round.id, user.id, challengerId)
        : await Service.submitDecision(sid, round.id, user.id, challengerId, decision, false)
if (res.success) {
        const { data } = await supabase.from('mai_singoff_decisions').select('*').eq('round_id', round.id)
        if (data) s.setDecisions(data as any)
        if (isMaiWinner) toast.success('Mai Winner declared!')
      } else {
        toast.error(res.error || 'Could not record your vote.')
      }
    },
    [user?.id],
  )

  const sendGift = useCallback(
    async (recipientUserId: string, gift: GiftItem, quantity = 1) => {
      if (!user?.id) return
      const s = useSingOffStore.getState()
      const sid = s.session?.id
      if (!sid) return
      const res = await Service.sendSingOffGift(sid, user.id, recipientUserId, gift, quantity)
      if (res.success) {
        s.setActiveGift(gift, recipientUserId)
        setTimeout(() => s.clearActiveGift(), 2200)
      } else {
        toast.error(res.error || 'Not enough coins.')
      }
    },
    [user?.id],
  )

const sendChat = useCallback(
    async (body: string, sessionIdOverride?: string) => {
      if (!user?.id) return
      const s = useSingOffStore.getState()
      const sid = sessionIdOverride || s.session?.id
      if (!sid) return
      const res = await Service.sendChatMessage(sid, user?.id ?? null, profile?.display_name ?? 'Troll', body, profile?.role ?? null)
      if (!res.success) toast.error(res.error || 'Message not sent.')
    },
    [user?.id, profile],
  )

  const kickUser = useCallback(
    async (targetUserId: string) => {
      if (!user?.id) return
      const s = useSingOffStore.getState()
      const sid = s.session?.id
      if (!sid) return
      const res = await Service.kickUser(sid, targetUserId, user.id)
      if (res.success) {
        toast.success('User removed from the stage.')
      } else {
        toast.error(res.error || 'Could not remove user.')
      }
    },
    [user?.id],
  )

  const joinAsAudience = useCallback(
    async (sid: string) => {
      if (!user?.id) return
      const res = await Service.joinSession(sid, user.id)
      if (!res.success) toast.error(res.error || 'Could not join the show.')
    },
    [user?.id],
  )

  const loadStats = useCallback(async () => {
    const stats = await Service.loadStats(user?.id)
    return stats
  }, [user?.id])

  const applyJudge = useCallback(
    async (statement: string, experience: string, broadcastingExperience: string, agreement: boolean) => {
      if (!user?.id) return { success: false, error: 'not logged in' }
      return Service.applyJudge(user.id, statement, experience, broadcastingExperience, agreement)
    },
    [user?.id],
  )

  const setJudgeStatus = useCallback(
    async (applicationId: string, action: string, reason?: string) => {
      if (!user?.id) return { success: false, error: 'not logged in' }
      return Service.setJudgeStatus(applicationId, user.id, action, reason)
    },
    [user?.id],
  )

  // ---- Virtual Talent Show additions --------------------------------

  const scheduleShow = useCallback(
    async (title: string, scheduledAt: string) => {
      if (!user?.id) return { success: false, error: 'not logged in' }
      const res = await Service.scheduleShow(user.id, title, scheduledAt)
      if (res.success) toast.success('Show scheduled!')
      else toast.error(res.error || 'Could not schedule the show.')
      return res
    },
    [user?.id],
  )

  const updateScheduledShow = useCallback(
    async (sessionId: string, title?: string | null, scheduledAt?: string | null) => {
      if (!user?.id) return { success: false, error: 'not logged in' }
      return Service.updateScheduledShow(sessionId, user.id, title, scheduledAt)
    },
    [user?.id],
  )

  const cancelScheduledShow = useCallback(
    async (sessionId: string) => {
      if (!user?.id) return { success: false, error: 'not logged in' }
      const res = await Service.cancelScheduledShow(sessionId, user.id)
      if (res.success) toast.success('Scheduled show cancelled.')
      else toast.error(res.error || 'Could not cancel the show.')
      return res
    },
    [user?.id],
  )

  const listScheduledShows = useCallback(async () => {
    return Service.listScheduledShows()
  }, [])

  const applyRole = useCallback(
    async (
      applicationType: 'judge' | 'host',
      statement: string,
      experience: string,
      broadcastingExperience: string,
      agreement: boolean,
    ) => {
      if (!user?.id) return { success: false, error: 'not logged in' }
      return Service.applyRole(user.id, applicationType, statement, experience, broadcastingExperience, agreement)
    },
    [user?.id],
  )

  const reviewApplication = useCallback(
    async (applicationId: string, action: 'approve' | 'reject' | 'suspend', reason?: string | null) => {
      if (!user?.id) return { success: false, error: 'not logged in' }
      return Service.reviewApplication(applicationId, user.id, action, reason)
    },
    [user?.id],
  )

  const releaseRole = useCallback(
    async (targetUserId: string, role: 'judge' | 'host', sessionId?: string | null, reason?: string | null) => {
      if (!user?.id) return { success: false, error: 'not logged in' }
      const res = await Service.releaseRole(targetUserId, role, user.id, sessionId, reason)
      if (res.success) toast.success(`${role === 'judge' ? 'Judge' : 'Host'} released — access revoked.`)
      else toast.error(res.error || 'Could not release role.')
      return res
    },
    [user?.id],
  )

  const listRoleApplications = useCallback(async () => {
    if (!user?.id) return []
    return Service.listRoleApplications(user.id)
  }, [user?.id])

  const listActiveRoles = useCallback(async () => {
    if (!user?.id) return { judges: [], hosts: [] }
    return Service.listActiveRoles(user.id)
  }, [user?.id])

  const generateChampionship = useCallback(
    async (name?: string, grandPrizeCoins?: number, grandPrizeDescription?: string, entriesLimit?: number) => {
      if (!user?.id) return { success: false, error: 'not logged in' }
      const res = await Service.generateChampionship(user.id, name ?? null, grandPrizeCoins, grandPrizeDescription ?? null, entriesLimit)
      if (res.success) toast.success('Championship generated!')
      else toast.error(res.error || 'Could not generate championship.')
      return res
    },
    [user?.id],
  )

  const editGrandPrize = useCallback(
    async (championshipId: string, coins?: number | null, description?: string | null) => {
      if (!user?.id) return { success: false, error: 'not logged in' }
      return Service.editGrandPrize(championshipId, user.id, coins, description)
    },
    [user?.id],
  )

  const completeChampionship = useCallback(
    async (championshipId: string, championUserId: string) => {
      if (!user?.id) return { success: false, error: 'not logged in' }
      return Service.completeChampionship(championshipId, user.id, championUserId)
    },
    [user?.id],
  )

  const listChampionships = useCallback(async () => {
    return Service.listChampionships()
  }, [])

  const getUpcomingEvents = useCallback(async () => {
    return Service.getUpcomingEvents()
  }, [])

  const giftCatalog: GiftItem[] = OFFICIAL_GIFTS

return {
    user,
    profile,
    loadSession,
    startShow,
    startLiveShow,
    endLiveShow,
    joinAsAudience,
    requestQueue,
    callToStage,
    moveHost,
    claimSeat,
    startRound,
    endRound,
    submitDecision,
    sendGift,
    sendChat,
    kickUser,
    loadStats,
    applyJudge,
    setJudgeStatus,
    scheduleShow,
    updateScheduledShow,
    cancelScheduledShow,
    listScheduledShows,
    applyRole,
    reviewApplication,
    releaseRole,
    listRoleApplications,
    listActiveRoles,
    generateChampionship,
    editGrandPrize,
    completeChampionship,
    listChampionships,
    getUpcomingEvents,
    giftCatalog,
  }
}

