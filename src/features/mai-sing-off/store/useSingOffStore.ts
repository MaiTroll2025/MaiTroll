import { create } from 'zustand'
import type {
  SingOffSession,
  SingOffUser,
  SingOffQueueEntry,
  SingOffRound,
  SingOffDecision,
  SingOffChatMessage,
  SingOffGiftEvent,
  SingOffAuthority,
  SingOffSessionState,
  SingOffView,
  Decision,
} from '../types'
import type { GiftItem } from '@/lib/giftConstants'

export interface SingOffState {
  session: SingOffSession | null
  participants: SingOffUser[]
  queue: SingOffQueueEntry[]
  rounds: SingOffRound[]
  currentRound: SingOffRound | null
  decisions: SingOffDecision[]
  hostPosition: 'host_stage' | 'host_judge'
  chatMessages: SingOffChatMessage[]
  chatOpen: boolean
  queueOpen: boolean
  coinStoreOpen: boolean
  judgesOpen: boolean
  activeGift: { gift: GiftItem; recipientUserId: string } | null
  maiWinnerEffect: { challengerId: string; challengerName: string } | null
  countdown: { targetUserId: string; startAt: number } | null
  view: SingOffView
  authority: SingOffAuthority
  liveKit: { isConnected: boolean; isPublishing: boolean; hasLocalTracks: boolean }
  myQueueEntry: SingOffQueueEntry | null
  isConnected: boolean
  error: string | null
}

export interface SingOffStore extends SingOffState {
  // lifecycle
  initFromState: (state: SingOffSessionState) => void
  setSession: (session: SingOffSession) => void
  setError: (error: string | null) => void
  setConnected: (value: boolean) => void
  // participants
  setParticipants: (participants: SingOffUser[]) => void
  upsertParticipant: (participant: SingOffUser) => void
  removeParticipant: (userId: string) => void
  // queue
  setQueue: (entries: SingOffQueueEntry[]) => void
  upsertQueueEntry: (entry: SingOffQueueEntry) => void
  setMyQueueEntry: (entry: SingOffQueueEntry | null) => void
  // rounds
  setRounds: (rounds: SingOffRound[]) => void
  setCurrentRound: (round: SingOffRound | null) => void
  resolveRound: (roundId: string, winnerId: string | null) => void
  // decisions
  setDecisions: (decisions: SingOffDecision[]) => void
  upsertDecision: (decision: SingOffDecision) => void
  // host
  setHostPosition: (position: 'host_stage' | 'host_judge') => void
  // countdown
  setCountdown: (targetUserId: string, startAt: number) => void
  clearCountdown: () => void
  // chat / popups
  addChatMessage: (message: SingOffChatMessage) => void
  setChatMessages: (messages: SingOffChatMessage[]) => void
  setChatOpen: (open: boolean) => void
  setQueueOpen: (open: boolean) => void
  setCoinStoreOpen: (open: boolean) => void
  setJudgesOpen: (open: boolean) => void
  setActiveGift: (gift: GiftItem, recipientUserId: string) => void
  clearActiveGift: () => void
  setMaiWinnerEffect: (challengerId: string, challengerName: string) => void
  clearMaiWinnerEffect: () => void
  // view / livekit
  setView: (view: SingOffView) => void
  setLiveKit: (state: Partial<SingOffState['liveKit']>) => void
  reset: () => void
}

const initialState: SingOffState = {
  session: null,
  participants: [],
  queue: [],
  rounds: [],
  currentRound: null,
  decisions: [],
  hostPosition: 'host_stage',
  chatMessages: [],
  chatOpen: false,
  queueOpen: false,
  coinStoreOpen: false,
  judgesOpen: false,
  activeGift: null,
  maiWinnerEffect: null,
  countdown: null,
  view: 'stage',
  authority: { is_staff: false, is_host: false, is_judge: false, is_ceo: false },
  liveKit: { isConnected: false, isPublishing: false, hasLocalTracks: false },
  myQueueEntry: null,
  isConnected: false,
  error: null,
}

export const useSingOffStore = create<SingOffStore>()((set, get) => ({
  ...initialState,

  initFromState: (state) => {
    const hostId = state.session?.host_id ?? null
    const userId = state.authority.is_host ? hostId : null
    set((s) => ({
      session: state.session,
      participants: state.participants,
      queue: state.queue,
      rounds: state.rounds,
      decisions: state.decisions,
      currentRound:
        state.rounds.filter((r) => r.status === 'active')[0] ??
        state.rounds[state.rounds.length - 1] ??
        null,
      hostPosition: s.hostPosition,
      authority: state.authority,
    }))
    get().setConnected(true)
  },

  setSession: (session) => set({ session }),
  setError: (error) => set({ error }),
  setConnected: (value) => set({ isConnected: value }),

  setParticipants: (participants) => set({ participants }),
  upsertParticipant: (participant) =>
    set((s) => ({
      participants: s.participants.some((p) => p.user_id === participant.user_id)
        ? s.participants.map((p) => (p.user_id === participant.user_id ? participant : p))
        : [...s.participants, participant],
    })),
  removeParticipant: (userId) =>
    set((s) => ({ participants: s.participants.filter((p) => p.user_id !== userId) })),

  setQueue: (entries) => set({ queue: entries }),
  upsertQueueEntry: (entry) =>
    set((s) => ({
      queue: s.queue.some((q) => q.id === entry.id)
        ? s.queue.map((q) => (q.id === entry.id ? entry : q))
        : [...s.queue, entry].sort((a, b) => a.sort_order - b.sort_order),
    })),
  setMyQueueEntry: (entry) => set({ myQueueEntry: entry }),

  setRounds: (rounds) => set({ rounds, currentRound: rounds.filter((r) => r.status === 'active')[0] ?? rounds[rounds.length - 1] ?? null }),
  setCurrentRound: (round) => set({ currentRound: round }),
  resolveRound: (roundId, winnerId) =>
    set((s) => ({
      rounds: s.rounds.map((r) => (r.id === roundId ? { ...r, status: 'completed', winner_id: winnerId } : r)),
      currentRound:
        s.currentRound?.id === roundId
          ? { ...s.currentRound, status: 'completed', winner_id: winnerId }
          : s.currentRound,
    })),

  setDecisions: (decisions) => set({ decisions }),
  upsertDecision: (decision) =>
    set((s) => ({
      decisions: s.decisions.some((d) => d.id === decision.id)
        ? s.decisions.map((d) => (d.id === decision.id ? decision : d))
        : [...s.decisions, decision],
    })),

  setHostPosition: (position) => set({ hostPosition: position }),
  setCountdown: (targetUserId, startAt) => set({ countdown: { targetUserId, startAt } }),
  clearCountdown: () => set({ countdown: null }),

  addChatMessage: (message) =>
    set((s) => ({ chatMessages: [...s.chatMessages, message].slice(-200) })),
  setChatMessages: (messages) => set({ chatMessages: messages }),
  setChatOpen: (open) => set({ chatOpen: open, queueOpen: false, judgesOpen: false }),
  setQueueOpen: (open) => set({ queueOpen: open, chatOpen: false, judgesOpen: false }),
  setCoinStoreOpen: (open) => set({ coinStoreOpen: open }),
  setJudgesOpen: (open) => set({ judgesOpen: open, chatOpen: false, queueOpen: false }),
  setActiveGift: (gift, recipientUserId) => set({ activeGift: { gift, recipientUserId } }),
  clearActiveGift: () => set({ activeGift: null }),
  setMaiWinnerEffect: (challengerId, challengerName) =>
    set({ maiWinnerEffect: { challengerId, challengerName } }),
  clearMaiWinnerEffect: () => set({ maiWinnerEffect: null }),

  setView: (view) => set({ view, chatOpen: false, queueOpen: false, judgesOpen: false }),
  setLiveKit: (state) => set((s) => ({ liveKit: { ...s.liveKit, ...state } })),

  reset: () => set({ ...initialState }),
}))
