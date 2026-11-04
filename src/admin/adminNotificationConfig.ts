export type AdminNotificationTab =
  | 'critical-alerts'
  | 'reports-queue'
  | 'applications'
  | 'support-tickets'
  | 'surveys'
  | 'court-dockets'
  | 'jail-management'
  | 'database-backup'
  | 'system-errors'
  | 'payment-logs'
  | 'coin-purchases-ledger'
  | 'payout-batches'
  | 'crown-redemptions'
  | 'advertisements'
  | 'seller-management'
  | 'stream-monitor'
  | 'media-library'
  | 'chat-moderation'
  | 'announcements'
  | 'referral-bonuses'
  | 'staff-audit'
  | 'weekly-reports'
  | 'exec-reports'
  | 'intake-inbox'
  | 'officer-operations'
  | 'user-forms'
  | 'employee-files'
  | 'other'

export interface AdminNotificationRecord {
  id: string
  user_id: string
  type: string
  title: string
  message: string
  metadata: Record<string, unknown> | null
  tab_key: AdminNotificationTab
  entity_id: string | null
  severity: string
  priority: string
  source: string
  is_read: boolean
  read_at: string | null
  created_at: string
  link?: string | null
}

const typeToTab: Record<string, AdminNotificationTab> = {
  report_filed: 'reports-queue',
  moderation_action: 'reports-queue',
  user_arrested: 'jail-management',
  court_started: 'court-dockets',
  user_kicked: 'stream-monitor',
  coin_purchase_admin_alert: 'coin-purchases-ledger',
  payment_received: 'payment-logs',
  payout_update: 'payout-batches',
  support_ticket: 'support-tickets',
  survey_response: 'surveys',
  application_submitted: 'applications',
  career_application_submitted: 'applications',
  executive_intake: 'intake-inbox',
  executive_report: 'exec-reports',
  staff_audit: 'staff-audit',
  weekly_report: 'weekly-reports',
  staff_file: 'employee-files',
  staff_document: 'employee-files',
  review_submitted: 'seller-management',
  seller_review: 'seller-management',
  broadcast_school_review: 'applications',
  system_error: 'system-errors',
  critical_alert: 'critical-alerts',
  database_backup: 'database-backup',
  crown_redemption_submitted: 'crown-redemptions',
  advertisement_submitted: 'advertisements',
  live_stream_review: 'stream-monitor',
  media_review: 'media-library',
  chat_moderation: 'chat-moderation',
  announcement_review: 'announcements',
  referral_activity: 'referral-bonuses',
  officer_alert: 'officer-operations',
}

export function getAdminNotificationTab(
  type: string,
  metadata?: Record<string, unknown> | null,
): AdminNotificationTab {
  const explicit = metadata?.tab_key
  if (typeof explicit === 'string' && explicit) return explicit as AdminNotificationTab
  return typeToTab[type] || 'other'
}

export function getAdminNotificationPath(
  notification: Pick<AdminNotificationRecord, 'tab_key' | 'metadata' | 'link' | 'entity_id'>,
): string {
  const metadata = notification.metadata || {}
  if (typeof notification.link === 'string' && notification.link) return notification.link
  if (typeof metadata.route === 'string' && metadata.route) return metadata.route

  const paths: Partial<Record<AdminNotificationTab, string>> = {
    'critical-alerts': '/admin/critical-alerts',
    'reports-queue': '/admin/reports',
    applications: '/admin/applications',
    'support-tickets': '/admin/support-tickets',
    surveys: '/admin/surveys',
    'court-dockets': '/admin/court-dockets',
    'jail-management': '/admin/jail-management',
    'database-backup': '/admin/system/backup',
    'system-errors': '/admin/errors',
    'payment-logs': '/admin/payment-logs',
    'coin-purchases-ledger': '/admin/coinpurchase-ledger',
    'payout-batches': '/admin/payout-batches',
    'crown-redemptions': '/admin/crown-redemptions',
    advertisements: '/admin/advertisements',
    'seller-management': '/admin/seller-management',
    'stream-monitor': '/admin/stream-monitor',
    'media-library': '/admin/media-library',
    'chat-moderation': '/admin/chat-moderation',
    announcements: '/admin/announcements',
    'referral-bonuses': '/admin/referral-bonuses',
    'staff-audit': '/admin/staff-audit',
    'weekly-reports': '/admin/reports/weekly',
    'exec-reports': '/admin/executive-reports',
    'intake-inbox': '/admin/executive-intake',
    'officer-operations': '/admin/officer-operations',
    'user-forms': '/admin/users/forms',
    'employee-files': '/admin/hr',
  }
  const path = paths[notification.tab_key] || '/admin'
  return notification.entity_id ? `${path}?id=${encodeURIComponent(notification.entity_id)}` : path
}

export function getAdminNotificationTabForPath(pathname: string): AdminNotificationTab | null {
  const paths: Partial<Record<AdminNotificationTab, string>> = {
    'critical-alerts': '/admin/critical-alerts',
    'reports-queue': '/admin/reports',
    applications: '/admin/applications',
    'support-tickets': '/admin/support-tickets',
    surveys: '/admin/surveys',
    'court-dockets': '/admin/court-dockets',
    'jail-management': '/admin/jail-management',
    'database-backup': '/admin/system/backup',
    'system-errors': '/admin/errors',
    'payment-logs': '/admin/payment-logs',
    'coin-purchases-ledger': '/admin/coinpurchase-ledger',
    'payout-batches': '/admin/payout-batches',
    'crown-redemptions': '/admin/crown-redemptions',
    advertisements: '/admin/advertisements',
    'seller-management': '/admin/seller-management',
    'stream-monitor': '/admin/stream-monitor',
    'media-library': '/admin/media-library',
    'chat-moderation': '/admin/chat-moderation',
    announcements: '/admin/announcements',
    'referral-bonuses': '/admin/referral-bonuses',
    'staff-audit': '/admin/staff-audit',
    'weekly-reports': '/admin/reports/weekly',
    'exec-reports': '/admin/executive-reports',
    'intake-inbox': '/admin/executive-intake',
    'officer-operations': '/admin/officer-operations',
    'user-forms': '/admin/users/forms',
    'employee-files': '/admin/hr',
  }
  return (Object.entries(paths).find(([, path]) => pathname === path)?.[0] as AdminNotificationTab | undefined) || null
}
