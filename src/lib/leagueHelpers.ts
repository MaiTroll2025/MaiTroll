export type LeagueMissionStatus = 'active' | 'completed' | 'claimed' | 'expired'

export interface LeagueMission {
  id: string
  user_id: string
  league_event_id: string | null
  mission_key: string
  title: string
  description: string
  event_type: string
  target_value: number
  current_value: number
  reward_points: number
  reward_xp: number
  reward_coins: number
  status: LeagueMissionStatus
  generated_by: string
  completed_at: string | null
  claimed_at: string | null
  expires_at: string | null
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface UserLeagueProgress {
  level: number
  xpTotal: number
  xpToNext: number
  xpProgress: number
  tier: string
  nextReward: string
  paidChatUnlock: boolean
  paidChatLabel: string
  paidChatDetail: string
  paidChatTargetLevel: number
}

export const getLeagueTier = (level: number) => {
  if (level >= 2000) return 'MaiTroll Legend League'
  if (level >= 1500) return 'Legendary Citizen League'
  if (level >= 1000) return 'Elite Citizen League'
  if (level >= 700) return 'Verified City League'
  if (level >= 400) return 'City Regular League'
  if (level >= 100) return 'Active Citizen League'
  return 'Rookie Citizen League'
}

export const getXpRequiredForNextLevel = (level: number) => {
  return Math.floor(100 + level * 35 + Math.pow(level, 1.35))
}

export const getXpTotalForLevel = (level: number) => {
  let total = 0
  for (let i = 1; i < level; i += 1) {
    total += getXpRequiredForNextLevel(i)
  }
  return total
}

export const getLevelProgress = (currentXp: number, level: number) => {
  const currentLevelTotal = getXpTotalForLevel(level)
  const nextLevelTotal = currentLevelTotal + getXpRequiredForNextLevel(level)
  const currentLevelXp = Math.max(0, currentXp - currentLevelTotal)
  const remainingXp = Math.max(0, nextLevelTotal - currentXp)
  const progress = nextLevelTotal > currentLevelTotal
    ? Math.min(100, Math.max(0, Math.round((currentLevelXp / (nextLevelTotal - currentLevelTotal)) * 100)))
    : 100

  return {
    currentXp,
    currentLevelXp,
    xpToNext: remainingXp,
    progress,
  }
}

export const getNextReward = (level: number) => {
  if (level >= 2000) return 'Legendary Legacy Badge + 10,000 Trollmonds'
  if (level >= 1500) return 'Legendary City Supply Drop + 7,500 Trollmonds'
  if (level >= 1000) return 'Elite Pulse Reward + 5,000 Trollmonds'
  if (level >= 700) return 'Verified City Package + 3,000 Trollmonds'
  if (level >= 400) return 'Regular League Loot + 2,000 Trollmonds'
  if (level >= 100) return 'Active Citizen Chest + 1,000 Trollmonds'
  return 'Rookie Bonus Pack + 500 Trollmonds'
}

export const getPaidChatUnlockStatus = (level: number) => {
  if (level >= 420) {
    return {
      unlocked: true,
      label: 'Paid Chats Unlocked',
      detail: 'You can now earn from paid chats.',
      targetLevel: 420,
    }
  }

  return {
    unlocked: false,
    label: 'Paid Chats unlock at Level 420',
    detail: `Reach Level 420 to unlock paid chat earning and bonus status.`,
    targetLevel: 420,
  }
}

export const buildUserLeagueProgress = (stats?: any, profile?: any): UserLeagueProgress => {
  const level = Number(stats?.level ?? profile?.level ?? 1)
  const xpTotal = Number(stats?.xp_total ?? profile?.xp ?? 0)
  const xpToNext = Number(stats?.xp_to_next_level ?? getXpRequiredForNextLevel(level))
  const progress = Number(stats?.xp_progress ?? getLevelProgress(xpTotal, level).progress)
  const tier = getLeagueTier(level)
  const nextReward = getNextReward(level)
  const paidChat = getPaidChatUnlockStatus(level)

  return {
    level,
    xpTotal,
    xpToNext,
    xpProgress: Math.min(100, Math.max(0, progress)),
    tier,
    nextReward,
    paidChatUnlock: paidChat.unlocked,
    paidChatLabel: paidChat.label,
    paidChatDetail: paidChat.detail,
    paidChatTargetLevel: paidChat.targetLevel,
  }
}

export const formatLeagueEventType = (type?: string | null) => {
  if (!type) return 'Live League'
  return type
    .replace(/_/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((word) => word[0]?.toUpperCase() + word.slice(1))
    .join(' ')
}

export interface TierThreshold {
  tier: number
  xpRequired: number
  name: string
  shortLabel: string
  reward: string
}

export const TIER_THRESHOLDS: TierThreshold[] = [
  { tier: 0, xpRequired: 0, name: 'Street Rookie', shortLabel: 'T0', reward: 'Basic Profile Flair' },
  { tier: 1, xpRequired: 1000, name: 'Block Starter', shortLabel: 'T1', reward: 'Block Starter Badge' },
  { tier: 2, xpRequired: 3000, name: 'City Climber', shortLabel: 'T2', reward: 'City Climber Title' },
  { tier: 3, xpRequired: 7500, name: 'Neon Fighter', shortLabel: 'T3', reward: 'Neon Fighter Frame' },
  { tier: 4, xpRequired: 15000, name: 'Battle Verified', shortLabel: 'T4', reward: 'Battle Verified Emblem' },
  { tier: 5, xpRequired: 30000, name: 'War Ready', shortLabel: 'T5', reward: 'War Ready Chest + 1,000 Coins' },
  { tier: 6, xpRequired: 60000, name: 'Elite Citizen', shortLabel: 'T6', reward: 'Elite Citizen Crown' },
  { tier: 7, xpRequired: 120000, name: 'Crown Contender', shortLabel: 'T7', reward: 'Crown Contender Boost' },
  { tier: 8, xpRequired: 250000, name: 'City Champion', shortLabel: 'T8', reward: 'City Champion Trophy' },
  { tier: 9, xpRequired: 500000, name: 'Troll Legend', shortLabel: 'T9', reward: 'Legendary Troll Aura' },
  { tier: 10, xpRequired: 1000000, name: 'Final Boss', shortLabel: 'T10', reward: 'Final Boss Crown + 100,000 Coins' },
]

export interface LeagueTask {
  id: string
  cycleKey: string
  tier: number
  tierLabel: string
  week: number
  title: string
  description: string
  target: number
  current: number
  rewardXp: number
  rewardCoins: number
  status: 'locked' | 'active' | 'completed' | 'claimed'
  progressSource: ProgressSource
}

export type ProgressSource =
  | { type: 'profile'; column: 'total_gifts_sent' | 'total_chat_messages' | 'total_streams' | 'login_streak' | 'xp' }
  | { type: 'broadcast_minutes' }
  | { type: 'battles_won' }
  | { type: 'battles_joined' }
  | { type: 'wall_likes' }
  | { type: 'wall_replies' }
  | { type: 'family_points' }
  | { type: 'leaderboard_rank' }
  | { type: 'profile_updated' }
  | { type: 'reactions' }
  | { type: 'shares' }
  | { type: 'daily_missions'; count: number }
  | { type: 'weekly_missions'; count: number }
  | { type: 'monthly_missions'; count: number }
  | { type: 'seasonal_goals'; count: number }
  | { type: 'broadcasts_joined' }

export interface TaskProgressSnapshot {
  totalGiftsSent: number
  totalChatMessages: number
  totalStreams: number
  loginStreak: number
  xp: number
  broadcastMinutes: number
  battlesWon: number
  battlesJoined: number
  wallLikes: number
  wallReplies: number
  familyPoints: number
  leaderboardRank: number | null
  daysActive: number
}

export const DEFAULT_SNAPSHOT: TaskProgressSnapshot = {
  totalGiftsSent: 0,
  totalChatMessages: 0,
  totalStreams: 0,
  loginStreak: 0,
  xp: 0,
  broadcastMinutes: 0,
  battlesWon: 0,
  battlesJoined: 0,
  wallLikes: 0,
  wallReplies: 0,
  familyPoints: 0,
  leaderboardRank: null,
  daysActive: 0,
}

export const getTaskProgressValue = (source: ProgressSource, snapshot: TaskProgressSnapshot): number => {
  let value: number | undefined
  switch (source.type) {
    case 'profile':
      value = snapshot[source.column]
      break
    case 'broadcast_minutes':
      value = snapshot.broadcastMinutes
      break
    case 'battles_won':
      value = snapshot.battlesWon
      break
    case 'battles_joined':
      value = snapshot.battlesJoined
      break
    case 'wall_likes':
      value = snapshot.wallLikes
      break
    case 'wall_replies':
      value = snapshot.wallReplies
      break
    case 'family_points':
      value = snapshot.familyPoints
      break
    case 'leaderboard_rank':
      value = snapshot.leaderboardRank ?? 9999
      break
    case 'broadcasts_joined':
      value = snapshot.totalStreams
      break
    case 'weekly_missions':
    case 'monthly_missions':
      value = snapshot.daysActive
      break
    default:
      value = 0
      break
  }
  return Number(value) || 0
}

const P = {
  gifts: { type: 'profile' as const, column: 'total_gifts_sent' as const },
  chat: { type: 'profile' as const, column: 'total_chat_messages' as const },
  streams: { type: 'profile' as const, column: 'total_streams' as const },
  streak: { type: 'profile' as const, column: 'login_streak' as const },
  xp: { type: 'profile' as const, column: 'xp' as const },
  broadcastMin: { type: 'broadcast_minutes' as const },
  battlesWon: { type: 'battles_won' as const },
  battlesJoined: { type: 'battles_joined' as const },
  wallLikes: { type: 'wall_likes' as const },
  wallReplies: { type: 'wall_replies' as const },
  family: { type: 'family_points' as const },
  rank: { type: 'leaderboard_rank' as const },
  reactions: { type: 'reactions' as const },
  shares: { type: 'shares' as const },
  broadcasts: { type: 'broadcasts_joined' as const },
}

const TIER_TASK_TEMPLATES: Record<number, Array<Omit<LeagueTask, 'current' | 'status' | 'cycleKey'>>> = {
  0: [
    { id: 't0-watch', tier: 0, tierLabel: 'T0', week: 1, title: 'Watch 10 minutes live', description: 'Tune into any live broadcast for 10 total minutes this week.', target: 10, rewardXp: 100, rewardCoins: 10, progressSource: P.broadcastMin },
    { id: 't0-chat', tier: 0, tierLabel: 'T0', week: 1, title: 'Send 1 chat message', description: 'Jump into a live chat and say hello.', target: 1, rewardXp: 75, rewardCoins: 10, progressSource: P.chat },
    { id: 't0-broadcast', tier: 0, tierLabel: 'T0', week: 1, title: 'Join 1 broadcast', description: 'Sit inside one live broadcast until it ends or for 2 minutes.', target: 1, rewardXp: 100, rewardCoins: 10, progressSource: P.broadcasts },
    { id: 't0-watch-2', tier: 0, tierLabel: 'T0', week: 1, title: 'Watch 20 minutes live', description: 'Stack 20 total minutes of live viewing this week.', target: 20, rewardXp: 150, rewardCoins: 10, progressSource: P.broadcastMin },
    { id: 't0-chat-2', tier: 0, tierLabel: 'T0', week: 1, title: 'Send 3 chat messages', description: 'Keep the chat alive with 3 messages this week.', target: 3, rewardXp: 100, rewardCoins: 10, progressSource: P.chat },
    { id: 't0-like', tier: 0, tierLabel: 'T0', week: 2, title: 'Like 5 wall posts', description: 'Show love on 5 Troll Wall posts this week.', target: 5, rewardXp: 100, rewardCoins: 10, progressSource: P.wallLikes },
    { id: 't0-reply', tier: 0, tierLabel: 'T0', week: 2, title: 'Reply to 3 wall posts', description: 'Reply to 3 different Troll Wall posts this week.', target: 3, rewardXp: 125, rewardCoins: 10, progressSource: P.wallReplies },
    { id: 't0-broadcast-2', tier: 0, tierLabel: 'T0', week: 2, title: 'Join 2 broadcasts', description: 'Sit inside 2 separate live broadcasts this week.', target: 2, rewardXp: 150, rewardCoins: 10, progressSource: P.broadcasts },
    { id: 't0-watch-3', tier: 0, tierLabel: 'T0', week: 2, title: 'Watch 30 minutes live', description: 'Hit 30 total minutes of live viewing this week.', target: 30, rewardXp: 175, rewardCoins: 10, progressSource: P.broadcastMin },
    { id: 't0-profile', tier: 0, tierLabel: 'T0', week: 3, title: 'Update your profile', description: 'Add or change one profile detail this week.', target: 1, rewardXp: 75, rewardCoins: 10, progressSource: P.reactions },
    { id: 't0-emoji', tier: 0, tierLabel: 'T0', week: 3, title: 'React to 5 broadcasts', description: 'Use a reaction in 5 live broadcasts this week.', target: 5, rewardXp: 100, rewardCoins: 10, progressSource: P.reactions },
    { id: 't0-share', tier: 0, tierLabel: 'T0', week: 3, title: 'Share 1 broadcast', description: 'Share a live broadcast to your wall or a friend.', target: 1, rewardXp: 100, rewardCoins: 10, progressSource: P.shares },
    { id: 't0-streak', tier: 0, tierLabel: 'T0', week: 4, title: 'Log in 3 days this week', description: 'Open Mai Troll on 3 different days this week.', target: 3, rewardXp: 150, rewardCoins: 10, progressSource: P.streak },
    { id: 't0-chat-3', tier: 0, tierLabel: 'T0', week: 4, title: 'Send 5 chat messages', description: 'Keep chatting — send 5 messages this week.', target: 5, rewardXp: 125, rewardCoins: 10, progressSource: P.chat },
    { id: 't0-watch-4', tier: 0, tierLabel: 'T0', week: 4, title: 'Watch 45 minutes live', description: 'Reach 45 total minutes of live viewing this week.', target: 45, rewardXp: 200, rewardCoins: 10, progressSource: P.broadcastMin },
  ],
  1: [
    { id: 't1-gift', tier: 1, tierLabel: 'T1', week: 1, title: 'Send 1 gift', description: 'Drop a gift in a live broadcast to a creator you support.', target: 1, rewardXp: 150, rewardCoins: 10, progressSource: P.gifts },
    { id: 't1-seat', tier: 1, tierLabel: 'T1', week: 1, title: 'Sit in 1 guest seat', description: 'Claim a guest seat on a live broadcast at least once.', target: 1, rewardXp: 150, rewardCoins: 10, progressSource: P.broadcasts },
    { id: 't1-daily', tier: 1, tierLabel: 'T1', week: 1, title: 'Complete 1 daily mission', description: 'Finish any daily mission offered by Mai Troll.', target: 1, rewardXp: 200, rewardCoins: 10, progressSource: P.streak },
    { id: 't1-gift-2', tier: 1, tierLabel: 'T1', week: 2, title: 'Send 3 gifts', description: 'Drop 3 total gifts in live broadcasts this week.', target: 3, rewardXp: 250, rewardCoins: 10, progressSource: P.gifts },
    { id: 't1-watch', tier: 1, tierLabel: 'T1', week: 2, title: 'Watch 30 minutes live', description: 'Spend 30 total minutes watching live broadcasts.', target: 30, rewardXp: 300, rewardCoins: 10, progressSource: P.broadcastMin },
    { id: 't1-chat', tier: 1, tierLabel: 'T1', week: 2, title: 'Send 5 chat messages', description: 'Keep the chat alive with 5 messages this week.', target: 5, rewardXp: 200, rewardCoins: 10, progressSource: P.chat },
    { id: 't1-daily-2', tier: 1, tierLabel: 'T1', week: 3, title: 'Complete 2 daily missions', description: 'Finish 2 daily missions this week.', target: 2, rewardXp: 350, rewardCoins: 10, progressSource: P.streak },
    { id: 't1-broadcast', tier: 1, tierLabel: 'T1', week: 3, title: 'Join 3 broadcasts', description: 'Sit inside 3 separate live broadcasts this week.', target: 3, rewardXp: 300, rewardCoins: 10, progressSource: P.broadcasts },
    { id: 't1-like', tier: 1, tierLabel: 'T1', week: 3, title: 'Like 10 wall posts', description: 'Show love on 10 Troll Wall posts this week.', target: 10, rewardXp: 200, rewardCoins: 10, progressSource: P.wallLikes },
    { id: 't1-gift-3', tier: 1, tierLabel: 'T1', week: 4, title: 'Send 5 gifts', description: 'Drop 5 total gifts in live broadcasts this week.', target: 5, rewardXp: 400, rewardCoins: 10, progressSource: P.gifts },
    { id: 't1-watch-2', tier: 1, tierLabel: 'T1', week: 4, title: 'Watch 45 minutes live', description: 'Hit 45 total minutes of live viewing this week.', target: 45, rewardXp: 400, rewardCoins: 10, progressSource: P.broadcastMin },
    { id: 't1-streak', tier: 1, tierLabel: 'T1', week: 4, title: 'Log in 4 days this week', description: 'Open Mai Troll on 4 different days this week.', target: 4, rewardXp: 300, rewardCoins: 10, progressSource: P.streak },
    { id: 't1-chat-2', tier: 1, tierLabel: 'T1', week: 4, title: 'Send 10 chat messages', description: 'Keep chatting — send 10 messages this week.', target: 10, rewardXp: 250, rewardCoins: 10, progressSource: P.chat },
    { id: 't1-reply', tier: 1, tierLabel: 'T1', week: 4, title: 'Reply to 5 wall posts', description: 'Reply to 5 different Troll Wall posts this week.', target: 5, rewardXp: 250, rewardCoins: 10, progressSource: P.wallReplies },
    { id: 't1-xp', tier: 1, tierLabel: 'T1', week: 4, title: 'Earn 1,000 XP', description: 'Accumulate 1,000 XP from any activity this week.', target: 1000, rewardXp: 500, rewardCoins: 10, progressSource: P.xp },
  ],
  2: [
    { id: 't2-battle', tier: 2, tierLabel: 'T2', week: 1, title: 'Join 1 random battle', description: 'Queue up and enter one random battle.', target: 1, rewardXp: 300, rewardCoins: 10, progressSource: P.battlesJoined },
    { id: 't2-xp', tier: 2, tierLabel: 'T2', week: 1, title: 'Earn 250 XP', description: 'Accumulate 250 XP from any activity this week.', target: 250, rewardXp: 350, rewardCoins: 10, progressSource: P.xp },
    { id: 't2-watch', tier: 2, tierLabel: 'T2', week: 1, title: 'Watch 30 minutes live', description: 'Spend 30 total minutes watching live broadcasts.', target: 30, rewardXp: 400, rewardCoins: 10, progressSource: P.broadcastMin },
    { id: 't2-battle-2', tier: 2, tierLabel: 'T2', week: 2, title: 'Join 2 random battles', description: 'Queue up and enter 2 random battles this week.', target: 2, rewardXp: 500, rewardCoins: 10, progressSource: P.battlesJoined },
    { id: 't2-chat', tier: 2, tierLabel: 'T2', week: 2, title: 'Send 5 chat messages', description: 'Keep the chat alive with 5 messages this week.', target: 5, rewardXp: 300, rewardCoins: 10, progressSource: P.chat },
    { id: 't2-gift', tier: 2, tierLabel: 'T2', week: 2, title: 'Send 2 gifts', description: 'Drop 2 total gifts in live broadcasts this week.', target: 2, rewardXp: 400, rewardCoins: 10, progressSource: P.gifts },
    { id: 't2-battle-3', tier: 2, tierLabel: 'T2', week: 3, title: 'Join 3 random battles', description: 'Queue up and enter 3 random battles this week.', target: 3, rewardXp: 700, rewardCoins: 10, progressSource: P.battlesJoined },
    { id: 't2-xp-2', tier: 2, tierLabel: 'T2', week: 3, title: 'Earn 500 XP', description: 'Accumulate 500 XP from any activity this week.', target: 500, rewardXp: 600, rewardCoins: 10, progressSource: P.xp },
    { id: 't2-watch-2', tier: 2, tierLabel: 'T2', week: 3, title: 'Watch 45 minutes live', description: 'Hit 45 total minutes of live viewing this week.', target: 45, rewardXp: 700, rewardCoins: 10, progressSource: P.broadcastMin },
    { id: 't2-daily', tier: 2, tierLabel: 'T2', week: 4, title: 'Complete 2 daily missions', description: 'Finish 2 daily missions this week.', target: 2, rewardXp: 600, rewardCoins: 10, progressSource: P.streak },
    { id: 't2-battle-4', tier: 2, tierLabel: 'T2', week: 4, title: 'Join 4 random battles', description: 'Queue up and enter 4 random battles this week.', target: 4, rewardXp: 900, rewardCoins: 10, progressSource: P.battlesJoined },
    { id: 't2-gift-2', tier: 2, tierLabel: 'T2', week: 4, title: 'Send 4 gifts', description: 'Drop 4 total gifts in live broadcasts this week.', target: 4, rewardXp: 700, rewardCoins: 10, progressSource: P.gifts },
    { id: 't2-streak', tier: 2, tierLabel: 'T2', week: 4, title: 'Log in 4 days this week', description: 'Open Mai Troll on 4 different days this week.', target: 4, rewardXp: 500, rewardCoins: 10, progressSource: P.streak },
    { id: 't2-like', tier: 2, tierLabel: 'T2', week: 4, title: 'Like 10 wall posts', description: 'Show love on 10 Troll Wall posts this week.', target: 10, rewardXp: 400, rewardCoins: 10, progressSource: P.wallLikes },
    { id: 't2-xp-3', tier: 2, tierLabel: 'T2', week: 4, title: 'Earn 750 XP', description: 'Accumulate 750 XP from any activity this week.', target: 750, rewardXp: 800, rewardCoins: 10, progressSource: P.xp },
  ],
  3: [
    { id: 't3-win', tier: 3, tierLabel: 'T3', week: 1, title: 'Win 1 random battle', description: 'Take the W in at least one random battle.', target: 1, rewardXp: 600, rewardCoins: 10, progressSource: P.battlesWon },
    { id: 't3-gifts', tier: 3, tierLabel: 'T3', week: 1, title: 'Send 5 gifts', description: 'Send 5 total gifts during live broadcasts.', target: 5, rewardXp: 750, rewardCoins: 10, progressSource: P.gifts },
    { id: 't3-family', tier: 3, tierLabel: 'T3', week: 1, title: 'Help your family earn 50 war points', description: 'Earn 50 war points for your Troll Family this week.', target: 50, rewardXp: 800, rewardCoins: 10, progressSource: P.family },
    { id: 't3-win-2', tier: 3, tierLabel: 'T3', week: 2, title: 'Win 2 random battles', description: 'Take the W in 2 random battles this week.', target: 2, rewardXp: 1000, rewardCoins: 10, progressSource: P.battlesWon },
    { id: 't3-watch', tier: 3, tierLabel: 'T3', week: 2, title: 'Watch 30 minutes live', description: 'Spend 30 total minutes watching live broadcasts.', target: 30, rewardXp: 800, rewardCoins: 10, progressSource: P.broadcastMin },
    { id: 't3-chat', tier: 3, tierLabel: 'T3', week: 2, title: 'Send 5 chat messages', description: 'Keep the chat alive with 5 messages this week.', target: 5, rewardXp: 600, rewardCoins: 10, progressSource: P.chat },
    { id: 't3-win-3', tier: 3, tierLabel: 'T3', week: 3, title: 'Win 3 random battles', description: 'Take the W in 3 random battles this week.', target: 3, rewardXp: 1400, rewardCoins: 10, progressSource: P.battlesWon },
    { id: 't3-gifts-2', tier: 3, tierLabel: 'T3', week: 3, title: 'Send 10 gifts', description: 'Send 10 total gifts during live broadcasts.', target: 10, rewardXp: 1200, rewardCoins: 10, progressSource: P.gifts },
    { id: 't3-family-2', tier: 3, tierLabel: 'T3', week: 3, title: 'Help your family earn 100 war points', description: 'Earn 100 war points for your Troll Family this week.', target: 100, rewardXp: 1400, rewardCoins: 10, progressSource: P.family },
    { id: 't3-xp', tier: 3, tierLabel: 'T3', week: 4, title: 'Earn 2,000 XP', description: 'Accumulate 2,000 XP from any activity this week.', target: 2000, rewardXp: 1500, rewardCoins: 10, progressSource: P.xp },
    { id: 't3-daily', tier: 3, tierLabel: 'T3', week: 4, title: 'Complete 2 daily missions', description: 'Finish 2 daily missions this week.', target: 2, rewardXp: 1000, rewardCoins: 10, progressSource: P.streak },
    { id: 't3-broadcast', tier: 3, tierLabel: 'T3', week: 4, title: 'Join 3 broadcasts', description: 'Sit inside 3 separate live broadcasts this week.', target: 3, rewardXp: 900, rewardCoins: 10, progressSource: P.broadcasts },
    { id: 't3-streak', tier: 3, tierLabel: 'T3', week: 4, title: 'Log in 5 days this week', description: 'Open Mai Troll on 5 different days this week.', target: 5, rewardXp: 800, rewardCoins: 10, progressSource: P.streak },
    { id: 't3-like', tier: 3, tierLabel: 'T3', week: 4, title: 'Like 15 wall posts', description: 'Show love on 15 Troll Wall posts this week.', target: 15, rewardXp: 700, rewardCoins: 10, progressSource: P.wallLikes },
    { id: 't3-reply', tier: 3, tierLabel: 'T3', week: 4, title: 'Reply to 5 wall posts', description: 'Reply to 5 different Troll Wall posts this week.', target: 5, rewardXp: 700, rewardCoins: 10, progressSource: P.wallReplies },
  ],
  4: [
    { id: 't4-battles', tier: 4, tierLabel: 'T4', week: 1, title: 'Complete 3 battles', description: 'Finish 3 battles of any type.', target: 3, rewardXp: 1000, rewardCoins: 10, progressSource: P.battlesJoined },
    { id: 't4-xp', tier: 4, tierLabel: 'T4', week: 1, title: 'Earn 1,000 XP', description: 'Stack up 1,000 XP through gifting, battles, and watching.', target: 1000, rewardXp: 1200, rewardCoins: 10, progressSource: P.xp },
    { id: 't4-goals', tier: 4, tierLabel: 'T4', week: 1, title: 'Contribute to 1 family or agency goal', description: 'Help your family or agency progress a tier-one goal.', target: 1, rewardXp: 1200, rewardCoins: 10, progressSource: P.family },
    { id: 't4-battles-2', tier: 4, tierLabel: 'T4', week: 2, title: 'Complete 5 battles', description: 'Finish 5 battles of any type this week.', target: 5, rewardXp: 1600, rewardCoins: 10, progressSource: P.battlesJoined },
    { id: 't4-watch', tier: 4, tierLabel: 'T4', week: 2, title: 'Watch 45 minutes live', description: 'Hit 45 total minutes of live viewing this week.', target: 45, rewardXp: 1200, rewardCoins: 10, progressSource: P.broadcastMin },
    { id: 't4-gift', tier: 4, tierLabel: 'T4', week: 2, title: 'Send 5 gifts', description: 'Drop 5 total gifts in live broadcasts this week.', target: 5, rewardXp: 1200, rewardCoins: 10, progressSource: P.gifts },
    { id: 't4-battles-3', tier: 4, tierLabel: 'T4', week: 3, title: 'Complete 7 battles', description: 'Finish 7 battles of any type this week.', target: 7, rewardXp: 2000, rewardCoins: 10, progressSource: P.battlesJoined },
    { id: 't4-xp-2', tier: 4, tierLabel: 'T4', week: 3, title: 'Earn 2,000 XP', description: 'Stack up 2,000 XP through any activity this week.', target: 2000, rewardXp: 1800, rewardCoins: 10, progressSource: P.xp },
    { id: 't4-goals-2', tier: 4, tierLabel: 'T4', week: 3, title: 'Contribute to 2 family or agency goals', description: 'Help your family or agency progress 2 goals this week.', target: 2, rewardXp: 2000, rewardCoins: 10, progressSource: P.family },
    { id: 't4-daily', tier: 4, tierLabel: 'T4', week: 4, title: 'Complete 3 daily missions', description: 'Finish 3 daily missions this week.', target: 3, rewardXp: 1500, rewardCoins: 10, progressSource: P.streak },
    { id: 't4-battles-4', tier: 4, tierLabel: 'T4', week: 4, title: 'Complete 10 battles', description: 'Finish 10 battles of any type this week.', target: 10, rewardXp: 2500, rewardCoins: 10, progressSource: P.battlesJoined },
    { id: 't4-gift-2', tier: 4, tierLabel: 'T4', week: 4, title: 'Send 10 gifts', description: 'Drop 10 total gifts in live broadcasts this week.', target: 10, rewardXp: 1800, rewardCoins: 10, progressSource: P.gifts },
    { id: 't4-streak', tier: 4, tierLabel: 'T4', week: 4, title: 'Log in 5 days this week', description: 'Open Mai Troll on 5 different days this week.', target: 5, rewardXp: 1200, rewardCoins: 10, progressSource: P.streak },
    { id: 't4-chat', tier: 4, tierLabel: 'T4', week: 4, title: 'Send 10 chat messages', description: 'Keep chatting — send 10 messages this week.', target: 10, rewardXp: 1000, rewardCoins: 10, progressSource: P.chat },
    { id: 't4-xp-3', tier: 4, tierLabel: 'T4', week: 4, title: 'Earn 3,000 XP', description: 'Stack up 3,000 XP through any activity this week.', target: 3000, rewardXp: 2200, rewardCoins: 10, progressSource: P.xp },
  ],
  5: [
    { id: 't5-wins', tier: 5, tierLabel: 'T5', week: 1, title: 'Win 5 battles', description: 'Win 5 battles this week.', target: 5, rewardXp: 2000, rewardCoins: 10, progressSource: P.battlesWon },
    { id: 't5-broadcasts', tier: 5, tierLabel: 'T5', week: 1, title: 'Join 3 broadcasts', description: 'Sit in 3 separate live broadcasts this week.', target: 3, rewardXp: 1500, rewardCoins: 10, progressSource: P.broadcasts },
    { id: 't5-family', tier: 5, tierLabel: 'T5', week: 1, title: 'Earn 500 family/agency points', description: 'Bank 500 points toward your family or agency score.', target: 500, rewardXp: 2200, rewardCoins: 10, progressSource: P.family },
    { id: 't5-wins-2', tier: 5, tierLabel: 'T5', week: 2, title: 'Win 7 battles', description: 'Win 7 battles this week.', target: 7, rewardXp: 2800, rewardCoins: 10, progressSource: P.battlesWon },
    { id: 't5-watch', tier: 5, tierLabel: 'T5', week: 2, title: 'Watch 60 minutes live', description: 'Hit 60 total minutes of live viewing this week.', target: 60, rewardXp: 2000, rewardCoins: 10, progressSource: P.broadcastMin },
    { id: 't5-gift', tier: 5, tierLabel: 'T5', week: 2, title: 'Send 8 gifts', description: 'Drop 8 total gifts in live broadcasts this week.', target: 8, rewardXp: 2000, rewardCoins: 10, progressSource: P.gifts },
    { id: 't5-wins-3', tier: 5, tierLabel: 'T5', week: 3, title: 'Win 10 battles', description: 'Win 10 battles this week.', target: 10, rewardXp: 3500, rewardCoins: 10, progressSource: P.battlesWon },
    { id: 't5-xp', tier: 5, tierLabel: 'T5', week: 3, title: 'Earn 5,000 XP', description: 'Grind up 5,000 XP through any activity.', target: 5000, rewardXp: 3500, rewardCoins: 10, progressSource: P.xp },
    { id: 't5-family-2', tier: 5, tierLabel: 'T5', week: 3, title: 'Earn 750 family/agency points', description: 'Bank 750 points toward your family or agency score.', target: 750, rewardXp: 3000, rewardCoins: 10, progressSource: P.family },
    { id: 't5-daily', tier: 5, tierLabel: 'T5', week: 4, title: 'Complete 3 daily missions', description: 'Finish 3 daily missions this week.', target: 3, rewardXp: 2500, rewardCoins: 10, progressSource: P.streak },
    { id: 't5-broadcasts-2', tier: 5, tierLabel: 'T5', week: 4, title: 'Join 5 broadcasts', description: 'Sit in 5 separate live broadcasts this week.', target: 5, rewardXp: 2500, rewardCoins: 10, progressSource: P.broadcasts },
    { id: 't5-gift-2', tier: 5, tierLabel: 'T5', week: 4, title: 'Send 12 gifts', description: 'Drop 12 total gifts in live broadcasts this week.', target: 12, rewardXp: 2500, rewardCoins: 10, progressSource: P.gifts },
    { id: 't5-streak', tier: 5, tierLabel: 'T5', week: 4, title: 'Log in 5 days this week', description: 'Open Mai Troll on 5 different days this week.', target: 5, rewardXp: 2000, rewardCoins: 10, progressSource: P.streak },
    { id: 't5-chat', tier: 5, tierLabel: 'T5', week: 4, title: 'Send 15 chat messages', description: 'Keep chatting — send 15 messages this week.', target: 15, rewardXp: 1800, rewardCoins: 10, progressSource: P.chat },
    { id: 't5-xp-2', tier: 5, tierLabel: 'T5', week: 4, title: 'Earn 7,500 XP', description: 'Grind up 7,500 XP through any activity.', target: 7500, rewardXp: 4000, rewardCoins: 10, progressSource: P.xp },
  ],
  6: [
    { id: 't6-weekly', tier: 6, tierLabel: 'T6', week: 1, title: 'Complete 2 weekly missions', description: 'Finish 2 weekly missions in a single week.', target: 2, rewardXp: 3500, rewardCoins: 10, progressSource: P.streak },
    { id: 't6-xp', tier: 6, tierLabel: 'T6', week: 1, title: 'Earn 5,000 XP', description: 'Grind up 5,000 XP through any activity.', target: 5000, rewardXp: 4000, rewardCoins: 10, progressSource: P.xp },
    { id: 't6-goal', tier: 6, tierLabel: 'T6', week: 1, title: 'Help agency/family finish 1 goal', description: 'Contribute enough to fully complete one family or agency goal.', target: 1, rewardXp: 4500, rewardCoins: 10, progressSource: P.family },
    { id: 't6-weekly-2', tier: 6, tierLabel: 'T6', week: 2, title: 'Complete 3 weekly missions', description: 'Finish 3 weekly missions this week.', target: 3, rewardXp: 5000, rewardCoins: 10, progressSource: P.streak },
    { id: 't6-battles', tier: 6, tierLabel: 'T6', week: 2, title: 'Complete 10 battles', description: 'Finish 10 battles of any type this week.', target: 10, rewardXp: 4000, rewardCoins: 10, progressSource: P.battlesJoined },
    { id: 't6-gift', tier: 6, tierLabel: 'T6', week: 2, title: 'Send 10 gifts', description: 'Drop 10 total gifts in live broadcasts this week.', target: 10, rewardXp: 3500, rewardCoins: 10, progressSource: P.gifts },
    { id: 't6-weekly-3', tier: 6, tierLabel: 'T6', week: 3, title: 'Complete 4 weekly missions', description: 'Finish 4 weekly missions this week.', target: 4, rewardXp: 6500, rewardCoins: 10, progressSource: P.streak },
    { id: 't6-xp-2', tier: 6, tierLabel: 'T6', week: 3, title: 'Earn 7,500 XP', description: 'Grind up 7,500 XP through any activity.', target: 7500, rewardXp: 5500, rewardCoins: 10, progressSource: P.xp },
    { id: 't6-goal-2', tier: 6, tierLabel: 'T6', week: 3, title: 'Help agency/family finish 2 goals', description: 'Contribute enough to fully complete 2 family or agency goals.', target: 2, rewardXp: 6500, rewardCoins: 10, progressSource: P.family },
    { id: 't6-daily', tier: 6, tierLabel: 'T6', week: 4, title: 'Complete 4 daily missions', description: 'Finish 4 daily missions this week.', target: 4, rewardXp: 5000, rewardCoins: 10, progressSource: P.streak },
    { id: 't6-battles-2', tier: 6, tierLabel: 'T6', week: 4, title: 'Complete 15 battles', description: 'Finish 15 battles of any type this week.', target: 15, rewardXp: 6000, rewardCoins: 10, progressSource: P.battlesJoined },
    { id: 't6-gift-2', tier: 6, tierLabel: 'T6', week: 4, title: 'Send 15 gifts', description: 'Drop 15 total gifts in live broadcasts this week.', target: 15, rewardXp: 5000, rewardCoins: 10, progressSource: P.gifts },
    { id: 't6-streak', tier: 6, tierLabel: 'T6', week: 4, title: 'Log in 6 days this week', description: 'Open Mai Troll on 6 different days this week.', target: 6, rewardXp: 4000, rewardCoins: 10, progressSource: P.streak },
    { id: 't6-watch', tier: 6, tierLabel: 'T6', week: 4, title: 'Watch 90 minutes live', description: 'Hit 90 total minutes of live viewing this week.', target: 90, rewardXp: 5500, rewardCoins: 10, progressSource: P.broadcastMin },
    { id: 't6-xp-3', tier: 6, tierLabel: 'T6', week: 4, title: 'Earn 10,000 XP', description: 'Grind up 10,000 XP through any activity.', target: 10000, rewardXp: 7000, rewardCoins: 10, progressSource: P.xp },
  ],
  7: [
    { id: 't7-leaderboard', tier: 7, tierLabel: 'T7', week: 1, title: 'Reach top 50 leaderboard', description: 'Break into the top 50 of the city leaderboard.', target: 50, rewardXp: 8000, rewardCoins: 10, progressSource: P.rank },
    { id: 't7-wins', tier: 7, tierLabel: 'T7', week: 1, title: 'Win 10 battles', description: 'Take 10 battle victories.', target: 10, rewardXp: 7500, rewardCoins: 10, progressSource: P.battlesWon },
    { id: 't7-xp', tier: 7, tierLabel: 'T7', week: 1, title: 'Earn 10,000 XP', description: 'Accumulate 10,000 XP in real city activity.', target: 10000, rewardXp: 9000, rewardCoins: 10, progressSource: P.xp },
    { id: 't7-leaderboard-2', tier: 7, tierLabel: 'T7', week: 2, title: 'Reach top 40 leaderboard', description: 'Break into the top 40 of the city leaderboard.', target: 40, rewardXp: 10000, rewardCoins: 10, progressSource: P.rank },
    { id: 't7-battles', tier: 7, tierLabel: 'T7', week: 2, title: 'Complete 15 battles', description: 'Finish 15 battles of any type this week.', target: 15, rewardXp: 9000, rewardCoins: 10, progressSource: P.battlesJoined },
    { id: 't7-gift', tier: 7, tierLabel: 'T7', week: 2, title: 'Send 15 gifts', description: 'Drop 15 total gifts in live broadcasts this week.', target: 15, rewardXp: 8000, rewardCoins: 10, progressSource: P.gifts },
    { id: 't7-leaderboard-3', tier: 7, tierLabel: 'T7', week: 3, title: 'Reach top 30 leaderboard', description: 'Break into the top 30 of the city leaderboard.', target: 30, rewardXp: 12000, rewardCoins: 10, progressSource: P.rank },
    { id: 't7-wins-2', tier: 7, tierLabel: 'T7', week: 3, title: 'Win 15 battles', description: 'Take 15 battle victories this week.', target: 15, rewardXp: 11000, rewardCoins: 10, progressSource: P.battlesWon },
    { id: 't7-family', tier: 7, tierLabel: 'T7', week: 3, title: 'Earn 1,500 family/agency points', description: 'Bank 1,500 points toward your family or agency score.', target: 1500, rewardXp: 10000, rewardCoins: 10, progressSource: P.family },
    { id: 't7-daily', tier: 7, tierLabel: 'T7', week: 4, title: 'Complete 5 daily missions', description: 'Finish 5 daily missions this week.', target: 5, rewardXp: 8000, rewardCoins: 10, progressSource: P.streak },
    { id: 't7-battles-2', tier: 7, tierLabel: 'T7', week: 4, title: 'Complete 20 battles', description: 'Finish 20 battles of any type this week.', target: 20, rewardXp: 12000, rewardCoins: 10, progressSource: P.battlesJoined },
    { id: 't7-gift-2', tier: 7, tierLabel: 'T7', week: 4, title: 'Send 20 gifts', description: 'Drop 20 total gifts in live broadcasts this week.', target: 20, rewardXp: 10000, rewardCoins: 10, progressSource: P.gifts },
    { id: 't7-streak', tier: 7, tierLabel: 'T7', week: 4, title: 'Log in 6 days this week', description: 'Open Mai Troll on 6 different days this week.', target: 6, rewardXp: 7000, rewardCoins: 10, progressSource: P.streak },
    { id: 't7-watch', tier: 7, tierLabel: 'T7', week: 4, title: 'Watch 120 minutes live', description: 'Hit 2 hours of live viewing this week.', target: 120, rewardXp: 9000, rewardCoins: 10, progressSource: P.broadcastMin },
    { id: 't7-xp-2', tier: 7, tierLabel: 'T7', week: 4, title: 'Earn 15,000 XP', description: 'Accumulate 15,000 XP in real city activity.', target: 15000, rewardXp: 12000, rewardCoins: 10, progressSource: P.xp },
  ],
  8: [
    { id: 't8-leaderboard', tier: 8, tierLabel: 'T8', week: 1, title: 'Reach top 25 leaderboard', description: 'Squeeze into the top 25 of the city leaderboard.', target: 25, rewardXp: 18000, rewardCoins: 10, progressSource: P.rank },
    { id: 't8-battles', tier: 8, tierLabel: 'T8', week: 1, title: 'Complete 25 battles', description: 'Finish 25 battles of any type.', target: 25, rewardXp: 16000, rewardCoins: 10, progressSource: P.battlesJoined },
    { id: 't8-xp', tier: 8, tierLabel: 'T8', week: 1, title: 'Earn 25,000 XP', description: 'Hit 25,000 XP from gifting, battling, and loyalty.', target: 25000, rewardXp: 20000, rewardCoins: 10, progressSource: P.xp },
    { id: 't8-leaderboard-2', tier: 8, tierLabel: 'T8', week: 2, title: 'Reach top 15 leaderboard', description: 'Squeeze into the top 15 of the city leaderboard.', target: 15, rewardXp: 22000, rewardCoins: 10, progressSource: P.rank },
    { id: 't8-battles-2', tier: 8, tierLabel: 'T8', week: 2, title: 'Complete 35 battles', description: 'Finish 35 battles of any type this week.', target: 35, rewardXp: 20000, rewardCoins: 10, progressSource: P.battlesJoined },
    { id: 't8-gift', tier: 8, tierLabel: 'T8', week: 2, title: 'Send 20 gifts', description: 'Drop 20 total gifts in live broadcasts this week.', target: 20, rewardXp: 18000, rewardCoins: 10, progressSource: P.gifts },
    { id: 't8-leaderboard-3', tier: 8, tierLabel: 'T8', week: 3, title: 'Reach top 10 leaderboard', description: 'Squeeze into the top 10 of the city leaderboard.', target: 10, rewardXp: 28000, rewardCoins: 10, progressSource: P.rank },
    { id: 't8-wins', tier: 8, tierLabel: 'T8', week: 3, title: 'Win 20 battles', description: 'Take 20 battle victories this week.', target: 20, rewardXp: 24000, rewardCoins: 10, progressSource: P.battlesWon },
    { id: 't8-family', tier: 8, tierLabel: 'T8', week: 3, title: 'Earn 2,500 family/agency points', description: 'Bank 2,500 points toward your family or agency score.', target: 2500, rewardXp: 22000, rewardCoins: 10, progressSource: P.family },
    { id: 't8-daily', tier: 8, tierLabel: 'T8', week: 4, title: 'Complete 6 daily missions', description: 'Finish 6 daily missions this week.', target: 6, rewardXp: 18000, rewardCoins: 10, progressSource: P.streak },
    { id: 't8-battles-3', tier: 8, tierLabel: 'T8', week: 4, title: 'Complete 50 battles', description: 'Finish 50 battles of any type this week.', target: 50, rewardXp: 28000, rewardCoins: 10, progressSource: P.battlesJoined },
    { id: 't8-gift-2', tier: 8, tierLabel: 'T8', week: 4, title: 'Send 30 gifts', description: 'Drop 30 total gifts in live broadcasts this week.', target: 30, rewardXp: 24000, rewardCoins: 10, progressSource: P.gifts },
    { id: 't8-streak', tier: 8, tierLabel: 'T8', week: 4, title: 'Log in 7 days this week', description: 'Open Mai Troll every day this week.', target: 7, rewardXp: 16000, rewardCoins: 10, progressSource: P.streak },
    { id: 't8-watch', tier: 8, tierLabel: 'T8', week: 4, title: 'Watch 150 minutes live', description: 'Hit 2.5 hours of live viewing this week.', target: 150, rewardXp: 20000, rewardCoins: 10, progressSource: P.broadcastMin },
    { id: 't8-xp-2', tier: 8, tierLabel: 'T8', week: 4, title: 'Earn 35,000 XP', description: 'Hit 35,000 XP from gifting, battling, and loyalty.', target: 35000, rewardXp: 28000, rewardCoins: 10, progressSource: P.xp },
  ],
  9: [
    { id: 't9-wins', tier: 9, tierLabel: 'T9', week: 1, title: 'Win 25 battles', description: 'Win 25 battles this week.', target: 25, rewardXp: 50000, rewardCoins: 10, progressSource: P.battlesWon },
    { id: 't9-xp', tier: 9, tierLabel: 'T9', week: 1, title: 'Earn 50,000 XP', description: 'Stack 50,000 XP of honest Mai Troll activity.', target: 50000, rewardXp: 60000, rewardCoins: 10, progressSource: P.xp },
    { id: 't9-monthly', tier: 9, tierLabel: 'T9', week: 1, title: 'Finish 1 monthly mission', description: 'Complete 1 monthly mission before the reset.', target: 1, rewardXp: 55000, rewardCoins: 10, progressSource: P.streak },
    { id: 't9-wins-2', tier: 9, tierLabel: 'T9', week: 2, title: 'Win 35 battles', description: 'Win 35 battles this week.', target: 35, rewardXp: 70000, rewardCoins: 10, progressSource: P.battlesWon },
    { id: 't9-battles', tier: 9, tierLabel: 'T9', week: 2, title: 'Complete 60 battles', description: 'Finish 60 battles of any type this week.', target: 60, rewardXp: 65000, rewardCoins: 10, progressSource: P.battlesJoined },
    { id: 't9-gift', tier: 9, tierLabel: 'T9', week: 2, title: 'Send 40 gifts', description: 'Drop 40 total gifts in live broadcasts this week.', target: 40, rewardXp: 60000, rewardCoins: 10, progressSource: P.gifts },
    { id: 't9-wins-3', tier: 9, tierLabel: 'T9', week: 3, title: 'Win 50 battles', description: 'Win 50 battles this week.', target: 50, rewardXp: 90000, rewardCoins: 10, progressSource: P.battlesWon },
    { id: 't9-xp-2', tier: 9, tierLabel: 'T9', week: 3, title: 'Earn 75,000 XP', description: 'Stack 75,000 XP of honest Mai Troll activity.', target: 75000, rewardXp: 80000, rewardCoins: 10, progressSource: P.xp },
    { id: 't9-family', tier: 9, tierLabel: 'T9', week: 3, title: 'Earn 5,000 family/agency points', description: 'Bank 5,000 points toward your family or agency score.', target: 5000, rewardXp: 75000, rewardCoins: 10, progressSource: P.family },
    { id: 't9-daily', tier: 9, tierLabel: 'T9', week: 4, title: 'Complete 8 daily missions', description: 'Finish 8 daily missions this week.', target: 8, rewardXp: 60000, rewardCoins: 10, progressSource: P.streak },
    { id: 't9-battles-2', tier: 9, tierLabel: 'T9', week: 4, title: 'Complete 75 battles', description: 'Finish 75 battles of any type this week.', target: 75, rewardXp: 85000, rewardCoins: 10, progressSource: P.battlesJoined },
    { id: 't9-gift-2', tier: 9, tierLabel: 'T9', week: 4, title: 'Send 50 gifts', description: 'Drop 50 total gifts in live broadcasts this week.', target: 50, rewardXp: 75000, rewardCoins: 10, progressSource: P.gifts },
    { id: 't9-streak', tier: 9, tierLabel: 'T9', week: 4, title: 'Log in 7 days this week', description: 'Open Mai Troll every day this week.', target: 7, rewardXp: 50000, rewardCoins: 10, progressSource: P.streak },
    { id: 't9-watch', tier: 9, tierLabel: 'T9', week: 4, title: 'Watch 180 minutes live', description: 'Hit 3 hours of live viewing this week.', target: 180, rewardXp: 70000, rewardCoins: 10, progressSource: P.broadcastMin },
    { id: 't9-xp-3', tier: 9, tierLabel: 'T9', week: 4, title: 'Earn 100,000 XP', description: 'Stack 100,000 XP of honest Mai Troll activity.', target: 100000, rewardXp: 100000, rewardCoins: 10, progressSource: P.xp },
  ],
  10: [
    { id: 't10-rank', tier: 10, tierLabel: 'T10', week: 1, title: 'Maintain top 10 rank', description: 'Stay inside the top 10 during the season window.', target: 1, rewardXp: 100000, rewardCoins: 10, progressSource: P.rank },
    { id: 't10-season', tier: 10, tierLabel: 'T10', week: 1, title: 'Complete 1 seasonal goal', description: 'Help complete one seasonal goal objective.', target: 1, rewardXp: 120000, rewardCoins: 10, progressSource: P.reactions },
    { id: 't10-war', tier: 10, tierLabel: 'T10', week: 1, title: 'Help family/agency win 1 war season', description: 'Contribute to a family or agency war-season victory.', target: 1, rewardXp: 150000, rewardCoins: 10, progressSource: P.family },
    { id: 't10-rank-2', tier: 10, tierLabel: 'T10', week: 2, title: 'Maintain top 5 rank', description: 'Stay inside the top 5 during the season window.', target: 1, rewardXp: 130000, rewardCoins: 10, progressSource: P.rank },
    { id: 't10-battles', tier: 10, tierLabel: 'T10', week: 2, title: 'Complete 100 battles', description: 'Finish 100 battles of any type this week.', target: 100, rewardXp: 120000, rewardCoins: 10, progressSource: P.battlesJoined },
    { id: 't10-gift', tier: 10, tierLabel: 'T10', week: 2, title: 'Send 75 gifts', description: 'Drop 75 total gifts in live broadcasts this week.', target: 75, rewardXp: 110000, rewardCoins: 10, progressSource: P.gifts },
    { id: 't10-rank-3', tier: 10, tierLabel: 'T10', week: 3, title: 'Maintain top 3 rank', description: 'Stay inside the top 3 during the season window.', target: 1, rewardXp: 160000, rewardCoins: 10, progressSource: P.rank },
    { id: 't10-xp', tier: 10, tierLabel: 'T10', week: 3, title: 'Earn 150,000 XP', description: 'Stack 150,000 XP of honest Mai Troll activity.', target: 150000, rewardXp: 140000, rewardCoins: 10, progressSource: P.xp },
    { id: 't10-family', tier: 10, tierLabel: 'T10', week: 3, title: 'Earn 10,000 family/agency points', description: 'Bank 10,000 points toward your family or agency score.', target: 10000, rewardXp: 130000, rewardCoins: 10, progressSource: P.family },
    { id: 't10-daily', tier: 10, tierLabel: 'T10', week: 4, title: 'Complete 10 daily missions', description: 'Finish 10 daily missions this week.', target: 10, rewardXp: 120000, rewardCoins: 10, progressSource: P.streak },
    { id: 't10-battles-2', tier: 10, tierLabel: 'T10', week: 4, title: 'Complete 150 battles', description: 'Finish 150 battles of any type this week.', target: 150, rewardXp: 160000, rewardCoins: 10, progressSource: P.battlesJoined },
    { id: 't10-gift-2', tier: 10, tierLabel: 'T10', week: 4, title: 'Send 100 gifts', description: 'Drop 100 total gifts in live broadcasts this week.', target: 100, rewardXp: 140000, rewardCoins: 10, progressSource: P.gifts },
    { id: 't10-streak', tier: 10, tierLabel: 'T10', week: 4, title: 'Log in 7 days this week', description: 'Open Mai Troll every day this week.', target: 7, rewardXp: 100000, rewardCoins: 10, progressSource: P.streak },
    { id: 't10-watch', tier: 10, tierLabel: 'T10', week: 4, title: 'Watch 240 minutes live', description: 'Hit 4 hours of live viewing this week.', target: 240, rewardXp: 130000, rewardCoins: 10, progressSource: P.broadcastMin },
    { id: 't10-season-2', tier: 10, tierLabel: 'T10', week: 4, title: 'Complete 2 seasonal goals', description: 'Help complete 2 seasonal goal objectives.', target: 2, rewardXp: 180000, rewardCoins: 10, progressSource: P.reactions },
  ],
}

export const getCurrentWeek = (): number => {
  const now = new Date()
  return Math.min(4, Math.max(1, Math.ceil(now.getDate() / 7)))
}

export const getCycleKey = (): string => {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

export const getTierFromXp = (xp: number): number => {
  const safeXp = Math.max(0, Number(xp) || 0)
  let currentTier = 0
  for (const threshold of TIER_THRESHOLDS) {
    if (safeXp >= threshold.xpRequired) {
      currentTier = threshold.tier
    } else {
      break
    }
  }
  return currentTier
}

export const getTierInfo = (tier: number): TierThreshold => {
  const safeTier = Math.min(10, Math.max(0, Math.floor(Number(tier) || 0)))
  return TIER_THRESHOLDS[safeTier] ?? TIER_THRESHOLDS[0]
}

export const getNextTier = (tier: number): TierThreshold | null => {
  const next = Math.min(10, Math.floor(Number(tier) || 0) + 1)
  if (next > 10) return null
  return TIER_THRESHOLDS[next] ?? null
}

export const getTierProgress = (xp: number) => {
  const safeXp = Math.max(0, Number(xp) || 0)
  const tier = getTierFromXp(safeXp)
  const current = getTierInfo(tier)
  const next = getNextTier(tier)

  if (!next) {
    return {
      tier,
      currentXp: safeXp,
      xpForCurrentTier: current.xpRequired,
      xpForNextTier: current.xpRequired,
      xpIntoTier: 0,
      xpNeededForNextTier: 0,
      progressPercent: 100,
      isMaxTier: true,
    }
  }

  const xpIntoTier = Math.max(0, safeXp - current.xpRequired)
  const span = Math.max(1, next.xpRequired - current.xpRequired)
  const progress = Math.min(100, Math.max(0, Math.round((xpIntoTier / span) * 100)))

  return {
    tier,
    currentXp: safeXp,
    xpForCurrentTier: current.xpRequired,
    xpForNextTier: next.xpRequired,
    xpIntoTier,
    xpNeededForNextTier: Math.max(0, next.xpRequired - safeXp),
    progressPercent: progress,
    isMaxTier: false,
  }
}

export const formatTierLabel = (tier: number): string => {
  const info = getTierInfo(tier)
  return `${info.shortLabel} · ${info.name}`
}

export const getTierTasks = (
  tier: number,
  cycleKey: string,
  week: number,
  snapshot: TaskProgressSnapshot,
  existingMissions: Record<string, { current_value?: number; status?: string }> = {},
): LeagueTask[] => {
  const safeTier = Math.min(10, Math.max(0, Math.floor(Number(tier) || 0)))
  const tasks: LeagueTask[] = []

  const tierTasks = TIER_TASK_TEMPLATES[safeTier] ?? []
  for (const template of tierTasks) {
    const existing = existingMissions[template.id]
    let status: LeagueTask['status'] = 'active'
    if (existing?.status === 'completed') {
      status = 'completed'
    } else if (existing?.status === 'claimed') {
      status = 'claimed'
    }
    if (template.week > week) {
      status = 'locked'
    }
    const snapValue = getTaskProgressValue(template.progressSource, snapshot)
    const current = Math.min(template.target, snapValue)
    if (status === 'active' && current >= template.target) {
      status = 'completed'
    }
    tasks.push({
      ...template,
      cycleKey,
      current,
      status,
    })
  }

  const lockedTiers = TIER_THRESHOLDS.filter((threshold) => threshold.tier > safeTier)
  for (const locked of lockedTiers) {
    const lockedTasks = TIER_TASK_TEMPLATES[locked.tier] ?? []
    for (const template of lockedTasks) {
      tasks.push({
        ...template,
        cycleKey,
        current: 0,
        status: 'locked',
      })
    }
  }

  return tasks
}

export const formatMissionProgress = (mission: LeagueMission) => {
  const progress = mission.target_value > 0
    ? Math.min(100, Math.round((mission.current_value / mission.target_value) * 100))
    : 0

  return {
    label: `${mission.current_value}/${mission.target_value}`,
    percent: progress,
  }
}

export const getMissionTone = (status: LeagueMissionStatus) => {
  switch (status) {
    case 'completed':
      return 'bg-emerald-500/15 text-emerald-200 ring-emerald-500/20'
    case 'claimed':
      return 'bg-slate-700/60 text-slate-200'
    case 'expired':
      return 'bg-rose-500/15 text-rose-200'
    default:
      return 'bg-cyan-500/10 text-cyan-200'
  }
}
