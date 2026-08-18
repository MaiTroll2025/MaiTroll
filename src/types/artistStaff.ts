export type StaffStatus = 'pending' | 'active' | 'declined' | 'suspended' | 'terminated' | 'expired'
export type StaffPayType = 'fixed' | 'hourly' | 'commission' | 'percentage'
export type StaffPayFrequency = 'one_time' | 'weekly' | 'biweekly' | 'monthly' | 'per_release' | 'per_post' | 'commission'
export type StaffPosition = 'manager' | 'social_media_manager' | 'promoter' | 'marketing_manager' | 'booking_manager' | 'assistant' | 'publicist' | 'road_manager' | 'content_manager' | 'custom'

export const STAFF_POSITION_LABELS: Record<StaffPosition, string> = {
  manager: 'Manager',
  social_media_manager: 'Social Media Manager',
  promoter: 'Promoter',
  marketing_manager: 'Marketing Manager',
  booking_manager: 'Booking Manager',
  assistant: 'Assistant',
  publicist: 'Publicist',
  road_manager: 'Road Manager',
  content_manager: 'Content Manager',
  custom: 'Custom',
}

export const DEFAULT_ROLE_PERMISSIONS: Record<StaffPosition, string[]> = {
  manager: [
    'view_artist_profile',
    'view_artist_analytics',
    'view_music',
    'manage_tracks',
    'manage_albums',
    'create_posts',
    'edit_posts',
    'delete_posts',
    'schedule_posts',
    'promote_music',
    'manage_promotions',
    'manage_events',
    'manage_bookings',
    'manage_artist_media',
    'view_staff',
  ],
  social_media_manager: [
    'view_artist_profile',
    'view_music',
    'create_posts',
    'edit_posts',
    'delete_posts',
    'schedule_posts',
    'promote_music',
    'manage_promotions',
    'manage_artist_media',
  ],
  promoter: [
    'view_artist_profile',
    'view_music',
    'create_posts',
    'promote_music',
    'manage_promotions',
  ],
  marketing_manager: [
    'view_artist_profile',
    'view_artist_analytics',
    'view_music',
    'create_posts',
    'edit_posts',
    'schedule_posts',
    'promote_music',
    'manage_promotions',
    'manage_artist_media',
  ],
  booking_manager: [
    'view_artist_profile',
    'view_artist_analytics',
    'manage_events',
    'manage_bookings',
  ],
  assistant: [
    'view_artist_profile',
    'view_music',
    'create_posts',
    'view_artist_analytics',
  ],
  publicist: [
    'view_artist_profile',
    'view_music',
    'create_posts',
    'edit_posts',
    'promote_music',
    'manage_promotions',
  ],
  road_manager: [
    'view_artist_profile',
    'view_artist_analytics',
    'manage_events',
    'manage_bookings',
    'view_music',
  ],
  content_manager: [
    'view_artist_profile',
    'view_music',
    'manage_artist_media',
    'create_posts',
    'edit_posts',
    'schedule_posts',
    'promote_music',
  ],
  custom: [],
}

export const PERMISSION_LABELS: Record<string, string> = {
  view_artist_profile: 'View Artist Profile',
  view_artist_analytics: 'View Artist Analytics',
  view_artist_earnings: 'View Artist Earnings',
  view_music: 'View Music',
  manage_tracks: 'Manage Tracks',
  manage_albums: 'Manage Albums',
  create_posts: 'Create Posts',
  edit_posts: 'Edit Posts',
  delete_posts: 'Delete Posts',
  schedule_posts: 'Schedule Posts',
  promote_music: 'Promote Music',
  manage_promotions: 'Manage Promotions',
  manage_events: 'Manage Events',
  manage_bookings: 'Manage Bookings',
  manage_artist_media: 'Manage Artist Media',
  manage_artist_bio: 'Manage Artist Bio',
  view_staff: 'View Staff',
  hire_staff: 'Hire Staff',
  edit_staff: 'Edit Staff',
  suspend_staff: 'Suspend Staff',
  terminate_staff: 'Terminate Staff',
}

export const PERMISSION_CATEGORIES: Record<string, string[]> = {
  Content: ['create_posts', 'edit_posts', 'delete_posts', 'schedule_posts', 'manage_artist_media'],
  Music: ['view_music', 'manage_tracks', 'manage_albums', 'promote_music'],
  Analytics: ['view_artist_analytics'],
  Events: ['manage_events', 'manage_bookings'],
  Team: ['view_staff', 'hire_staff', 'edit_staff', 'suspend_staff', 'terminate_staff'],
  Financial: ['view_artist_earnings'],
}

export interface ArtistStaffMembership {
  id: string
  artist_id: string
  employee_user_id: string
  position: string
  status: StaffStatus
  pay_type: StaffPayType
  pay_amount: number
  pay_currency: string
  pay_frequency: StaffPayFrequency
  permissions: Record<string, boolean>
  start_date: string | null
  end_date: string | null
  offered_at: string
  accepted_at: string | null
  declined_at: string | null
  terminated_at: string | null
  created_at: string
  updated_at: string
  created_by: string | null
  termination_reason: string | null
  notes: string | null
  employee_username?: string
  employee_display_name?: string
  employee_avatar_url?: string | null
}

export interface ArtistStaffPayment {
  id: string
  membership_id: string
  artist_id: string
  employee_user_id: string
  amount: number
  currency: string
  status: string
  payment_type: string | null
  period_start: string | null
  period_end: string | null
  paid_at: string | null
  created_at: string
  notes: string | null
  employee_username?: string
  employee_display_name?: string
  position?: string
}

export interface ArtistStaffDashboard {
  active_count: number
  pending_count: number
  suspended_count: number
  monthly_cost: number
  active_positions: string[]
}

export interface ArtistStaffAuditLog {
  id: string
  artist_id: string
  membership_id: string | null
  actor_user_id: string | null
  action: string
  metadata: Record<string, any>
  created_at: string
}
