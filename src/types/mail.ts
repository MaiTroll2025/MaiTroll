// ============================================================
// UTROMAIL & TROMAIL - TYPE DEFINITIONS
// ============================================================

export type MailPrivacySetting = 'everyone' | 'following' | 'mutual_followers' | 'verified_only';
export type MailFolder = 'inbox' | 'sent' | 'archive' | 'trash' | 'requests' | 'starred' | 'drafts';
export type MessageType = 'normal' | 'academy_notification' | 'government' | 'system' | 'report';
export type RequestStatus = 'pending' | 'accepted' | 'ignored' | 'blocked';
export type ReportStatus = 'pending' | 'reviewed' | 'action_taken' | 'dismissed';
export type NotificationType = 'new_message' | 'message_request' | 'academy_mail' | 'government_mail' | 'report_update';

export interface UtromailAccount {
  id: string;
  user_id: string;
  mail_address: string;
  display_name: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // Joined
  username?: string;
  avatar_url?: string;
}

export interface TromailRoleAccount {
  id: string;
  user_id: string;
  mail_address: string;
  role_name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // Joined
  username?: string;
  display_name?: string;
  avatar_url?: string;
}

export interface UtromailThread {
  [x: string]: any;
  id: string;
  subject: string | null;
  is_group: boolean;
  created_by: string | null;
  last_message_at: string;
  created_at: string;
  updated_at: string;
  // Joined
  members?: UtromailThreadMember[];
  last_message?: UtromailMessage;
  unread_count?: number;
  // Flat fields for sidebar display
  other_user_id?: string | null;
  other_username?: string | null;
  other_avatar_url?: string | null;
  other_display_name?: string | null;
  other_utromail_address?: string | null;
  other_is_jailed?: boolean;
}

export interface UtromailThreadMember {
  id: string;
  thread_id: string;
  user_id: string;
  folder: MailFolder;
  is_muted: boolean;
  joined_at: string;
  // Joined
  username?: string;
  display_name?: string;
  avatar_url?: string;
  utromail_address?: string;
}

export interface UtromailMessage {
  id: string;
  thread_id: string;
  sender_id: string;
  sender_mail_address: string;
  recipient_id: string | null;
  recipient_mail_address: string | null;
  subject: string | null;
  body: string;
  body_html: string | null;
  message_type: MessageType;
  is_starred: boolean;
  is_draft: boolean;
  parent_message_id: string | null;
  sent_at: string;
  created_at: string;
  updated_at: string;
  // Joined
  sender_name?: string;
  sender_avatar?: string;
  sender_username?: string;
  recipient_name?: string;
  recipient_avatar?: string;
  is_read?: boolean;
  sender_is_jailed?: boolean;
  attachments?: UtromailAttachment[];
}

export interface UtromailAttachment {
  id: string;
  message_id: string;
  file_name: string;
  file_url: string;
  file_size: number | null;
  mime_type: string | null;
  created_at: string;
}

export interface UtromailBlock {
  id: string;
  blocker_id: string;
  blocked_id: string;
  created_at: string;
  // Joined
  blocked_username?: string;
  blocked_display_name?: string;
  blocked_avatar?: string;
}

export interface UtromailRequest {
  id: string;
  thread_id: string;
  sender_id: string;
  recipient_id: string;
  status: RequestStatus;
  created_at: string;
  updated_at: string;
  // Joined
  sender_name?: string;
  sender_avatar?: string;
  sender_username?: string;
  sender_mail?: string;
}

export interface UtromailReport {
  id: string;
  reporter_id: string;
  reported_id: string;
  message_id: string | null;
  thread_id: string | null;
  report_reason: string;
  screenshot_url: string | null;
  status: ReportStatus;
  reviewed_by: string | null;
  review_notes: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  reporter_name?: string;
  reported_name?: string;
  reviewed_by_name?: string;
}

export interface UtromailNotification {
  id: string;
  user_id: string;
  message_id: string | null;
  notification_type: NotificationType;
  is_read: boolean;
  created_at: string;
}

export interface MailSearchResult {
  users: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
    utromail_address: string;
    is_staff: boolean;
    tromail_address?: string;
  }[];
  messages: UtromailMessage[];
}
