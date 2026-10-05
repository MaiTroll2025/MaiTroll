export interface EventCategory {
  id: string
  slug: string
  name: string
  description?: string
  icon: string
  color: string
  is_active: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

export interface CalendarEvent {
  id: string
  title: string
  description?: string
  category_id?: string
  category_slug: string
  category_name?: string
  category_icon?: string
  category_color?: string

  event_date: string
  start_time?: string
  end_time?: string
  timezone: string

  banner_image_url?: string
  thumbnail_url?: string
  event_color: string

  creator_id: string
  creator_username: string

  status: 'upcoming' | 'live' | 'completed' | 'cancelled' | 'archived'

  max_participants?: number
  registration_locked: boolean
  registration_opens_at?: string
  registration_closes_at?: string

  visibility: 'public' | 'private' | 'invite_only'
  access_level: 'everyone' | 'verified_users' | 'founding_officers' | 'staff' | 'creators' | 'agencies' | 'specific_levels' | 'specific_users' | 'invite_only'
  min_level: number

  requirements: string[]
  rules?: string

  location_type: 'virtual' | 'physical' | 'hybrid'
  location_details?: string
  stream_id?: string

  notifications_enabled: boolean
  reminder_7d_sent: boolean
  reminder_3d_sent: boolean
  reminder_24h_sent: boolean
  reminder_1h_sent: boolean
  started_notification_sent: boolean

  metadata: Record<string, any>
  tags: string[]

  participant_count?: number

  created_at: string
  updated_at: string
}

export interface EventParticipant {
  id: string
  event_id: string
  user_id: string
  username: string
  avatar_url?: string

  status: 'registered' | 'confirmed' | 'waitlisted' | 'attended' | 'no_show' | 'cancelled' | 'banned'

  registered_at: string
  confirmed_at?: string
  attended_at?: string

  notes?: string
  metadata: Record<string, any>
}

export interface EventNotification {
  id: string
  event_id: string
  user_id: string

  notification_type: 'event_created' | 'event_updated' | 'event_cancelled' | 'event_reminder_7d' | 'event_reminder_3d' | 'event_reminder_24h' | 'event_reminder_1h' | 'event_started' | 'event_ended' | 'registration_confirmed' | 'registration_waitlisted' | 'registration_cancelled' | 'invite_received' | 'event_full' | 'event_available'

  title: string
  message: string

  is_read: boolean
  is_sent: boolean
  sent_at?: string

  action_url?: string

  metadata: Record<string, any>

  created_at: string
}

export interface EventAccessRule {
  id: string
  event_id: string

  rule_type: 'role' | 'level' | 'badge' | 'achievement' | 'custom'
  rule_key: string
  rule_value?: string
  rule_operator: 'equals' | 'gte' | 'lte' | 'contains' | 'in'

  is_required: boolean

  description?: string

  created_at: string
}

export interface EventInvite {
  id: string
  event_id: string
  invited_user_id: string
  invited_by: string

  status: 'pending' | 'accepted' | 'declined' | 'expired'

  invite_message?: string

  expires_at?: string
  responded_at?: string

  created_at: string
}

export type CalendarViewType = 'month' | 'week' | 'agenda' | 'upcoming'

export interface CreateEventFormData {
  title: string
  description: string
  category_slug: string
  event_date: string
  start_time: string
  end_time: string
  timezone: string
  banner_image_url?: string
  thumbnail_url?: string
  event_color: string
  max_participants?: number
  visibility: 'public' | 'private' | 'invite_only'
  access_level: 'everyone' | 'verified_users' | 'founding_officers' | 'staff' | 'creators' | 'agencies' | 'specific_levels' | 'specific_users' | 'invite_only'
  min_level: number
  requirements: string[]
  rules: string
  location_type: 'virtual' | 'physical' | 'hybrid'
  location_details: string
  tags: string[]
}

export const EVENT_CATEGORIES: EventCategory[] = [
  { id: '', slug: 'pride_event', name: 'Pride Event', icon: '🏳️‍🌈', color: '#EC4899', is_active: true, sort_order: 1, created_at: '', updated_at: '', description: 'LGBTQ+ celebration events' },
  { id: '', slug: 'trollathon', name: 'Trollathon', icon: '🎮', color: '#8B5CF6', is_active: true, sort_order: 2, created_at: '', updated_at: '', description: 'Extended streaming marathon events' },
  { id: '', slug: 'auction_event', name: 'Auction Event', icon: '🔨', color: '#F59E0B', is_active: true, sort_order: 3, created_at: '', updated_at: '', description: 'Live auction events' },
  { id: '', slug: 'gaming_tournament', name: 'Gaming Tournament', icon: '🎯', color: '#10B981', is_active: true, sort_order: 4, created_at: '', updated_at: '', description: 'Competitive gaming events' },
  { id: '', slug: 'family_war', name: 'Family War', icon: '⚔️', color: '#EF4444', is_active: true, sort_order: 5, created_at: '', updated_at: '', description: 'Troll Family battles' },
  { id: '', slug: 'community_meeting', name: 'Community Meeting', icon: '🏛️', color: '#3B82F6', is_active: true, sort_order: 6, created_at: '', updated_at: '', description: 'Town hall and community gatherings' },
  { id: '', slug: 'president_town_hall', name: 'President Town Hall', icon: '🎤', color: '#F97316', is_active: true, sort_order: 7, created_at: '', updated_at: '', description: 'Presidential addresses' },
  { id: '', slug: 'church_service', name: 'Church Service', icon: '⛪', color: '#A855F7', is_active: true, sort_order: 8, created_at: '', updated_at: '', description: 'Religious services' },
  { id: '', slug: 'share_a_thon', name: 'Share-A-Thon', icon: '📢', color: '#EC4899', is_active: true, sort_order: 10, created_at: '', updated_at: '', description: 'Sharing and promotion events' },
  { id: '', slug: 'charity_event', name: 'Charity Event', icon: '💝', color: '#14B8A6', is_active: true, sort_order: 11, created_at: '', updated_at: '', description: 'Fundraising and charity' },
  { id: '', slug: 'creator_event', name: 'Creator Event', icon: '✨', color: '#F472B6', is_active: true, sort_order: 12, created_at: '', updated_at: '', description: 'Creator-focused events' },
  { id: '', slug: 'voice_room_event', name: 'Voice Room Event', icon: '🎙️', color: '#6366F1', is_active: true, sort_order: 13, created_at: '', updated_at: '', description: 'Voice chat events' },
  { id: '', slug: 'battle_event', name: 'Battle Event', icon: '⚡', color: '#DC2626', is_active: true, sort_order: 14, created_at: '', updated_at: '', description: 'Battle competitions' },
  { id: '', slug: 'custom_event', name: 'Custom Event', icon: '📌', color: '#6B7280', is_active: true, sort_order: 99, created_at: '', updated_at: '', description: 'Administrator-defined custom events' },
]

export const EVENT_ACCESS_LEVELS = [
  { value: 'everyone', label: 'Everyone', description: 'All users can join' },
  { value: 'verified_users', label: 'Verified Users', description: 'Only verified users' },
  { value: 'founding_officers', label: 'Founding Officers', description: 'Founding officers only' },
  { value: 'staff', label: 'Staff', description: 'Staff members only' },
  { value: 'creators', label: 'Creators', description: 'Verified creators' },
  { value: 'agencies', label: 'Agencies', description: 'Agency members' },
  { value: 'specific_levels', label: 'Specific Levels', description: 'Users above a certain level' },
  { value: 'specific_users', label: 'Specific Users', description: 'Manually selected users' },
  { value: 'invite_only', label: 'Invite Only', description: 'Invitation required' },
]

export const EVENT_VISIBILITY_OPTIONS = [
  { value: 'public', label: 'Public', description: 'Visible to everyone' },
  { value: 'private', label: 'Private', description: 'Only visible to participants' },
  { value: 'invite_only', label: 'Invite Only', description: 'Only invited users see it' },
]
