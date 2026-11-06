import { create } from 'zustand'
import { supabase } from './supabase'
import { XP_RATES, calculateNextLevelXp } from '../config/levelSystem'
import { toast } from 'sonner'

interface DailyLog {
  date: string
  chat_xp: number
  watch_xp: number
}

interface LevelState {
  currentLevel: number
  currentXp: number
  totalXp: number
  nextLevelXp: number
  prestigeCount: number
  perkTokens: number
  unlockedPerks: string[]
  dailyLog: DailyLog
  loading: boolean
  
  // Actions
  fetchLevelData: (userId: string) => Promise<void>
  addXp: (userId: string, amount: number, source: 'chat' | 'watch' | 'gift' | 'stream' | 'other') => Promise<void>
  checkDailyLogin: (userId: string) => Promise<void>
}

export const useLevelStore = create<LevelState>((set, get) => ({
  currentLevel: 1,
  currentXp: 0,
  totalXp: 0,
  nextLevelXp: 100,
  prestigeCount: 0,
  perkTokens: 0,
  unlockedPerks: [],
  dailyLog: { date: new Date().toISOString().split('T')[0], chat_xp: 0, watch_xp: 0 },
  loading: false,

  fetchLevelData: async (userId: string) => {
    set({ loading: true })
    
    // Skip level fetch for guest IDs (non-UUID format like TC-XXXX)
    if (!userId || userId.startsWith('TC-')) {
      console.log('Guest user detected, skipping level fetch');
      set({
        currentLevel: 1,
        currentXp: 0,
        totalXp: 0,
        nextLevelXp: 100,
        prestigeCount: 0,
        perkTokens: 0,
        unlockedPerks: [],
        dailyLog: { date: new Date().toISOString().split('T')[0], chat_xp: 0, watch_xp: 0 },
        loading: false
      });
      return;
    }
    
    try {
      const { data, error } = await supabase
        .from('user_stats')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle()

      if (error) {
        console.error('Error fetching levels:', error)
        return
      }

      if (!data) {
        // Initialize if not exists
        // Use grant_xp with 0 amount to init
        await supabase.rpc('grant_xp', {
            p_user_id: userId,
            p_amount: 0,
            p_source: 'init',
            p_source_id: `init_${Date.now()}`
        })
        
        set({
          currentLevel: 1,
          currentXp: 0,
          totalXp: 0,
          nextLevelXp: 100
        })
      } else {
        set({
          currentLevel: data.level || 1,
          currentXp: data.xp_total || 0,
          totalXp: data.xp_total || 0,
          nextLevelXp: data.xp_to_next_level || 100,
          prestigeCount: 0, // Not in user_stats yet
          perkTokens: 0, // Not in user_stats yet
          unlockedPerks: [], // Not in user_stats yet
          dailyLog: { date: new Date().toISOString().split('T')[0], chat_xp: 0, watch_xp: 0 }
        })
      }
    } catch (err) {
      console.error(err)
    } finally {
      set({ loading: false })
    }
  },

  addXp: async (userId, amount, source) => {
    const state = get()
    const today = new Date().toISOString().split('T')[0]
    let newDailyLog = { ...state.dailyLog }

    // Reset daily log if new day
    if (newDailyLog.date !== today) {
      newDailyLog = { date: today, chat_xp: 0, watch_xp: 0 }
    }

    // Check Caps
    if (source === 'chat') {
      if (newDailyLog.chat_xp >= XP_RATES.DAILY_CHAT_XP_CAP) return
      newDailyLog.chat_xp += amount
    } else if (source === 'watch') {
      if (newDailyLog.watch_xp >= XP_RATES.DAILY_WATCH_XP_CAP) return
      newDailyLog.watch_xp += amount
    }

    // Calculate new XP
    let newCurrentXp = state.currentXp + amount
    const newTotalXp = state.totalXp + amount
    let newLevel = state.currentLevel
    let newNextLevelXp = state.nextLevelXp
    let hasLevelUp = false

    // Level Up Logic
    while (newCurrentXp >= newNextLevelXp) {
      newCurrentXp -= newNextLevelXp
      newLevel++
      newNextLevelXp = calculateNextLevelXp(newLevel)

      hasLevelUp = true
      toast.success(`Leveled Up to ${newLevel}!`, {
        duration: 5000,
        icon: '🎉'
      })
    }

    if (hasLevelUp) {
      toast.warning('Level-up coin rewards are temporarily unavailable while secure server-side rewards are deployed.')
    }

    // Optimistic Update
    set({
      currentLevel: newLevel,
      currentXp: newCurrentXp,
      totalXp: newTotalXp,
      nextLevelXp: newNextLevelXp,
      dailyLog: newDailyLog
    })

    // DB Update
    // Using upsert or update
    const { error } = await supabase
      .from('user_stats')
      .update({
        level: newLevel,
        xp_total: newTotalXp,
        xp_to_next_level: newNextLevelXp,
        // daily_xp_log: newDailyLog, // Column does not exist in user_stats
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)

    if (error) {
      console.error('Failed to sync XP:', error)
      // Revert? For now, just log.
    }
  },

  checkDailyLogin: async (_userId) => {
    // This should be called on app mount
    // Implementation note: handled via initial fetch
  }
}))
