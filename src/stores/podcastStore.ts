import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface PodcastState {
  // Active podcast state (for mini player persistence)
  activePodcast: {
    description: string
    started_at: string
    listener_count: number
    host_user_id: string
    id: string
    title: string
    agora_channel_name: string
    host_username?: string
    recordingUrl?: string | null
    videoUrl?: string | null
    episodeId?: string | null
    status: 'live' | 'active' | 'ended' | 'scheduled' | 'archived'
  } | null
  showMiniPlayer: boolean
  isPlaying: boolean
  isMuted: boolean
  volume: number
  elapsedTime: number

  // Actions
  setActivePodcast: (podcast: PodcastState['activePodcast']) => void
  setShowMiniPlayer: (show: boolean) => void
  setPlaying: (playing: boolean) => void
  setMuted: (muted: boolean) => void
  setVolume: (volume: number) => void
  setElapsedTime: (time: number) => void
  clearPodcast: () => void
}

export const usePodcastStore = create<PodcastState>()(
  persist(
    (set, _get) => ({
      activePodcast: null,
      showMiniPlayer: false,
      isPlaying: false,
      isMuted: false,
      volume: 0.5,
      elapsedTime: 0,

      setActivePodcast: (podcast) => set({ activePodcast: podcast }),
      setShowMiniPlayer: (show) => set({ showMiniPlayer: show }),
      setPlaying: (playing) => set({ isPlaying: playing }),
      setMuted: (muted) => set({ isMuted: muted }),
      setVolume: (volume) => set({ volume }),
      setElapsedTime: (time) => set({ elapsedTime: time }),
      clearPodcast: () => set({ 
        activePodcast: null, 
        showMiniPlayer: false,
        isPlaying: false,
        elapsedTime: 0
      }),
    }),
    {
      name: 'troll-city-podcast',
      partialize: (state) => ({
        activePodcast: state.activePodcast,
        showMiniPlayer: state.showMiniPlayer,
        isPlaying: state.isPlaying,
        isMuted: state.isMuted,
        volume: state.volume,
      }),
    }
  )
)