import { v4 as uuidv4 } from 'uuid'

export type CollaborationPlatform = 'mai_troll_broadcast' | 'hytrogaming'

export interface CollaborationBroadcasterOption {
  id: string
  stream_id: string
  user_id: string
  broadcaster_id?: string | null
  title?: string | null
  category?: string | null
  viewer_count?: number | null
  current_viewers?: number | null
  platform?: CollaborationPlatform | string | null
  livekit_room_name?: string | null
  username?: string | null
  avatar_url?: string | null
  is_live?: boolean | null
  status?: string | null
  current_collaboration_participants?: number | null
  available_collaboration_capacity?: number | null
  occupied_guest_seats?: number | null
}

export interface CollaborationRequestRow {
  id: string
  requester_user_id: string
  requester_stream_id: string
  requester_platform: CollaborationPlatform | string
  receiver_user_id: string
  receiver_stream_id: string
  receiver_platform: CollaborationPlatform | string
  requested_session_id?: string | null
  status: string
  created_at: string
  expires_at?: string | null
  metadata?: Record<string, unknown>
}

export const MAX_COLLAB_BROADCASTERS = 6
export const MAX_COLLAB_GUEST_SEATS = 3

export const COLLABORATION_PLATFORM_OPTIONS: Array<{ value: CollaborationPlatform; label: string }> = [
  { value: 'mai_troll_broadcast', label: 'Mai Troll Broadcast' },
  { value: 'hytrogaming', label: 'HytroGaming' },
]

export function normalizeCollaborationPlatform(value?: string | null): CollaborationPlatform {
  if (value === 'hytrogaming') return 'hytrogaming'
  return 'mai_troll_broadcast'
}

export function validateCollaborationRequestInput(input: {
  requesterUserId?: string | null
  requesterStreamId?: string | null
  receiverUserId?: string | null
  receiverStreamId?: string | null
  requesterPlatform?: string | null
  receiverPlatform?: string | null
}) {
  const issues: string[] = []

  if (!input.requesterUserId) issues.push('requesterUserId is required')
  if (!input.requesterStreamId) issues.push('requesterStreamId is required')
  if (!input.receiverUserId) issues.push('receiverUserId is required')
  if (!input.receiverStreamId) issues.push('receiverStreamId is required')
  if (!input.requesterPlatform) issues.push('requesterPlatform is required')
  if (!input.receiverPlatform) issues.push('receiverPlatform is required')
  if (input.requesterUserId && input.receiverUserId && input.requesterUserId === input.receiverUserId) {
    issues.push('Cannot request collaboration with yourself')
  }

  return { ok: issues.length === 0, issues }
}

export function buildCollaborationRequestPayload(input: {
  requesterUserId: string
  requesterStreamId: string
  requesterPlatform: CollaborationPlatform | string
  receiverUserId: string
  receiverStreamId: string
  receiverPlatform: CollaborationPlatform | string
  requestedSessionId?: string | null
}) {
  const now = new Date()
  const expiresAt = new Date(now.getTime() + 2 * 60 * 1000).toISOString()

  return {
    id: uuidv4(),
    requester_user_id: input.requesterUserId,
    requester_stream_id: input.requesterStreamId,
    requester_platform: normalizeCollaborationPlatform(input.requesterPlatform as string),
    receiver_user_id: input.receiverUserId,
    receiver_stream_id: input.receiverStreamId,
    receiver_platform: normalizeCollaborationPlatform(input.receiverPlatform as string),
    requested_session_id: input.requestedSessionId ?? null,
    status: 'pending',
    created_at: now.toISOString(),
    expires_at: expiresAt,
    metadata: {
      requested_capacity: MAX_COLLAB_BROADCASTERS,
      maximum_guest_seats: MAX_COLLAB_GUEST_SEATS,
    },
  }
}

export function resolveDisplayName(profile: { username?: string | null; email?: string | null } | null | undefined, fallback = 'Broadcaster') {
  const username = typeof profile?.username === 'string' && profile.username.trim().length > 0 ? profile.username.trim() : ''
  if (username) return username

  const emailName = typeof profile?.email === 'string' ? profile.email.split('@')[0] : ''
  return emailName || fallback
}
