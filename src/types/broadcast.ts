export type StreamStatus = 'pending' | 'starting' | 'live' | 'ended' | 'failed';
export type LayoutMode = 'grid' | 'battle' | 'spotlight';

export interface Stream {
  [x: string]: any;
  stream_type: string;
  seat_count: any;
  agora_channel: any;
  room_name: any;
  id: string;
  user_id: string;
  broadcaster_id?: string;
  title: string;
  category: string;
  stream_kind?: 'regular' | 'trollmers';
  camera_ready?: boolean;
  status: StreamStatus;
  is_live?: boolean;
  is_battle: boolean;
  battle_id?: string;
  viewer_count?: number;
  current_viewers: number;
  box_count: number;
  total_likes?: number;
  total_gifts_coins?: number;
  layout_mode: LayoutMode;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
  seat_price: number;
  seat_prices?: number[];
  are_seats_locked: boolean;
  has_rgb_effect: boolean;
  rgb_purchased?: boolean;
  active_theme_url?: string;
  broadcast_theme_slug?: string | null;
  broadcast_mode?: string | null;
  broadcast_format?: string | null;
  livekit_room_name?: string | null;
  // Viewer playback goes through HLS; hosts and seat users stay on LiveKit RTC.
  hls_path?: string;
  hls_url?: string;
  egress_id?: string | null;
  // Featured broadcast fields
  is_featured?: boolean;
  featured_at?: string | null;
  featured_by?: string | null;
  // Password protection fields
  is_protected?: boolean;
  password_hash?: string;
  // Battle mode fields
  battle_enabled?: boolean;
  battle_mode?: 'none' | 'universal' | 'troll' | 'manual' | 'random_queue';
  battle_format?: '1v1' | '2v2' | '3v3' | '4v4' | '5v5';
  battle_status?: 'waiting' | 'ready' | 'starting' | 'active' | 'ended';
  battle_start_time?: string | null;
  battle_end_time?: string | null;
  random_battle_queue_enabled?: boolean;
  random_battle_queued_at?: string | null;
  random_battle_cooldown_until?: string | null;
  battle_end_reason?: 'timer_expired' | 'broadcaster_left' | 'forfeit' | 'admin_ended' | 'disconnected' | null;
  battle_winner_id?: string | null;
  battle_forfeited_by?: string | null;
  side_a_score?: number;
  side_b_score?: number;
  team_a_members?: string[];
  team_b_members?: string[];
  // State battle fields
  state_battle_mode?: 'none' | 'state' | null;
  state_battle_state_code?: string | null;
  // Recording/VOD fields
  thumbnail_url?: string | null;
  recording_url?: string | null;
  recording_storage_path?: string | null;
  saved_to_admin_archive?: boolean;
  saved_at?: string | null;
  // Broadcast agreement acceptance (per-session)
  broadcast_disclaimer_accepted?: boolean;
  broadcast_disclaimer_accepted_at?: string | null;
  broadcast_disclaimer_user_id?: string;
}

export interface StreamGuest {
  id: string;
  stream_id: string;
  user_id: string;
  status: 'invited' | 'accepted' | 'rejected' | 'joined' | 'left';
  type: 'guest' | 'cohost';
  created_at: string;
}

export interface Gift {
  id: string;
  name: string;
  cost: number;
  icon_url: string;
  animation_url?: string;
}

export interface StreamGift {
  id: string;
  stream_id: string;
  sender_id: string;
  recipient_id: string;
  gift_id: string;
  created_at: string;
  sender?: {
    username: string;
    avatar_url: string;
  };
  gift?: Gift;
}

export interface ChatMessage {
  id: string;
  stream_id: string;
  user_id: string;
  content: string;
  created_at: string;
  type?: 'chat' | 'system';
  user?: {
    username: string;
    avatar_url: string;
    role?: string;
    troll_role?: string;
  };
  user_profiles?: {
    username: string;
    avatar_url: string;
    role?: string;
    troll_role?: string;
    created_at?: string;
    rgb_username_expires_at?: string;
    glowing_username_color?: string;
    // Minor safety fields
    has_children?: boolean;
    minor_allowed_on_stream?: boolean;
    minor_violation_count?: number;
    minor_last_violation?: string;
  };
}

// Minor Safety System Types
export type ReportType = 'HARASSMENT' | 'SPAM' | 'INAPPROPRIATE_CONTENT' | 'MINOR_LEFT_UNSUPERVISED' | 'OTHER';
export type ReportStatus = 'pending' | 'reviewed' | 'dismissed' | 'action_taken';
export type ViolationType = 'MINOR_UNSUPERVISED_STREAM' | 'HARASSMENT' | 'SPAM' | 'INAPPROPRIATE_CONTENT' | 'TERMS_VIOLATION' | 'OTHER';
export type CaseStatus = 'pending' | 'under_review' | 'guilty' | 'not_guilty' | 'dismissed';

export interface StreamReport {
  id: string;
  reporter_user_id: string;
  reported_stream_id?: string;
  reported_user_id?: string;
  report_type: ReportType;
  description?: string;
  screenshot_url?: string;
  status: ReportStatus;
  reviewed_by?: string;
  reviewed_at?: string;
  created_at: string;
  // Joined fields
  reporter_name?: string;
  reported_name?: string;
  stream_title?: string;
}

export interface ModerationCase {
  id: string;
  user_id: string;
  violation_type: ViolationType;
  evidence_url?: string;
  report_id?: string;
  case_status: CaseStatus;
  assigned_moderator_id?: string;
  resolution_notes?: string;
  penalty_issued?: string;
  created_at: string;
  resolved_at?: string;
  // Joined fields
  username?: string;
  moderator_name?: string;
}

export interface ModerationLog {
  id: string;
  user_id?: string;
  stream_id?: string;
  action_type: string;
  action_description?: string;
  performed_by?: string;
  metadata?: Record<string, any>;
  created_at: string;
}

// ─── Stage Pass System ───────────────────────────────────────────────────────
export type StagePassStatus =
  | 'open'
  | 'requested'
  | 'approved'
  | 'live'
  | 'denied'
  | 'removed'
  | 'expired';

export interface StagePass {
  id: string;
  stream_id: string;
  broadcaster_id: string;
  user_id: string | null;
  status: StagePassStatus;
  stage_index: number;
  price_coins: number;
  paid_amount: number;
  requested_at: string | null;
  approved_at: string | null;
  went_live_at: string | null;
  denied_at: string | null;
  removed_at: string | null;
  expired_at: string | null;
  created_at: string;
  updated_at: string;
  // Joined profile data (when user_id is not null)
  user_profile?: {
    id: string;
    username: string;
    avatar_url: string | null;
  };
}

export interface StagePassGuest {
  id: string;
  stream_id: string;
  user_id: string;
  status: StagePassStatus;
  stage_index: number;
  price_coins: number;
  paid_amount: number;
  requested_at: string | null;
  approved_at: string | null;
  went_live_at: string | null;
  denied_at: string | null;
  removed_at: string | null;
  expired_at: string | null;
  created_at: string;
  updated_at: string;
  // Joined profile data
  user_profile: {
    id: string;
    username: string;
    avatar_url: string | null;
  };
}
