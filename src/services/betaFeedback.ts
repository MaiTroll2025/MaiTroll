// Client API for the Beta Feedback system. All writes go through secure RPCs.
import { supabase } from '@/lib/supabase'
declare const __APP_VERSION__: string
import type {
  BetaFeedback,
  BetaFeedbackAuditEntry,
  BetaFeedbackCategory,
  BetaFeedbackDevice,
  BetaFeedbackInternalNote,
  BetaFeedbackPriority,
  BetaFeedbackReply,
  BetaFeedbackSeverity,
  BetaFeedbackStats,
  BetaFeedbackStatus,
  BetaFeedbackUserGroup,
  BetaFeedbackWithUser,
  BetaReplyVisibility,
} from '@/types/betaFeedback'

function appVersion(): string {
  try {
    // eslint-disable-next-line no-undef
    return typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : ''
  } catch {
    return ''
  }
}

export function isPwa(): boolean {
  if (typeof window === 'undefined') return false
  const standalone = window.matchMedia?.('(display-mode: standalone)').matches
  const iosStandalone = (navigator as unknown as { standalone?: boolean }).standalone === true
  return Boolean(standalone || iosStandalone)
}

export function detectBrowser(): string {
  if (typeof navigator === 'undefined') return 'Unknown'
  const ua = navigator.userAgent
  if (/edg\//i.test(ua)) return 'Edge'
  if (/opr\//i.test(ua) || /opera/i.test(ua)) return 'Opera'
  if (/chrome|crios/i.test(ua) && !/edg\//i.test(ua)) return 'Chrome'
  if (/firefox|fxios/i.test(ua)) return 'Firefox'
  if (/safari/i.test(ua) && !/chrome/i.test(ua)) return 'Safari'
  if (/msie|trident/i.test(ua)) return 'Internet Explorer'
  return 'Unknown'
}

// Captured automatically so users never have to enter it manually.
export interface AutoCapture {
  affected_route: string
  user_agent: string
  browser_name: string
  viewport_width: number
  viewport_height: number
  is_pwa: boolean
  app_version: string
}

export function captureEnvironment(routePath: string): AutoCapture {
  return {
    affected_route: routePath,
    user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
    browser_name: detectBrowser(),
    viewport_width: typeof window !== 'undefined' ? window.innerWidth : 0,
    viewport_height: typeof window !== 'undefined' ? window.innerHeight : 0,
    is_pwa: isPwa(),
    app_version: appVersion(),
  }
}

export interface SubmitBetaFeedbackInput {
  category: BetaFeedbackCategory
  title: string
  description: string
  affected_feature?: string | null
  device_type?: BetaFeedbackDevice | null
  severity?: BetaFeedbackSeverity | null
  screenshot_url?: string | null
  capture: AutoCapture
}

export async function submitBetaFeedback(input: SubmitBetaFeedbackInput): Promise<BetaFeedback> {
  const { data, error } = await supabase.rpc('submit_beta_feedback', {
    p_category: input.category,
    p_title: input.title,
    p_description: input.description,
    p_affected_feature: input.affected_feature ?? null,
    p_affected_route: input.capture.affected_route,
    p_device_type: input.device_type ?? null,
    p_browser_name: input.capture.browser_name,
    p_user_agent: input.capture.user_agent,
    p_viewport_width: input.capture.viewport_width,
    p_viewport_height: input.capture.viewport_height,
    p_is_pwa: input.capture.is_pwa,
    p_app_version: input.capture.app_version,
    p_screenshot_url: input.screenshot_url ?? null,
    p_severity: input.severity ?? null,
  })
  if (error) throw error
  const result = data as { success: boolean; error?: string; feedback?: BetaFeedback }
  if (!result?.success || !result.feedback) {
    throw new Error(result?.error || 'Submission failed')
  }
  return result.feedback
}

export interface FeedbackFilters {
  status?: BetaFeedbackStatus | null
  category?: BetaFeedbackCategory | null
  priority?: BetaFeedbackPriority | null
  device?: BetaFeedbackDevice | null
  username?: string | null
  assignedToMe?: boolean
  onlyArchived?: boolean
  onlyMine?: boolean
}

function applyModeratorFilters(
  q: ReturnType<typeof baseModeratorQuery>,
  filters: FeedbackFilters,
  currentUserId: string
) {
  if (filters.status) q = q.eq('status', filters.status)
  if (filters.category) q = q.eq('category', filters.category)
  if (filters.priority) q = q.eq('priority', filters.priority)
  if (filters.device) q = q.eq('device_type', filters.device)
  if (filters.username) q = q.ilike('user_profiles.username', `%${filters.username}%`)
  if (filters.assignedToMe) q = q.eq('assigned_to', currentUserId)
  if (filters.onlyArchived) q = q.not('archived_at', 'is', null)
  else q = q.is('archived_at', null)
  return q
}

function baseModeratorQuery() {
  return supabase
    .from('beta_feedback')
    .select('*, user_profiles!beta_feedback_user_id_fkey(username, avatar_url)')
}

export async function getMyFeedback(
  userId: string,
  filters: FeedbackFilters = {}
): Promise<BetaFeedback[]> {
  let q = supabase
    .from('beta_feedback')
    .select('*')
    .eq('user_id', userId)
  if (filters.status) q = q.eq('status', filters.status)
  if (filters.onlyArchived) q = q.not('archived_at', 'is', null)
  else q = q.is('archived_at', null)
  const { data, error } = await q.order('created_at', { ascending: false }).limit(200)
  if (error) throw error
  return (data as BetaFeedback[]) ?? []
}

export async function getModeratorFeedback(
  filters: FeedbackFilters,
  currentUserId: string,
  limit = 100
): Promise<BetaFeedback[]> {
  let q = baseModeratorQuery()
  q = applyModeratorFilters(q, filters, currentUserId)
  const { data, error } = await q.order('created_at', { ascending: false }).limit(limit)
  if (error) throw error
  return (data as unknown as BetaFeedbackWithUser[]) ?? []
}

export async function getUserFeedback(
  userId: string,
  onlyArchived = false
): Promise<BetaFeedback[]> {
  let q = supabase
    .from('beta_feedback')
    .select('*')
    .eq('user_id', userId)
  q = onlyArchived ? q.not('archived_at', 'is', null) : q.is('archived_at', null)
  const { data, error } = await q.order('created_at', { ascending: false }).limit(200)
  if (error) throw error
  return (data as BetaFeedback[]) ?? []
}

export async function getFeedbackById(id: string): Promise<BetaFeedback | null> {
  const { data, error } = await supabase
    .from('beta_feedback')
    .select('*, user_profiles!beta_feedback_user_id_fkey(username, avatar_url)')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return (data as unknown as BetaFeedbackWithUser) ?? null
}

export async function getInternalNotes(feedbackId: string): Promise<BetaFeedbackInternalNote[]> {
  const { data, error } = await supabase
    .from('beta_feedback_internal_notes')
    .select('*')
    .eq('feedback_id', feedbackId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data as BetaFeedbackInternalNote[]) ?? []
}

export async function getReplies(feedbackId: string): Promise<BetaFeedbackReply[]> {
  const { data, error } = await supabase
    .from('beta_feedback_replies')
    .select('*, author:author_id(username, avatar_url)')
    .eq('feedback_id', feedbackId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data as unknown as BetaFeedbackReply[]) ?? []
}

export async function getAuditLog(feedbackId: string): Promise<BetaFeedbackAuditEntry[]> {
  const { data, error } = await supabase
    .from('beta_feedback_audit_log')
    .select('*, actor:actor_id(username)')
    .eq('feedback_id', feedbackId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data as unknown as BetaFeedbackAuditEntry[]) ?? []
}

export async function getAssignableStaff(): Promise<{ id: string; username: string | null; avatar_url: string | null }[]> {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('id, username, avatar_url')
    .in('role', ['admin', 'superadmin', 'ceo', 'moderator', 'lead_troll_officer', 'troll_officer', 'secretary', 'pastor'])
    .limit(200)
  if (error) throw error
  return (data as { id: string; username: string | null; avatar_url: string | null }[]) ?? []
}

export async function getUserGroups(limit = 50, offset = 0): Promise<BetaFeedbackUserGroup[]> {
  const { data, error } = await supabase.rpc('get_beta_feedback_user_groups', {
    p_limit: limit,
    p_offset: offset,
  })
  if (error) throw error
  return (data as BetaFeedbackUserGroup[]) ?? []
}

export async function getStats(): Promise<BetaFeedbackStats | null> {
  const { data, error } = await supabase.rpc('get_beta_feedback_stats')
  if (error) throw error
  if (data && typeof data === 'object' && 'success' in data && !(data as { success: boolean }).success) {
    return null
  }
  return (data as unknown as BetaFeedbackStats) ?? null
}

// ---- Moderator RPC wrappers ----

async function moderatorRpc(fn: string, params: Record<string, unknown>): Promise<BetaFeedback> {
  const { data, error } = await supabase.rpc(fn, params)
  if (error) throw error
  const result = data as { success: boolean; error?: string; feedback?: BetaFeedback }
  if (!result?.success || !result.feedback) throw new Error(result?.error || 'Action failed')
  return result.feedback
}

export const updateStatus = (id: string, status: BetaFeedbackStatus, note?: string) =>
  moderatorRpc('update_beta_feedback_status', { p_feedback_id: id, p_status: status, p_notify_note: note ?? null })

export const setPriority = (id: string, priority: BetaFeedbackPriority) =>
  moderatorRpc('set_beta_feedback_priority', { p_feedback_id: id, p_priority: priority })

export const assignFeedback = (id: string, assignedTo: string | null) =>
  moderatorRpc('assign_beta_feedback', { p_feedback_id: id, p_assigned_to: assignedTo })

export const respondToFeedback = (id: string, response: string) =>
  moderatorRpc('respond_to_beta_feedback', { p_feedback_id: id, p_response: response })

export const markDuplicate = (id: string, duplicateOf: string) =>
  moderatorRpc('mark_beta_feedback_duplicate', { p_feedback_id: id, p_duplicate_of: duplicateOf })

export const archiveFeedback = (id: string) =>
  moderatorRpc('archive_beta_feedback', { p_feedback_id: id })

export const restoreFeedback = (id: string) =>
  moderatorRpc('restore_beta_feedback', { p_feedback_id: id })

export async function addInternalNote(id: string, note: string): Promise<void> {
  const { data, error } = await supabase.rpc('add_beta_feedback_internal_note', {
    p_feedback_id: id,
    p_note: note,
  })
  if (error) throw error
  const result = data as { success: boolean; error?: string }
  if (!result?.success) throw new Error(result?.error || 'Failed to add note')
}

export async function addReply(id: string, body: string, visibility: BetaReplyVisibility): Promise<void> {
  const { data, error } = await supabase.rpc('add_beta_feedback_reply', {
    p_feedback_id: id,
    p_body: body,
    p_visibility: visibility,
  })
  if (error) throw error
  const result = data as { success: boolean; error?: string }
  if (!result?.success) throw new Error(result?.error || 'Failed to add reply')
}

export async function bulkUpdate(
  ids: string[],
  changes: {
    status?: BetaFeedbackStatus | null
    priority?: BetaFeedbackPriority | null
    category?: BetaFeedbackCategory | null
    archive?: boolean | null
  }
): Promise<number> {
  const { data, error } = await supabase.rpc('bulk_update_beta_feedback', {
    p_ids: ids,
    p_status: changes.status ?? null,
    p_priority: changes.priority ?? null,
    p_category: changes.category ?? null,
    p_archive: changes.archive ?? null,
  })
  if (error) throw error
  const result = data as { success: boolean; error?: string; updated?: number }
  if (!result?.success) throw new Error(result?.error || 'Bulk update failed')
  return result.updated ?? 0
}

export async function uploadScreenshot(file: File, userId: string): Promise<string> {
  const path = `${userId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
  const { error } = await supabase.storage
    .from('feedback-attachments')
    .upload(path, file, { cacheControl: '3600', upsert: false })
  if (error) throw error
  const { data } = supabase.storage.from('feedback-attachments').getPublicUrl(path)
  return data.publicUrl
}

export function isChatDisabledKnown(error: unknown): boolean {
  const e = error as { message?: string }
  return e?.message === 'chat_disabled'
}
