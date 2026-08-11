import { createClient } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://yjxpwfalenorzrqxwmtr.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlqeHB3ZmFsZW5vcnpycXh3bXRyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQwMjkxMTcsImV4cCI6MjA3OTYwNTExN30.S5Vc1xpZoZ0aemtNFJGcPhL_zvgPA0qgZq8e8KigUx8'

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    // Removed flowType: 'pkce' - it causes session issues when tabs are backgrounded
    // and doesn't work well with autoRefreshToken in background tabs
    // Using default implicit flow which handles background refresh better
  },
  realtime: {
    params: {
      eventsPerSecond: 50,
    },
  },
})

const supabaseRealtimeDebug = {
  created: 0,
  removed: 0,
  active: 0,
  activeChannels: new Set<string>(),
}

// Wrap channel creation / removal to track active Supabase realtime channel usage.
const originalChannel = (supabase.channel as any).bind(supabase)
const originalRemoveChannel = (supabase.removeChannel as any).bind(supabase)
const originalRemoveAllChannels = (supabase.removeAllChannels as any)?.bind(supabase)

;(supabase as any).channel = (...args: any[]) => {
  try {
    const identifier = typeof args[0] === 'string' ? args[0] : JSON.stringify(args[0])
    supabaseRealtimeDebug.created += 1
    supabaseRealtimeDebug.active += 1
    supabaseRealtimeDebug.activeChannels.add(identifier)
    if (typeof window !== 'undefined' && (window as any).DEBUG_COUNTERS) {
      const debug = (window as any).DEBUG_COUNTERS
      debug.supabaseChannelCreatedCount = (debug.supabaseChannelCreatedCount || 0) + 1
      debug.supabaseChannelActiveCount = supabaseRealtimeDebug.active
    }
  } catch (err) {
    console.warn('[supabase] Failed to track channel creation', err)
  }
  return originalChannel(...args)
}

;(supabase as any).removeChannel = (channel: any) => {
  try {
    const identifier = channel?.topic || channel?.name || channel?.id || String(channel)
    supabaseRealtimeDebug.removed += 1
    supabaseRealtimeDebug.active = Math.max(0, supabaseRealtimeDebug.active - 1)
    if (identifier) {
      supabaseRealtimeDebug.activeChannels.delete(identifier)
    }
    if (typeof window !== 'undefined' && (window as any).DEBUG_COUNTERS) {
      const debug = (window as any).DEBUG_COUNTERS
      debug.supabaseChannelRemovedCount = (debug.supabaseChannelRemovedCount || 0) + 1
      debug.supabaseChannelActiveCount = supabaseRealtimeDebug.active
    }
  } catch (err) {
    console.warn('[supabase] Failed to track channel removal', err)
  }
  return originalRemoveChannel(channel)
}

if (originalRemoveAllChannels) {
  ;(supabase as any).removeAllChannels = () => {
    const result = originalRemoveAllChannels()
    supabaseRealtimeDebug.active = 0
    supabaseRealtimeDebug.activeChannels.clear()
    return result
  }
}

export const supabaseRealtimeCounters = {
  get created() {
    return supabaseRealtimeDebug.created
  },
  get removed() {
    return supabaseRealtimeDebug.removed
  },
  get active() {
    return supabaseRealtimeDebug.active
  },
  get activeChannels() {
    return Array.from(supabaseRealtimeDebug.activeChannels)
  },
}

export async function doesUserProfileExist(userId: string): Promise<boolean> {
  if (!userId) {
    return false
  }

  const { data, error } = await supabase
    .from('user_profiles')
    .select('id')
    .eq('id', userId)
    .maybeSingle()

  return !error && !!data?.id
}

if (typeof window !== 'undefined' && import.meta.env.DEV) {
  ;(window as any).__MaiTroll_SUPABASE_REALTIME_DEBUG__ = {
    get created() {
      return supabaseRealtimeCounters.created
    },
    get removed() {
      return supabaseRealtimeCounters.removed
    },
    get active() {
      return supabaseRealtimeCounters.active
    },
    get activeChannels() {
      return supabaseRealtimeCounters.activeChannels
    },
  }
}

export type UserTier = string // Now dynamic based on XP
export type StreamStatus = 'live' | 'ended'
export type TransactionType = 'purchase' | 'gift' | 'spin' | 'insurance' | 'cashout'

export const PLATFORM_OPTIONS = [
  { value: 'MaiTroll', label: 'MaiTroll', color: '#a855f7', icon: '🏙️' },
  { value: 'tiktok', label: 'TikTok', color: '#00f2ea', icon: '🎵' },
  { value: 'liveme', label: 'LiveMe', color: '#ff4d4f', icon: '📺' },
  { value: 'bigo', label: 'Bigo Live', color: '#f59e0b', icon: '🎥' },
  { value: 'favortied', label: 'Favortied', color: '#10b981', icon: '⭐' },
] as const;

export type Platform = typeof PLATFORM_OPTIONS[number]['value'];

export interface UserProfile {
  trollmonds: number
    display_name: string
  name: string
  is_agency_hr: boolean
  is_agency_hr_manager: any
  is_superadmin: boolean
  id: string
  username: string
  avatar_url: string
  banner_url?: string | null
  full_name?: string | null
  bio: string
  platform?: Platform | null
  email?: string
  role: UserRole
  tier: UserTier
  xp: number // Total XP points
  level: number // Calculated from XP
  total_xp?: number // Synced from user_levels table
  next_level_xp?: number // Synced from user_levels table
  prestige_level?: number
  perk_tokens?: number
  xp_multiplier?: number
  coin_multiplier?: number
  troll_coins: number
  hype_coins: number
  cashout_coins?: number
  cashout_reserved_coins?: number
  reserved_troll_coins?: number
  has_paid?: boolean
  total_earned_coins: number
  total_spent_coins: number
  insurance_level: string | null
  insurance_expires_at: string | null
  rgb_username_expires_at?: string | null
  glowing_username_color?: string | null
  username_style?: string | null // 'gold', etc.
  is_gold?: boolean
  no_kick_until: string | null
  no_ban_until: string | null
  mic_muted_until?: string | null
  muted_until?: string | null
  broadcast_chat_disabled?: boolean
  broadcast_mic_muted?: boolean
  live_restricted_until?: string | null
  ban_expires_at?: string | null
  has_active_warrant?: boolean
  terms_accepted?: boolean
  badge?: string | null
  title?: string | null
  has_insurance?: boolean
  multiplier_active?: boolean
  multiplier_value?: number
  multiplier_expires?: string | null
  created_at: string
  updated_at: string

  payment_methods?: Array<any>
  payout_method?: string
  payout_details?: string

  // Officer fields
  is_troll_officer?: boolean
  is_officer_active?: boolean
  is_lead_officer?: boolean
  is_pastor?: boolean
  officer_role?: string | null // 'lead_officer', 'owner', or null
  officer_level?: number // 1=Junior, 2=Senior, 3=Commander, 4=Elite Commander, 5=HQ Master
  officer_tier_badge?: string // 'blue', 'orange', 'red', 'purple', 'gold'
  officer_rank?: string | null
  assigned_zip_count?: number
  
  // Unified Role
  troll_role?: string | null
  
  // Officer Work Credit (OWC) fields
  owc_balance?: number // Current OWC balance
  total_owc_earned?: number // Lifetime OWC earned

  // Admin field
  is_admin?: boolean
  // TrollTract fields
  is_trolltract?: boolean
  trolltract_activated_at?: string | null

  // Credit Card fields
  credit_limit?: number
  credit_used?: number
  credit_apr_fee_percent?: number
  credit_status?: string

  // Profile Costs
  
  // Age system
  age_days?: number

  // Troller fields
  is_troller?: boolean

   // Notifications
   banner_notifications_enabled?: boolean
   church_notifications_enabled?: boolean
   announcements_enabled?: boolean
   push_notifications_enabled?: boolean
   credit_score?: number
  troller_level?: number // 1=Basic Troller, 2=Chaos Agent, 3=Supreme Troll

  onboarding_completed?: boolean

  // OG User field
  is_og_user?: boolean

  // Language preference
  preferred_language?: string // 'en', 'es', 'ar', 'fr', 'fil', etc.

  // Onboarding / W9 fields
  legal_full_name?: string
  date_of_birth?: string
  country?: string
  address_line1?: string
  address_line2?: string
  city?: string
  state_region?: string
  postal_code?: string
  tax_id_last4?: string
  tax_classification?: 'individual' | 'business'
  w9_status?: 'pending' | 'submitted' | 'verified' | 'rejected'

  // Kick/Ban fields
  kick_count?: number
  is_kicked?: boolean
  kicked_until?: string | null
  account_deleted_at?: string | null
  account_deletion_cooldown_until?: string | null
  account_reset_after_ban?: boolean

  // Square Card on File
  square_customer_id?: string | null
  square_card_id?: string | null
  card_brand?: string | null
  card_last4?: string | null
  card_exp_month?: number | null
  card_exp_year?: number | null

  // Mai Troll Saved Card (encrypted locally, hidden from everyone including admin)
  encrypted_card_data?: string | null

  // Empire Partner
  empire_role?: string | null // 'partner' when approved as Empire Partner
  empire_partner?: boolean // New field for partner status
  is_empire_partner?: boolean
  is_president?: boolean
  partner_status?: string | null // 'approved', 'pending', 'rejected'

  // Moderation fields
  is_banned?: boolean
  is_officer?: boolean

  // Verification fields
  is_verified?: boolean
  verification_date?: string | null
  verification_paid_amount?: number | null
  verification_payment_method?: string | null
  is_trolls_night_approved?: boolean
  trolls_night_rejection_count?: number
  // date_of_birth removed (duplicate)

  // Officer reputation
  officer_reputation_score?: number

  // Ghost mode
  is_ghost_mode?: boolean

  // PayPal payout
  payout_paypal_email?: string | null

  // Broadcaster field
  is_broadcaster?: boolean

  // Staff role fields
  is_ceo?: boolean
  is_secretary?: boolean
  is_prosecutor?: boolean
  is_judge?: boolean
  is_attorney?: boolean
  is_auctioneer?: boolean

  // Profile view price
  profile_view_price?: number

  // Cover photo URL
  cover_url?: string | null

  // Application fields
  court_recording_consent?: boolean
  application_required?: boolean
  application_submitted?: boolean
  
  tax_status?: string
  tax_last_updated?: string
  tax_form_url?: string

  password_reset_pin_hash?: string | null
  password_reset_pin_set_at?: string | null

  // Vehicle fields
  // DB may store UUID of user_cars row; UI may use numeric model id
  active_vehicle?: string | number | null
  vehicle_image?: string | null // Static image URL
  owned_vehicle_ids?: number[] | null
  gender?: string | null

  // Neighborhood / HouseSystem fields
  neighborhood_id?: string | null
  house_id?: string | null
  vehicle_id?: string | null
  license_id?: string | null
  troll_avatar_url?: string | null
  drivers_test_passed?: boolean
  driver_test_passed_at?: string | null
  insurance_required?: boolean
  license_status?: 'none' | 'active' | 'suspended' | 'expired' | string
  homeowners_insurance_expiry?: string | null
  car_insurance_expiry?: string | null

  // License plate (display on profile)
  license_plate?: string | null

  // Organization
  organization_id?: string | null

  // TMV System
  drivers_license_status?: 'none' | 'active' | 'suspended' | 'expired' | string
  drivers_license_expiry?: string | null
  gas_balance?: number
  last_gas_update?: string | null
  message_cost?: number;
  profile_view_cost?: number;
  temp_admin_coins_balance?: number;
  bypass_broadcast_restriction?: boolean;
  phone?: string;
  id_verification_status?: string;

  // Wheel fields
  wheel_balance?: number;
  wheel_troll_locked_until?: string | null;

  // TM (Troll Match) System fields
  interests?: string[];
  dating_enabled?: boolean;
  preference?: string[];
  message_price?: number;
  last_active?: string | null;
}


export interface Stream {
  id: string
  broadcaster_id: string
  title: string
  category?: string
  status: StreamStatus
  start_time: string
  end_time: string | null
  current_viewers: number
   total_gifts_coins: number
   total_unique_gifters: number
   stream_channel: string // LiveKit room name (database column 'agora_channel')
   livekit_token: string | null // Database column 'agora_token'
   multi_beam?: boolean
   thumbnail_url?: string | null
   is_live?: boolean
   created_at: string
   updated_at: string
}

export interface Message {
  id: string
  stream_id: string
  user_id: string
  content: string
  message_type: 'chat' | 'gift' | 'entrance'
  gift_amount: number | null
  created_at: string
}

export interface Conversation {
  id: string
  created_at: string
  created_by: string
  is_group?: boolean
  name?: string | null
  group_avatar_url?: string | null
}

export interface ConversationMember {
  conversation_id: string
  user_id: string
  role?: string | null
  joined_at: string
}

export interface ConversationMessage {
  id: string
  conversation_id: string
  sender_id: string
  body: string
  created_at: string
  read_at?: string | null
}

export interface MessageReceipt {
  id: string
  message_id: string
  user_id: string
  status?: string | null
  delivered_at?: string | null
  read_at?: string | null
  created_at: string
}

export interface CoinTransaction {
  id: string
  user_id: string
  type: TransactionType
  amount: number
  description: string
  metadata: Record<string, any>
  created_at: string
}

export interface CoinPackage {
  id: string
  name: string
  coin_amount: number
  price: number
  currency: string
  description: string
  is_active: boolean
  created_at: string
}

export interface CashoutTier {
  id: string
  coin_amount: number
  cash_amount: number
  currency: string
  processing_fee_percentage: number   // ← Correct and consistent
  is_active: boolean
  created_at: string
  updated_at: string
}


export interface InsurancePackage {
  id: string
  name: string
  level: string
  cost: number
  duration_days: number
  benefits: string[]
  is_active: boolean
}

export interface SystemError {
  id: string
  user_id?: string | null
  message: string
  stack?: string | null
  component?: string | null
  url?: string | null
  status: 'open' | 'resolved' | 'investigating'
  admin_response?: string | null
  created_at: string
  responded_at?: string | null
}

const appEnv = import.meta.env as ImportMetaEnv

export const ADMIN_EMAIL = appEnv.VITE_ADMIN_EMAIL || 'trollcity2025@gmail.com'

// Production-ready admin email validation with additional security checks
export const isAdminEmail = (email?: string): boolean => {
  if (!email) return false
  
  const cleanEmail = String(email).trim().toLowerCase()
  const adminEmail = String(ADMIN_EMAIL).trim().toLowerCase()
  
  // Exact match validation
  return cleanEmail === adminEmail
}

// Staff email validation - check against allowed staff emails list
const rawStaffEmails = appEnv.VITE_STAFF_EMAILS
export const ALLOWED_STAFF_EMAILS = rawStaffEmails
  ? String(rawStaffEmails).split(',').map((e: string) => e.trim().toLowerCase()).filter(Boolean)
  : []

export const isStaffEmail = (email?: string): boolean => {
  if (!email) return false
  const cleanEmail = String(email).trim().toLowerCase()
  return ALLOWED_STAFF_EMAILS.includes(cleanEmail)
}

// CEO email validation
export const ALLOWED_CEO_EMAIL = appEnv.VITE_CEO_EMAIL
  ? appEnv.VITE_CEO_EMAIL.trim().toLowerCase()
  : ''

export const isCEOEmail = (email?: string): boolean => {
  if (!email) return false
  const cleanEmail = String(email).trim().toLowerCase()
  return cleanEmail === ALLOWED_CEO_EMAIL
}

// Role hierarchy and permissions management
export enum UserRole {
  USER = 'user',
  MODERATOR = 'moderator',
  ADMIN = 'admin',
  OWNER = 'owner',
  AGENCY_HR_MANAGER = 'agency_hr_manager',
  HR_ADMIN = 'hr_admin',
  HR_MANAGER = 'hr_manager',
  LEAD_TROLL_OFFICER = 'lead_troll_officer',
  TROLL_OFFICER = 'troll_officer',
  TROLL_FAMILY = 'troll_family',
  TROLLER = 'troller',
  EMPIRE_PARTNER = 'empire_partner',
  SECRETARY = 'secretary',
  PRESIDENT = 'president',
  VICE_PRESIDENT = 'vice_president',
  TEMP_CITY_ADMIN = 'temp_city_admin',
  TROLL_CITY_SECRETARY = 'troll_city_secretary',
  TROLL_CITY_TREASURER = 'troll_city_treasurer',
  TEMP_ADMIN = 'temp_admin',
  EXECUTIVE_SECRETARY = 'executive_secretary',
  MARKETING_READONLY = 'marketing_readonly',
  SUPERADMIN = 'superadmin',
  CEO = 'ceo',
  ACADEMY_TEACHER = 'academy_teacher',
  ACADEMY_STUDENT = 'academy_student',
  ACADEMY_DIRECTOR = 'academy_director',
  ADMISSIONS_OFFICER = 'admissions_officer',
  PASTOR = 'pastor',
  AGENCY_LEADER = 'agency_leader',
  ATTORNEY = 'attorney',
  PROSECUTOR = 'prosecutor',
  JOURNALIST = 'journalist',
  AUCTIONEER = 'auctioneer',
  CEO_ASSISTANT = 'ceo_assistant',
  NOAH_ASSISTANT = 'noah_assistant',
}

export enum Permission {
  // Admin permissions
  MANAGE_USERS = 'manage_users',
  MANAGE_CONTENT = 'manage_content',
  MANAGE_FINANCES = 'manage_finances',
  MANAGE_SYSTEM = 'manage_system',
  
  // Officer permissions
  MODERATE_CHAT = 'moderate_chat',
  MODERATE_STREAMS = 'moderate_streams',
  MANAGE_REPORTS = 'manage_reports',
  ISSUE_WARNINGS = 'issue_warnings',
  
  // Content permissions
  BROADCAST = 'broadcast',
  CREATE_CONTENT = 'create_content',
  MONETIZE = 'monetize',
  
  // Read-only permissions
  VIEW_ONLY = 'view_only'
}

// Role-based permission mapping
export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  [UserRole.USER]: [
    Permission.BROADCAST,
    Permission.CREATE_CONTENT,
    Permission.MONETIZE
  ],
  [UserRole.MODERATOR]: [
    Permission.BROADCAST,
    Permission.CREATE_CONTENT,
    Permission.MONETIZE,
    Permission.MODERATE_CHAT,
    Permission.MODERATE_STREAMS,
    Permission.MANAGE_REPORTS,
    Permission.ISSUE_WARNINGS
  ],
  [UserRole.TROLL_OFFICER]: [
    Permission.BROADCAST,
    Permission.CREATE_CONTENT,
    Permission.MONETIZE,
    Permission.MODERATE_CHAT,
    Permission.MODERATE_STREAMS,
    Permission.MANAGE_REPORTS,
    Permission.ISSUE_WARNINGS
  ],
  [UserRole.LEAD_TROLL_OFFICER]: [
    Permission.BROADCAST,
    Permission.CREATE_CONTENT,
    Permission.MONETIZE,
    Permission.MODERATE_CHAT,
    Permission.MODERATE_STREAMS,
    Permission.MANAGE_REPORTS,
    Permission.ISSUE_WARNINGS,
    Permission.MANAGE_USERS
  ],
  [UserRole.TROLL_FAMILY]: [
    Permission.BROADCAST,
    Permission.CREATE_CONTENT,
    Permission.MONETIZE
  ],
  [UserRole.TROLLER]: [
    Permission.BROADCAST,
    Permission.CREATE_CONTENT
  ],
  [UserRole.EMPIRE_PARTNER]: [
    Permission.BROADCAST,
    Permission.CREATE_CONTENT,
    Permission.MONETIZE
  ],
  [UserRole.PRESIDENT]: [
    Permission.MANAGE_USERS,
    Permission.MANAGE_CONTENT,
    Permission.MANAGE_FINANCES,
    Permission.MANAGE_SYSTEM,
    Permission.MODERATE_CHAT,
    Permission.MODERATE_STREAMS,
    Permission.MANAGE_REPORTS,
    Permission.ISSUE_WARNINGS,
    Permission.BROADCAST,
    Permission.CREATE_CONTENT,
    Permission.MONETIZE
  ],
  [UserRole.VICE_PRESIDENT]: [
    Permission.MANAGE_USERS,
    Permission.MANAGE_CONTENT,
    Permission.MANAGE_FINANCES,
    Permission.MANAGE_SYSTEM,
    Permission.MODERATE_CHAT,
    Permission.MODERATE_STREAMS,
    Permission.MANAGE_REPORTS,
    Permission.ISSUE_WARNINGS,
    Permission.BROADCAST,
    Permission.CREATE_CONTENT,
    Permission.MONETIZE
  ],
  [UserRole.SECRETARY]: [
    Permission.MANAGE_FINANCES,
    Permission.MANAGE_REPORTS,
    Permission.MANAGE_SYSTEM,
    Permission.BROADCAST,
    Permission.CREATE_CONTENT,
    Permission.MONETIZE
  ],
  [UserRole.HR_ADMIN]: [
    // HR Admin has user management permissions
    Permission.MANAGE_USERS,
    Permission.MODERATE_CHAT,
    Permission.MODERATE_STREAMS,
    Permission.MANAGE_REPORTS,
    Permission.ISSUE_WARNINGS,
    Permission.BROADCAST,
    Permission.CREATE_CONTENT,
    Permission.MONETIZE
  ],
  [UserRole.AGENCY_HR_MANAGER]: [
    Permission.MANAGE_USERS,
    Permission.MODERATE_CHAT,
    Permission.MODERATE_STREAMS,
    Permission.MANAGE_REPORTS,
    Permission.ISSUE_WARNINGS,
    Permission.BROADCAST,
    Permission.CREATE_CONTENT,
    Permission.MONETIZE
  ],
  [UserRole.TEMP_CITY_ADMIN]: [
    Permission.MANAGE_USERS,
    Permission.MANAGE_CONTENT,
    Permission.MANAGE_FINANCES,
    Permission.MANAGE_SYSTEM,
    Permission.MODERATE_CHAT,
    Permission.MODERATE_STREAMS,
    Permission.MANAGE_REPORTS,
    Permission.ISSUE_WARNINGS,
    Permission.BROADCAST,
    Permission.CREATE_CONTENT,
    Permission.MONETIZE
  ],
  [UserRole.OWNER]: [
    Permission.MANAGE_USERS,
    Permission.MANAGE_CONTENT,
    Permission.MANAGE_FINANCES,
    Permission.MANAGE_SYSTEM,
    Permission.MODERATE_CHAT,
    Permission.MODERATE_STREAMS,
    Permission.MANAGE_REPORTS,
    Permission.ISSUE_WARNINGS,
    Permission.BROADCAST,
    Permission.CREATE_CONTENT,
    Permission.MONETIZE
  ],
  [UserRole.TROLL_CITY_SECRETARY]: [
    Permission.MANAGE_FINANCES,
    Permission.MANAGE_REPORTS,
    Permission.MANAGE_SYSTEM,
    Permission.BROADCAST,
    Permission.CREATE_CONTENT,
    Permission.MONETIZE
  ],
  [UserRole.TROLL_CITY_TREASURER]: [
    Permission.MANAGE_FINANCES,
    Permission.MANAGE_REPORTS,
    Permission.MANAGE_SYSTEM,
    Permission.BROADCAST,
    Permission.CREATE_CONTENT,
    Permission.MONETIZE
  ],
  [UserRole.TEMP_ADMIN]: [
    Permission.MANAGE_USERS,
    Permission.MODERATE_CHAT,
    Permission.MODERATE_STREAMS,
    Permission.MANAGE_REPORTS,
    Permission.ISSUE_WARNINGS,
    Permission.BROADCAST,
    Permission.CREATE_CONTENT,
    Permission.MONETIZE
  ],
  [UserRole.EXECUTIVE_SECRETARY]: [
    Permission.MANAGE_FINANCES,
    Permission.MANAGE_REPORTS,
    Permission.MANAGE_SYSTEM,
    Permission.BROADCAST,
    Permission.CREATE_CONTENT,
    Permission.MONETIZE
  ],
  [UserRole.ADMIN]: [
    // Admin has all permissions
    Permission.MANAGE_USERS,
    Permission.MANAGE_CONTENT,
    Permission.MANAGE_FINANCES,
    Permission.MANAGE_SYSTEM,
    Permission.MODERATE_CHAT,
    Permission.MODERATE_STREAMS,
    Permission.MANAGE_REPORTS,
    Permission.ISSUE_WARNINGS,
    Permission.BROADCAST,
    Permission.CREATE_CONTENT,
    Permission.MONETIZE
  ],
  [UserRole.SUPERADMIN]: [
    Permission.MANAGE_USERS,
    Permission.MANAGE_CONTENT,
    Permission.MANAGE_FINANCES,
    Permission.MANAGE_SYSTEM,
    Permission.MODERATE_CHAT,
    Permission.MODERATE_STREAMS,
    Permission.MANAGE_REPORTS,
    Permission.ISSUE_WARNINGS,
    Permission.BROADCAST,
    Permission.CREATE_CONTENT,
    Permission.MONETIZE
  ],
  [UserRole.CEO]: [
    Permission.MANAGE_USERS,
    Permission.MANAGE_CONTENT,
    Permission.MANAGE_FINANCES,
    Permission.MANAGE_SYSTEM,
    Permission.MODERATE_CHAT,
    Permission.MODERATE_STREAMS,
    Permission.MANAGE_REPORTS,
    Permission.ISSUE_WARNINGS,
    Permission.BROADCAST,
    Permission.CREATE_CONTENT,
    Permission.MONETIZE
  ],
  [UserRole.MARKETING_READONLY]: [
    // Marketing read-only: Can only view data, no write permissions
    Permission.VIEW_ONLY
  ],
  [UserRole.HR_MANAGER]: [
    Permission.MANAGE_USERS,
    Permission.MODERATE_CHAT,
    Permission.MODERATE_STREAMS,
    Permission.MANAGE_REPORTS,
    Permission.ISSUE_WARNINGS,
    Permission.BROADCAST,
    Permission.CREATE_CONTENT,
    Permission.MONETIZE
  ],
  [UserRole.PASTOR]: [
    Permission.BROADCAST,
    Permission.CREATE_CONTENT,
    Permission.MONETIZE,
    Permission.MODERATE_CHAT
  ],
  [UserRole.AGENCY_LEADER]: [
    Permission.MANAGE_USERS,
    Permission.BROADCAST,
    Permission.CREATE_CONTENT,
    Permission.MONETIZE
  ],
  [UserRole.ATTORNEY]: [
    Permission.BROADCAST,
    Permission.CREATE_CONTENT,
    Permission.MONETIZE
  ],
  [UserRole.PROSECUTOR]: [
    Permission.BROADCAST,
    Permission.CREATE_CONTENT,
    Permission.MONETIZE
  ],
  [UserRole.JOURNALIST]: [
    Permission.BROADCAST,
    Permission.CREATE_CONTENT
  ],
  [UserRole.AUCTIONEER]: [
    Permission.BROADCAST,
    Permission.CREATE_CONTENT,
    Permission.MONETIZE
  ],
  [UserRole.CEO_ASSISTANT]: [
    Permission.MANAGE_USERS,
    Permission.MANAGE_CONTENT,
    Permission.MANAGE_FINANCES,
    Permission.MANAGE_SYSTEM,
    Permission.MODERATE_CHAT,
    Permission.MODERATE_STREAMS,
    Permission.MANAGE_REPORTS,
    Permission.ISSUE_WARNINGS,
    Permission.BROADCAST,
    Permission.CREATE_CONTENT,
    Permission.MONETIZE
  ],
  [UserRole.NOAH_ASSISTANT]: [
    Permission.MANAGE_USERS,
    Permission.MANAGE_CONTENT,
    Permission.MANAGE_FINANCES,
    Permission.MANAGE_SYSTEM,
    Permission.MODERATE_CHAT,
    Permission.MODERATE_STREAMS,
    Permission.MANAGE_REPORTS,
    Permission.ISSUE_WARNINGS,
    Permission.BROADCAST,
    Permission.CREATE_CONTENT,
    Permission.MONETIZE
  ],
  [UserRole.ACADEMY_TEACHER]: [
    Permission.BROADCAST,
    Permission.CREATE_CONTENT,
    Permission.MONETIZE
  ],
  [UserRole.ACADEMY_STUDENT]: [
    Permission.BROADCAST,
    Permission.CREATE_CONTENT
  ],
  [UserRole.ACADEMY_DIRECTOR]: [
    Permission.MANAGE_USERS,
    Permission.MANAGE_CONTENT,
    Permission.MANAGE_FINANCES,
    Permission.MANAGE_SYSTEM,
    Permission.BROADCAST,
    Permission.CREATE_CONTENT,
    Permission.MONETIZE
  ],
  [UserRole.ADMISSIONS_OFFICER]: [
    Permission.MANAGE_USERS,
    Permission.BROADCAST,
    Permission.CREATE_CONTENT
  ]
}

// Enhanced role validation with comprehensive checks
export const hasPermission = (profile: UserProfile | null, permission: Permission): boolean => {
  if (!profile) return false
  
  const isElevatedCityAdmin =
    profile.is_admin ||
    profile.role === UserRole.ADMIN ||
    profile.role === 'superadmin' ||
    profile.role === 'ceo' ||
    profile.troll_role === UserRole.ADMIN ||
    profile.troll_role === 'superadmin' ||
    profile.troll_role === 'ceo' ||
    (profile as any).is_superadmin === true

  // Admin-tier roles have broad permissions used by dashboards
  if (isElevatedCityAdmin) return true
  
  // Check role-based permissions
  const rolePermissions = ROLE_PERMISSIONS[profile.role as UserRole] || []
  return rolePermissions.includes(permission)
}

// Enhanced role checking with multiple validation methods
export const hasRole = (
  profile: UserProfile | null,
  requiredRoles: UserRole | string | UserRole[] | string[],
  options: {
    allowAdminOverride?: boolean
  } = {}
): boolean => {
  if (!profile) return false
  
  const { allowAdminOverride = true } = options
  const roles = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles]
  
  // Admin override
  const isElevatedCityAdmin =
    profile.is_admin === true ||
    profile.role === UserRole.ADMIN ||
    profile.role === 'superadmin' ||
    profile.role === 'ceo' ||
    profile.troll_role === UserRole.ADMIN ||
    profile.troll_role === 'superadmin' ||
    profile.troll_role === 'ceo' ||
    (profile as any).is_superadmin === true

  if (allowAdminOverride && isElevatedCityAdmin) {
    return true
  }
  
  // Direct role match
  if (roles.includes(profile.role as UserRole)) {
    return true
  }

  // Legacy boolean-based staff roles
  const booleanRoleChecks: Record<string, boolean | undefined> = {
    prosecutor: profile.is_prosecutor,
    attorney: profile.is_attorney,
    judge: profile.is_judge,
    secretary: profile.is_secretary,
    ceo: profile.is_ceo,
    auctioneer: profile.is_auctioneer,
    // moderator: profile.is_moderator, // column does not exist
    officer: profile.is_officer,
    journalist: (profile as any).is_journalist,
    tcnn_news_caster: (profile as any).is_news_caster,
    tcnn_chief_news_caster: (profile as any).is_chief_news_caster,
    agency_hr: (profile as any).is_agency_hr,
    agency_hr_manager: (profile as any).is_agency_hr_manager,
    agency_leader: (profile as any).is_agency_leader,
    ceo_assistant: (profile as any).is_ceo_assistant,
    noah_assistant: (profile as any).is_noah_assistant,
    pastor: (profile as any).is_pastor,
  }

  if (Object.entries(booleanRoleChecks).some(([roleName, hasFlag]) => hasFlag && roles.includes(roleName as UserRole))) {
    return true
  }

  if (
    Array.isArray(roles) &&
    roles.includes(UserRole.SECRETARY) &&
    ['secretary', UserRole.EXECUTIVE_SECRETARY, UserRole.TROLL_CITY_SECRETARY].includes(
      String(profile.role || ''),
    )
  ) {
    return true
  }

  // Unified troll_role match
  if (profile.troll_role && roles.includes(profile.troll_role as UserRole)) {
    return true
  }

  if (
    profile.troll_role &&
    Array.isArray(roles) &&
    roles.includes(UserRole.SECRETARY) &&
    ['secretary', UserRole.EXECUTIVE_SECRETARY, UserRole.TROLL_CITY_SECRETARY].includes(
      String(profile.troll_role || ''),
    )
  ) {
    return true
  }
  
  // Legacy role field compatibility
  if (roles.includes(UserRole.TROLL_OFFICER) && profile.is_troll_officer) {
    return true
  }

  if (roles.includes(UserRole.LEAD_TROLL_OFFICER) && profile.is_lead_officer) {
    return true
  }
  
  return false
}

// Check if user is marketing read-only (external agency access)
export const isMarketingReadonly = (profile: UserProfile | null): boolean => {
  if (!profile) return false
  return profile.role === UserRole.MARKETING_READONLY
}

// Check if user can perform write operations
export const canWrite = (profile: UserProfile | null): boolean => {
  if (!profile) return false
  // Admin can write
  if (profile.role === UserRole.ADMIN || profile.is_admin) return true
  // Marketing readonly cannot write
  if (profile.role === UserRole.MARKETING_READONLY) return false
  return true
}

// Check if user is admin or secretary
export const isAdminOrSecretary = (profile: UserProfile | null): boolean => {
  if (!profile) return false
  return hasRole(profile, [UserRole.ADMIN, UserRole.SECRETARY, UserRole.EXECUTIVE_SECRETARY, UserRole.TROLL_CITY_SECRETARY])
}

// Role display name formatter - maps internal role values to user-friendly labels
export const getRoleDisplayName = (role?: string | null, isAdmin?: boolean): string => {
  if (!role) return 'User'
  
  // Map internal roles to display names
  const roleDisplayMap: Record<string, string> = {
    'admin': 'CEO',
    'owner': 'Owner',
    'moderator': 'Moderator',
    'troll_officer': 'Troll Officer',
    'lead_troll_officer': 'Lead Officer',
    'troll_family': 'Troll Family',
    'troller': 'Troller',
    'secretary': 'Secretary',
    'president': 'President',
    'vice_president': 'Vice President',
    'agency_hr_manager': 'Agency HR Manager',
    'hr_admin': 'HR Admin',
    'temp_city_admin': 'Temp Admin',
    'temp_admin': 'Temp Admin',
    'executive_secretary': 'Executive Secretary',
    'troll_city_secretary': 'City Secretary',
    'troll_city_treasurer': 'City Treasurer',
    'empire_partner': 'Empire Partner',
    'marketing_readonly': 'Marketing Agency',
    'user': 'User'
  }
  
  return roleDisplayMap[role] || role.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
}

// Production-ready profile validation
export const validateProfile = (profile: UserProfile | null): {
  isValid: boolean
  errors: string[]
  warnings: string[]
} => {
  const errors: string[] = []
  const warnings: string[] = []
  
  if (!profile) {
    errors.push('Profile is null')
    return { isValid: false, errors, warnings }
  }
  
  // Required fields validation
  if (!profile.id) errors.push('Missing user ID')
  if (!profile.username) errors.push('Missing username')
  if (!profile.role) errors.push('Missing role')
  
  // Role-specific validations
  if (profile.role === UserRole.TROLL_OFFICER) {
    if (profile.is_officer_active && !profile.officer_level) {
      warnings.push('Officer is active but missing officer level')
    }
  }
  
  // Balance validation
  if (profile.troll_coins < 0) errors.push('Negative troll coins balance')
  if (profile.total_earned_coins < 0) errors.push('Negative total earned coins')
  
  // Permission warnings
  if (profile.role === UserRole.ADMIN && !profile.is_admin) {
    warnings.push('Admin role detected but is_admin flag is false')
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings
  }
}

export async function ensureSupabaseSession(client: SupabaseClient) {
  const { data: sessionData, error } = await client.auth.getSession()
  if (error) {
    throw error
  }
  const session = sessionData?.session ?? null
  if (!session) {
    throw new Error('Not logged in yet')
  }

  return session
}

/**
 * ✅ Get active session with automatic refresh
 * This prevents race conditions by always refreshing before getting session
 */
export async function getActiveSession(): Promise<any> {
  try {
    // ✅ Fix: Check session first, ONLY refresh if missing
    // This avoids triggering unnecessary global auth updates
    const { data } = await supabase.auth.getSession()
    
    if (data.session?.access_token) {
      return data.session
    }

    // Only refresh if truly missing
    console.log('[getActiveSession] No active session found, attempting refresh...')
    const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession()
    
    if (refreshError) {
      console.warn('[getActiveSession] Session error:', refreshError.message)
      return null
    }
    
    if (!refreshData.session?.access_token) {
      console.warn('[getActiveSession] No session found after refresh')
      return null
    }
    
    return refreshData.session
  } catch (err: any) {
    console.error('[getActiveSession] Error getting session:', err?.message)
    return null
  }
}

export async function reportError(params: {
  message: string
  stack?: string
  userId?: string | null
  url?: string
  component?: string
  context?: any
}) {
  try {
    let userId = params.userId
    // 🔧 REQUIRED client confirmation: Ensure user_id is included
    if (!userId) {
      const { data } = await supabase.auth.getUser()
      userId = data.user?.id || null
    }

    const payload = {
      message: params.message?.slice(0, 1000),
      stack: params.stack?.slice(0, 4000),
      user_id: userId,
      url: params.url || (typeof window !== 'undefined' ? window.location.href : null),
      component: params.component || null,
      context: {
        ...params.context,
        appVersion: typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : undefined,
        buildTime: typeof __BUILD_TIME__ !== 'undefined' ? __BUILD_TIME__ : undefined,
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined
      },
      status: 'open'
    }
    const { error } = await supabase.from('system_errors').insert(payload)
    if (error) {
      console.warn('Error reporting failed', error)
    }
  } catch (e: any) {
    console.warn('Error reporting threw', e?.message || e)
  }
}

export async function searchUsers(params: {
  query: string
  limit?: number
  select?: string
}): Promise<Array<{
  id: string
  username: string
  avatar_url?: string | null
  rgb_username_expires_at?: string | null
}>> {
  const limit = params.limit ?? 20
  const select = params.select ?? 'id, username, avatar_url, rgb_username_expires_at'
  const q = (params.query || '').trim().replace('@', '')

  if (!q) {
    const { data, error } = await supabase
      .from('user_profiles')
      .select(select)
      .order('created_at', { ascending: false })
      .limit(Math.max(limit, 1))
    if (error) {
      console.warn('searchUsers empty query failed', error)
      return []
    }
    return (data as any[]) || []
  }

  try {
    const { data, error } = await supabase.rpc('search_users', {
      p_query: q,
      p_limit: Math.max(limit, 1)
    })
    if (!error && Array.isArray(data) && data.length > 0) {
      return data as any[]
    }
  } catch {
    // ignore and fallback
  }

  const { data, error } = await supabase
    .from('user_profiles')
    .select(select)
    .ilike('username', `%${q}%`)
    .order('username', { ascending: true })
    .limit(Math.max(limit, 1))

  if (error) {
    console.warn('searchUsers fallback failed', error)
    return []
  }
  return (data as any[]) || []
}

export interface SystemSettings {
  id: string
  payout_lock_enabled: boolean
  payout_lock_reason?: string | null
  payout_unlock_at?: string | null
  trial_started_at?: string | null
  trial_started_by?: string | null
  gifts_disabled?: boolean | null
  gifts_disabled_reason?: string | null
  updated_at: string
}

export async function getSystemSettings(): Promise<SystemSettings | null> {
  const { data, error } = await supabase.rpc('get_system_settings')
  if (error) {
    console.warn('getSystemSettings error', error)
    return null
  }
  return (data as any) || null
}

export function getCountdown(target?: string | null): { totalMs: number; days: number; hours: number; minutes: number; seconds: number } {
  if (!target) return { totalMs: 0, days: 0, hours: 0, minutes: 0, seconds: 0 }
  const t = new Date(target).getTime() - Date.now()
  const totalMs = Math.max(t, 0)
  const days = Math.floor(totalMs / (1000 * 60 * 60 * 24))
  const hours = Math.floor((totalMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
  const minutes = Math.floor((totalMs % (1000 * 60 * 60)) / (1000 * 60))
  const seconds = Math.floor((totalMs % (1000 * 60)) / 1000)
  return { totalMs, days, hours, minutes, seconds }
}

export async function startLaunchTrial(adminUserId: string): Promise<SystemSettings | null> {
  const { data, error } = await supabase.rpc('start_launch_trial', { p_admin_id: adminUserId })
  if (error) {
    console.warn('startLaunchTrial error', error)
    return null
  }
  await supabase.rpc('notify_all_users', {
    p_title: 'Launch Trial started',
    p_message: 'Launch Trial started. Payouts unlock in 14 days.',
    p_type: 'system_update'
  })
  return (data as any) || null
}

export async function endTrialEarly(): Promise<SystemSettings | null> {
  const { data, error } = await supabase.rpc('end_trial_early')
  if (error) {
    console.warn('endTrialEarly error', error)
    return null
  }
  await supabase.rpc('notify_payouts_open_if_needed')
  return (data as any) || null
}

export async function relockPayouts(reason?: string): Promise<SystemSettings | null> {
  const { data, error } = await supabase.rpc('relock_payouts', { p_reason: reason || 'Emergency payout lock' })
  if (error) {
    console.warn('relockPayouts error', error)
    return null
  }
  return (data as any) || null
}

export async function autoUnlockPayouts(): Promise<SystemSettings | null> {
  const { data, error } = await supabase.rpc('auto_unlock_payouts')
  if (error) {
    console.warn('autoUnlockPayouts error', error)
    return null
  }
  if (data && (data as any)?.payout_lock_enabled === false) {
    await supabase.rpc('notify_payouts_open_if_needed')
  }
  return (data as any) || null
}

export async function listUserConversations(): Promise<Conversation[]> {
  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError) {
    throw userError
  }
  const userId = userData.user?.id
  if (!userId) {
    throw new Error('Not authenticated')
  }

  const { data, error } = await supabase
    .from('conversation_members')
    .select('conversation_id, conversations(* )')
    .eq('user_id', userId)
    .order('joined_at', { ascending: false })

  if (error) {
    throw error
  }

  const conversations: Conversation[] = []
  for (const row of data || []) {
    const conv = (row as any).conversations
    if (conv) {
      conversations.push({
        id: conv.id,
        created_at: conv.created_at,
        created_by: conv.created_by,
      })
    }
  }

  return conversations
}

export async function createConversation(memberUserIds: string[]): Promise<Conversation> {
  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError) {
    throw userError
  }
  const currentUserId = userData.user?.id
  if (!currentUserId) {
    throw new Error('Not authenticated')
  }

  const uniqueMemberIds = Array.from(new Set([...memberUserIds, currentUserId]))

  const { data: conversationData, error: conversationError } = await supabase
    .from('conversations')
    .insert({
      created_by: currentUserId,
    })
    .select()
    .single()

  if (conversationError) {
    throw conversationError
  }

  const conversationId = conversationData.id as string

  const membersPayload = uniqueMemberIds.map((userId) => ({
    conversation_id: conversationId,
    user_id: userId,
    role: userId === currentUserId ? 'owner' : 'member',
  }))

  const { error: membersError } = await supabase
    .from('conversation_members')
    .insert(membersPayload)

  if (membersError) {
    throw membersError
  }

  return {
    id: conversationData.id,
    created_at: conversationData.created_at,
    created_by: conversationData.created_by,
  }
}

export async function sendConversationMessage(conversationId: string, body: string): Promise<ConversationMessage> {
  const trimmed = body.trim()
  if (!trimmed) {
    throw new Error('Message body is empty')
  }

  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError) {
    throw userError
  }
  const senderId = userData.user?.id
  if (!senderId) {
    throw new Error('Not authenticated')
  }

  const { data, error } = await supabase
    .from('conversation_messages')
    .insert({
      conversation_id: conversationId,
      sender_id: senderId,
      body: trimmed,
    })
    .select()
    .single()

  if (error) {
    throw error
  }

  return {
    id: data.id,
    conversation_id: data.conversation_id,
    sender_id: data.sender_id,
    body: data.body,
    created_at: data.created_at,
  }
}

export async function getConversationMessages(
  conversationId: string,
  options?: { limit?: number; before?: string }
): Promise<ConversationMessage[]> {
  const limit = options?.limit ?? 2000 // Increased to fetch ALL messages per conversation

  let query = supabase
    .from('conversation_messages')
    .select('id, conversation_id, sender_id, body, created_at')
    .eq('conversation_id', conversationId)
    .is('is_deleted', false)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (options?.before) {
    query = query.lt('created_at', options.before)
  }

  const { data, error } = await query

  if (error) {
    throw error
  }

  return (data || []).map((row) => ({
    id: row.id,
    conversation_id: row.conversation_id,
    sender_id: row.sender_id,
    body: row.body,
    created_at: row.created_at,
  }))
}

export async function markConversationRead(conversationId: string) {
  const { error } = await supabase.rpc('mark_conversation_read', {
    p_conversation_id: conversationId,
  })
  if (error) {
    throw error
  }
}

export async function markMessageRead(messageId: string) {
  const { error } = await supabase.rpc('mark_message_read', {
    message_id: messageId,
  })
  if (error) {
    throw error
  }
}

// Officer Unified Messaging
export async function isOfficer(userId?: string): Promise<boolean> {
  const uid = userId || (await supabase.auth.getUser()).data.user?.id
  if (!uid) return false
  
  const { data } = await supabase
    .from('user_profiles')
    .select('is_troll_officer, is_pastor, officer_role, role, is_admin, troll_role')
    .eq('id', uid)
    .single()
  
  // Check all eligible roles for OPS access
  return (
    data?.is_troll_officer === true ||
    data?.is_pastor === true ||
    data?.role === 'admin' ||
    data?.is_admin === true ||
    data?.officer_role === 'lead_officer' ||
    data?.officer_role === 'owner' ||
    data?.troll_role === 'secretary' ||
    data?.troll_role === 'lead_officer' ||
    data?.troll_role === 'pastor'
  )
}

// Special conversation ID for officer group chat
export const OFFICER_GROUP_CONVERSATION_ID = '00000000-0000-0000-0000-000000000001'

export interface UnifiedMessage {
  id: string
  conversation_id: string
  sender_id: string
  content: string
  created_at: string
  read_at?: string | null
  is_ops_message: boolean // true if from officer_chat_messages
  sender_username?: string
  sender_avatar_url?: string | null
  sender_rgb_expires_at?: string | null
  sender_glowing_username_color?: string | null
  sender_created_at?: string
}

export async function getUnifiedMessagesForOfficer(
  userId: string,
  options?: { limit?: number; include_ops?: boolean }
): Promise<UnifiedMessage[]> {
  const limit = options?.limit ?? 2000 // Increased to fetch all messages
  const includeOps = options?.include_ops ?? true
  
  // Check if user is officer
  const isOff = await isOfficer(userId)
  
  const messages: UnifiedMessage[] = []
  
  // Get regular DM messages
  const { data: convMembers } = await supabase
    .from('conversation_members')
    .select('conversation_id')
    .eq('user_id', userId)
  
  if (convMembers && convMembers.length > 0) {
    const convIds = convMembers.map(m => m.conversation_id)
    const { data: dmMessages } = await supabase
      .from('conversation_messages')
      .select('*')
      .in('conversation_id', convIds)
      .is('is_deleted', false)
      .order('created_at', { ascending: false })
      .limit(limit)
    
    if (dmMessages) {
      messages.push(...dmMessages.map(m => ({
        id: m.id,
        conversation_id: m.conversation_id,
        sender_id: m.sender_id,
        content: m.body,
        created_at: m.created_at,
        read_at: m.read_at,
        is_ops_message: false
      })))
    }
  }
  
  // Get OPS messages if user is officer and include_ops is true
  if (isOff && includeOps) {
    const { data: opsMessages } = await supabase
      .from('officer_chat_messages')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)
    
    if (opsMessages) {
      messages.push(...opsMessages.map(m => ({
        id: m.id,
        conversation_id: OFFICER_GROUP_CONVERSATION_ID,
        sender_id: m.sender_id,
        content: m.content,
        created_at: m.created_at,
        read_at: null,
        is_ops_message: true
      })))
    }
  }
  
  // Sort by created_at descending
  messages.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  
  // Enhance with sender info
  const senderIds = [...new Set(messages.map(m => m.sender_id))]
  if (senderIds.length > 0) {
    const { data: usersData } = await supabase
      .from('user_profiles')
      .select('id,username,avatar_url,rgb_username_expires_at,glowing_username_color,created_at')
      .in('id', senderIds)
    
    const senderMap: Record<string, any> = {}
    usersData?.forEach(u => {
      senderMap[u.id] = u
    })
    
    messages.forEach(m => {
      const sender = senderMap[m.sender_id]
      if (sender) {
        m.sender_username = sender.username
        m.sender_avatar_url = sender.avatar_url
        m.sender_rgb_expires_at = sender.rgb_username_expires_at
        m.sender_glowing_username_color = sender.glowing_username_color
        m.sender_created_at = sender.created_at
      }
    })
  }
  
  return messages.slice(0, limit)
}

export async function sendOfficerMessage(content: string, priority: string = 'normal'): Promise<any> {
  const { data, error } = await supabase
    .from('officer_chat_messages')
    .insert({
      sender_id: (await supabase.auth.getUser()).data.user?.id,
      content,
      priority,
      message_type: 'chat'
    })
    .select()
    .single()
  
  if (error) throw error
  return data
}

// ─── Group Chat Functions ───────────────────────────────────────────────────

export async function createGroupChat(name: string, memberUserIds: string[]): Promise<Conversation> {
  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError) throw userError
  const currentUserId = userData.user?.id
  if (!currentUserId) throw new Error('Not authenticated')

  const uniqueMemberIds = Array.from(new Set([...memberUserIds, currentUserId]))

  const { data: conversationData, error: conversationError } = await supabase
    .from('conversations')
    .insert({
      created_by: currentUserId,
      is_group: true,
      name: name.trim(),
    })
    .select()
    .single()

  if (conversationError) throw conversationError

  const conversationId = conversationData.id as string

  // Insert creator as owner, others as invited (they must accept)
  const membersPayload = uniqueMemberIds.map((userId) => ({
    conversation_id: conversationId,
    user_id: userId,
    role: userId === currentUserId ? 'owner' : (userId === currentUserId ? 'member' : 'invited'),
    status: userId === currentUserId ? 'active' : 'invited',
  }))

  const { error: membersError } = await supabase
    .from('conversation_members')
    .insert(membersPayload)

  if (membersError) throw membersError

  const currentUsername = userData.user?.email || 'Someone'

  // Send invite notifications to all invited members
  for (const memberId of memberUserIds) {
    if (memberId !== currentUserId) {
      try {
        await supabase.from('notifications').insert({
          user_id: memberId,
          type: 'group_invite',
          title: 'Group Chat Invite',
          message: `${currentUsername} invited you to "${name.trim()}"`,
          metadata: {
            conversation_id: conversationId,
            group_name: name.trim(),
            invited_by: currentUserId,
          }
        })
      } catch {
        // Non-critical: notification may fail but group is still created
      }
    }
  }

  return {
    id: conversationData.id,
    created_at: conversationData.created_at,
    created_by: conversationData.created_by,
    is_group: true,
    name: name.trim(),
  }
}

export async function acceptGroupInvite(conversationId: string): Promise<void> {
  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError) throw userError
  const userId = userData.user?.id
  if (!userId) throw new Error('Not authenticated')

  // Update member status from 'invited' to 'active'
  const { error } = await supabase
    .from('conversation_members')
    .update({ status: 'active', role: 'member' })
    .eq('conversation_id', conversationId)
    .eq('user_id', userId)

  if (error) throw error

  // Delete the invite notification
  await supabase
    .from('notifications')
    .delete()
    .eq('user_id', userId)
    .eq('type', 'group_invite')
    .contains('metadata', { conversation_id: conversationId })
}

export async function declineGroupInvite(conversationId: string): Promise<void> {
  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError) throw userError
  const userId = userData.user?.id
  if (!userId) throw new Error('Not authenticated')

  // Remove member from conversation
  const { error } = await supabase
    .from('conversation_members')
    .delete()
    .eq('conversation_id', conversationId)
    .eq('user_id', userId)

  if (error) throw error

  // Delete the invite notification
  await supabase
    .from('notifications')
    .delete()
    .eq('user_id', userId)
    .eq('type', 'group_invite')
    .contains('metadata', { conversation_id: conversationId })
}

export async function leaveGroupChat(conversationId: string): Promise<void> {
  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError) throw userError
  const userId = userData.user?.id
  if (!userId) throw new Error('Not authenticated')

  // Remove member from conversation
  const { error } = await supabase
    .from('conversation_members')
    .delete()
    .eq('conversation_id', conversationId)
    .eq('user_id', userId)

  if (error) throw error

  // Check if any active members remain
  const { count } = await supabase
    .from('conversation_members')
    .select('*', { count: 'exact', head: true })
    .eq('conversation_id', conversationId)
    .eq('status', 'active')

  // If no active members left, delete the entire conversation
  if ((count ?? 0) === 0) {
    await supabase.from('conversation_messages').delete().eq('conversation_id', conversationId)
    await supabase.from('conversation_members').delete().eq('conversation_id', conversationId)
    await supabase.from('conversations').delete().eq('id', conversationId)
  }
}

export async function getGroupChatMembers(conversationId: string): Promise<Array<{ user_id: string; username: string; avatar_url: string | null; role: string; status: string }>> {
  const { data: members, error } = await supabase
    .from('conversation_members')
    .select('user_id, role, status')
    .eq('conversation_id', conversationId)

  if (error) throw error
  if (!members || members.length === 0) return []

  const userIds = members.map(m => m.user_id)
  const { data: profiles } = await supabase
    .from('user_profiles')
    .select('id, username, avatar_url')
    .in('id', userIds)

  const profileMap: Record<string, any> = {}
  profiles?.forEach(p => { profileMap[p.id] = p })

  return members.map(m => ({
    user_id: m.user_id,
    username: profileMap[m.user_id]?.username || 'Unknown',
    avatar_url: profileMap[m.user_id]?.avatar_url || null,
    role: m.role,
    status: m.status,
  }))
}

export async function removeGroupMember(conversationId: string, userIdToRemove: string): Promise<void> {
  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError) throw userError
  const currentUserId = userData.user?.id
  if (!currentUserId) throw new Error('Not authenticated')

  // Verify current user is owner or admin of the group
  const { data: myRole } = await supabase
    .from('conversation_members')
    .select('role')
    .eq('conversation_id', conversationId)
    .eq('user_id', currentUserId)
    .maybeSingle()

  if (!myRole || (myRole.role !== 'owner' && myRole.role !== 'admin')) {
    throw new Error('Only group owners and admins can remove members')
  }

  // Can't remove yourself via this function (use leaveGroupChat)
  if (userIdToRemove === currentUserId) {
    throw new Error('Use leave group to remove yourself')
  }

  // Remove the member
  const { error } = await supabase
    .from('conversation_members')
    .delete()
    .eq('conversation_id', conversationId)
    .eq('user_id', userIdToRemove)

  if (error) throw error

  // Delete any pending invite notification for this user
  await supabase
    .from('notifications')
    .delete()
    .eq('user_id', userIdToRemove)
    .eq('type', 'group_invite')
    .contains('metadata', { conversation_id: conversationId })
}

export async function addGroupMember(conversationId: string, userIdToAdd: string): Promise<void> {
  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError) throw userError
  const currentUserId = userData.user?.id
  if (!currentUserId) throw new Error('Not authenticated')

  // Verify current user is a member of the group
  const { data: myMembership } = await supabase
    .from('conversation_members')
    .select('role')
    .eq('conversation_id', conversationId)
    .eq('user_id', currentUserId)
    .maybeSingle()

  if (!myMembership) throw new Error('You are not a member of this group')

  // Check if user is already a member
  const { data: existing } = await supabase
    .from('conversation_members')
    .select('id, status')
    .eq('conversation_id', conversationId)
    .eq('user_id', userIdToAdd)
    .maybeSingle()

  if (existing) {
    if (existing.status === 'active') throw new Error('User is already in this group')
    // If invited, re-activate
    await supabase
      .from('conversation_members')
      .update({ status: 'active', role: 'member' })
      .eq('id', existing.id)
    return
  }

  // Insert as active member directly (added by owner/admin)
  const { error } = await supabase
    .from('conversation_members')
    .insert({
      conversation_id: conversationId,
      user_id: userIdToAdd,
      role: 'member',
      status: 'active',
    })

  if (error) throw error

  // Send notification to the added user
  try {
    const { data: convData } = await supabase
      .from('conversations')
      .select('name')
      .eq('id', conversationId)
      .maybeSingle()

    const { data: adderProfile } = await supabase
      .from('user_profiles')
      .select('username')
      .eq('id', currentUserId)
      .maybeSingle()

    await supabase.from('notifications').insert({
      user_id: userIdToAdd,
      type: 'group_invite',
      title: 'Added to Group Chat',
      message: `${adderProfile?.username || 'Someone'} added you to "${convData?.name || 'a group'}"`,
      metadata: {
        conversation_id: conversationId,
        group_name: convData?.name || '',
        added_by: currentUserId,
      }
    })
  } catch {
    // Non-critical
  }
}

export async function getBlockedUserIds(): Promise<string[]> {
  const { data: userData } = await supabase.auth.getUser()
  const userId = userData.user?.id
  if (!userId) return []

  // Get users I blocked
  const { data: blocked } = await supabase
    .from('user_relationships')
    .select('related_user_id')
    .eq('user_id', userId)
    .eq('status', 'blocked')

  // Get users who blocked me
  const { data: blockedBy } = await supabase
    .from('user_relationships')
    .select('user_id')
    .eq('related_user_id', userId)
    .eq('status', 'blocked')

  const ids = new Set<string>()
  blocked?.forEach(r => ids.add(r.related_user_id))
  blockedBy?.forEach(r => ids.add(r.user_id))

  return Array.from(ids)
}

// Global Message Notification Listener
export function setupGlobalMessageNotifications(
  userId: string,
  onNewMessage: (senderId: string, senderUsername: string, senderAvatar: string | null, isOpsMessage: boolean, messageBody?: string) => void
) {
  // Cache user's conversation IDs in memory to avoid DB query per message
  let myConvIds: Set<string> = new Set()
  let cacheLoaded = false

  // Pre-load conversation IDs once
  supabase
    .from('conversation_members')
    .select('conversation_id')
    .eq('user_id', userId)
    .then(({ data }) => {
      if (data) {
        myConvIds = new Set(data.map(m => m.conversation_id))
      }
      cacheLoaded = true
    })

  // Subscribe to new DMs
  const dmChannel = supabase
    .channel(`global-dms:${userId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'conversation_messages'
      },
      async (payload) => {
        const newMsg = payload.new as any
        
        // Validate message data
        if (!newMsg?.conversation_id || !newMsg?.sender_id) return
        
        // Don't notify for own messages
        if (newMsg.sender_id === userId) return
        
        // Check cache instead of querying DB every time
        if (cacheLoaded && !myConvIds.has(newMsg.conversation_id)) return
        
        // If cache isn't loaded yet, fall back to DB check (only for first few messages)
        if (!cacheLoaded) {
          const { data: membership } = await supabase
            .from('conversation_members')
            .select('conversation_id')
            .eq('conversation_id', newMsg.conversation_id)
            .eq('user_id', userId)
            .maybeSingle()
          
          if (!membership) return
          // Add to cache for future messages
          myConvIds.add(newMsg.conversation_id)
        }
        
        // Get message content
        const messageBody = newMsg.body || newMsg.content || ''
        
        // Fetch sender info
        const { data: sender } = await supabase
          .from('user_profiles')
          .select('username, avatar_url')
          .eq('id', newMsg.sender_id)
          .maybeSingle()
        
        if (sender) {
          onNewMessage(newMsg.sender_id, sender.username, sender.avatar_url, false, messageBody)
        }
      }
    )
    .subscribe()

  // Subscribe to OPS messages (if user is officer)
  let opsChannel: any | null = null
  let opsEnabled = true
  isOfficer(userId).then((isOff) => {
    if (!isOff) {
      console.log('[setupGlobalMessageNotifications] User is not an officer, skipping OPS subscription')
      return
    }
    if (!opsEnabled) return

    opsChannel = supabase
      .channel(`global-ops:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'officer_chat_messages',
        },
        async (payload) => {
          const newMsg = payload.new as any
          
          // Validate message data
          if (!newMsg?.sender_id) {
            console.warn('[setupGlobalMessageNotifications] Invalid OPS message payload:', payload)
            return
          }
          
          if (newMsg.sender_id === userId) return // Don't notify for own messages

          // Get message content
          const messageBody = newMsg.body || newMsg.content || ''

          // Fetch sender info
          const { data: sender, error: senderError } = await supabase
            .from('user_profiles')
            .select('username, avatar_url')
            .eq('id', newMsg.sender_id)
            .maybeSingle()

          if (senderError) {
            console.error('[setupGlobalMessageNotifications] Error fetching OPS sender:', senderError)
            return
          }

          if (sender) {
            console.log('[setupGlobalMessageNotifications] Opening OPS chat bubble from:', sender.username)
            onNewMessage(newMsg.sender_id, sender.username, sender.avatar_url, true, messageBody)
          }
        }
      )
      .subscribe((status) => {
        console.log(`[setupGlobalMessageNotifications] OPS channel status: ${status}`)
      })
  })
  
  // Cleanup function
  return () => {
    opsEnabled = false
    if (opsChannel) {
      supabase.removeChannel(opsChannel)
      opsChannel = null
    }
    if (dmChannel) {
      supabase.removeChannel(dmChannel)
    }
  }
}
