export { 
  type UserProfile,
  type Stream,
  type Message as ChatMessage,
  type CoinTransaction,
  type CoinPackage,
  type CashoutTier,
  type InsurancePackage,
  type SystemError,
  type UserTier,
  type StreamStatus,
  type TransactionType,
  type UserRole,
  type Permission,
  ROLE_PERMISSIONS,
  hasPermission,
  hasRole,
  supabase,
  doesUserProfileExist,
  ADMIN_EMAIL,
  isAdminEmail,
  isStaffEmail,
  isCEOEmail,
  PLATFORM_OPTIONS,
  type Platform,
} from '../lib/supabase'

export interface Tip {
  id: string
  user_id: string
  creator_id: string
  amount: number
  message?: string
  created_at: string
}

export interface Profile {
  id: string
  username: string
  avatar_url?: string
  email?: string
  role: string
  bio?: string
  created_at: string
}

export interface CreatorProfile {
  id: string
  user_id: string
  username: string
  display_name?: string
  avatar_url?: string
  bio?: string
  created_at: string
}

export interface TipPackage {
  id: string
  name: string
  amount: number
  price: number
  tip_amount?: number
  bonus_amount?: number
  price_cents?: number
  is_active: boolean
}
