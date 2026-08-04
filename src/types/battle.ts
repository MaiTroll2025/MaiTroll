export type BattleEventType = 'triple_points' | 'turtle_mode' | 'turbo_mode' | 'glow_mode' | 'ceo_mode';

export type BattleEventStatus = 'scheduled' | 'active' | 'expired' | 'cancelled';

export type BattleEventTeam = 'challenger' | 'opponent' | 'both';

export interface BattleRandomEvent {
  id: string;
  battle_id: string;
  event_type: BattleEventType;
  status: BattleEventStatus;
  starts_at: string;
  ends_at: string;
  duration_seconds: number;
  affected_team: BattleEventTeam | null;
  affected_host_id: string | null;
  multiplier: number;
  minimum_paid_gift: number;
  metadata: Record<string, any>;
  created_at: string;
}

export interface BattleEventDisplayConfig {
  type: BattleEventType;
  label: string;
  icon: string;
  color: string;
  bgGradient: string;
  borderColor: string;
  description: string;
  durationLabel: string;
}

export const BATTLE_EVENT_CONFIGS: Record<BattleEventType, BattleEventDisplayConfig> = {
  triple_points: {
    type: 'triple_points',
    label: 'TRIPLE POINTS',
    icon: '⚡',
    color: 'text-yellow-400',
    bgGradient: 'from-yellow-600/20 via-amber-600/10 to-orange-600/20',
    borderColor: 'border-yellow-500/50',
    description: 'All battle points are tripled! Paid coins still cash out normally.',
    durationLabel: '60 seconds',
  },
  turtle_mode: {
    type: 'turtle_mode',
    label: 'TURTLE MODE',
    icon: '🐢',
    color: 'text-green-400',
    bgGradient: 'from-green-600/20 via-emerald-600/10 to-teal-600/20',
    borderColor: 'border-green-500/50',
    description: 'The battle timer slows down! Only 15 seconds removed per 30 real seconds.',
    durationLabel: '30 seconds',
  },
  turbo_mode: {
    type: 'turbo_mode',
    label: 'TURBO MODE',
    icon: '🚀',
    color: 'text-red-400',
    bgGradient: 'from-red-600/20 via-orange-600/10 to-pink-600/20',
    borderColor: 'border-red-500/50',
    description: 'The battle timer speeds up! 60 seconds removed per 30 real seconds.',
    durationLabel: '30 seconds',
  },
  glow_mode: {
    type: 'glow_mode',
    label: 'GLOW MODE',
    icon: '✨',
    color: 'text-purple-400',
    bgGradient: 'from-purple-600/20 via-violet-600/10 to-fuchsia-600/20',
    borderColor: 'border-purple-500/50',
    description: 'Send 1,000+ paid coins and BOTH hosts get double free bonus coins!',
    durationLabel: '45 seconds',
  },
  ceo_mode: {
    type: 'ceo_mode',
    label: 'CEO MODE',
    icon: '👑',
    color: 'text-blue-400',
    bgGradient: 'from-blue-600/20 via-indigo-600/10 to-cyan-600/20',
    borderColor: 'border-blue-500/50',
    description: 'One host gift vault is locked for 10 seconds! The other host is open.',
    durationLabel: '10 seconds',
  },
};

export function getEventConfig(eventType: BattleEventType): BattleEventDisplayConfig {
  return BATTLE_EVENT_CONFIGS[eventType];
}