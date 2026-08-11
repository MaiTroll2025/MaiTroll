import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import {
  MAX_COLLAB_BROADCASTERS,
  MAX_COLLAB_GUEST_SEATS,
  normalizeCollaborationPlatform,
  type CollaborationBroadcasterOption,
  type CollaborationRequestRow,
  validateCollaborationRequestInput,
} from '../lib/streamCollaboration'

interface UseStreamCollaborationOptions {
  currentUserId?: string | null
  currentStreamId?: string | null
  currentPlatform?: string | null
}

interface UseStreamCollaborationResult {
  activeBroadcasters: CollaborationBroadcasterOption[]
  incomingRequests: CollaborationRequestRow[]
  pendingRequests: CollaborationRequestRow[]
  loading: boolean
  error: string | null
  refreshBroadcasters: () => Promise<void>
  sendRequest: (receiver: CollaborationBroadcasterOption) => Promise<{ ok: boolean; error?: string }>
  acceptRequest: (request: CollaborationRequestRow) => Promise<{ ok: boolean; error?: string }>
  declineRequest: (request: CollaborationRequestRow) => Promise<{ ok: boolean; error?: string }>
  cancelRequest: (request: CollaborationRequestRow) => Promise<{ ok: boolean; error?: string }>
}

export function useStreamCollaboration(options: UseStreamCollaborationOptions): UseStreamCollaborationResult {
  const { currentUserId, currentStreamId, currentPlatform } = options
  const [activeBroadcasters, setActiveBroadcasters] = useState<CollaborationBroadcasterOption[]>([])
  const [incomingRequests, setIncomingRequests] = useState<CollaborationRequestRow[]>([])
  const [pendingRequests, setPendingRequests] = useState<CollaborationRequestRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const channelRef = useRef<any>(null)

  const normalizedPlatform = useMemo(() => normalizeCollaborationPlatform(currentPlatform || undefined), [currentPlatform])

  const refreshBroadcasters = useCallback(async () => {
    if (!currentUserId) return

    setLoading(true)
    setError(null)
    try {
      const { data, error: streamError } = await supabase
        .from('streams')
        .select('id, user_id, broadcaster_id, title, category, viewer_count, current_viewers, livekit_room_name, status, is_live, started_at')
        .eq('is_live', true)
        .in('status', ['live', 'starting'])
        .order('current_viewers', { ascending: false })
        .limit(50)

      if (streamError) {
        throw streamError
      }

      const rows = (data || [])
        .filter((item: any) => item.id && item.user_id && item.id !== currentStreamId)
        .map((item: any) => ({
          id: item.id,
          stream_id: item.id,
          user_id: item.user_id,
          broadcaster_id: item.broadcaster_id || item.user_id,
          title: item.title || 'Live Stream',
          category: item.category || 'Live',
          viewer_count: item.viewer_count ?? item.current_viewers ?? 0,
          current_viewers: item.current_viewers ?? item.viewer_count ?? 0,
          platform: normalizedPlatform,
          livekit_room_name: item.livekit_room_name || item.id,
          username: null,
          avatar_url: null,
          is_live: item.is_live ?? true,
          status: item.status || 'live',
          current_collaboration_participants: 0,
          available_collaboration_capacity: MAX_COLLAB_BROADCASTERS - 1,
          occupied_guest_seats: 0,
        }))

      const resolved: CollaborationBroadcasterOption[] = []
      for (const row of rows) {
        try {
          const { data: profileData } = await supabase
            .from('user_profiles')
            .select('id, username, avatar_url')
            .eq('id', row.user_id)
            .maybeSingle()

          resolved.push({
            ...row,
            username: profileData?.username || `Broadcaster`,
            avatar_url: profileData?.avatar_url || null,
          })
        } catch {
          resolved.push(row)
        }
      }

      setActiveBroadcasters(resolved)
    } catch (err: any) {
      console.warn('[useStreamCollaboration] Failed to refresh broadcasters', err)
      setError(err?.message || 'Unable to load broadcasters')
      setActiveBroadcasters([])
    } finally {
      setLoading(false)
    }
  }, [currentStreamId, currentUserId, normalizedPlatform])

  const refreshRequests = useCallback(async () => {
    if (!currentUserId) return

    try {
      const { data, error: requestError } = await supabase
        .from('stream_collaboration_requests')
        .select('*')
        .or(`receiver_user_id.eq.${currentUserId},requester_user_id.eq.${currentUserId}`)
        .order('created_at', { ascending: false })
        .limit(50)

      if (requestError) {
        throw requestError
      }

      const rows = (data || []) as CollaborationRequestRow[]
      setIncomingRequests(rows.filter((row) => row.receiver_user_id === currentUserId && row.status === 'pending'))
      setPendingRequests(rows.filter((row) => row.requester_user_id === currentUserId && row.status === 'pending'))
    } catch (err: any) {
      console.warn('[useStreamCollaboration] Failed to refresh requests', err)
    }
  }, [currentUserId])

  const sendRequest = useCallback(async (receiver: CollaborationBroadcasterOption) => {
    if (!currentUserId || !currentStreamId) {
      return { ok: false, error: 'You must be logged in and streaming to request collaboration.' }
    }

    const validation = validateCollaborationRequestInput({
      requesterUserId: currentUserId,
      requesterStreamId: currentStreamId,
      receiverUserId: receiver.user_id,
      receiverStreamId: receiver.stream_id,
      requesterPlatform: currentPlatform,
      receiverPlatform: receiver.platform,
    })

    if (!validation.ok) {
      return { ok: false, error: validation.issues[0] }
    }

    try {
      const { data, error: edgeError } = await supabase.functions.invoke('stream-collaboration', {
        body: {
          action: 'send_request',
          payload: {
            requester_stream_id: currentStreamId,
            requester_platform: normalizedPlatform,
            receiver_user_id: receiver.user_id,
            receiver_stream_id: receiver.stream_id,
            receiver_platform: receiver.platform || normalizedPlatform,
            requester_username: receiver.username || null,
          },
        },
      })

      if (edgeError) throw edgeError
      if (!data?.ok) {
        throw new Error(data?.error || 'Unable to send collaboration request.')
      }

      await refreshRequests()
      return { ok: true }
    } catch (err: any) {
      return { ok: false, error: err?.message || 'Unable to send collaboration request.' }
    }
  }, [currentPlatform, currentStreamId, currentUserId, normalizedPlatform, refreshRequests])

  const cancelRequest = useCallback(async (request: CollaborationRequestRow) => {
    try {
      const { error } = await supabase
        .from('stream_collaboration_requests')
        .update({ status: 'cancelled', updated_at: new Date().toISOString() })
        .eq('id', request.id)
      if (error) throw error
      await refreshRequests()
      return { ok: true }
    } catch (err: any) {
      return { ok: false, error: err?.message || 'Unable to cancel request.' }
    }
  }, [refreshRequests])

  const declineRequest = useCallback(async (request: CollaborationRequestRow) => {
    try {
      const { error } = await supabase
        .from('stream_collaboration_requests')
        .update({ status: 'declined', updated_at: new Date().toISOString() })
        .eq('id', request.id)
      if (error) throw error
      await refreshRequests()
      return { ok: true }
    } catch (err: any) {
      return { ok: false, error: err?.message || 'Unable to decline request.' }
    }
  }, [refreshRequests])

  const acceptRequest = useCallback(async (request: CollaborationRequestRow) => {
    try {
      const { data, error: edgeError } = await supabase.functions.invoke('stream-collaboration', {
        body: {
          action: 'accept_request',
          request_id: request.id,
        },
      })

      if (edgeError) throw edgeError
      if (!data?.ok) {
        throw new Error(data?.error || 'Unable to accept collaboration request.')
      }

      await refreshRequests()
      return { ok: true }
    } catch (err: any) {
      return { ok: false, error: err?.message || 'Unable to accept collaboration request.' }
    }
  }, [refreshRequests])

  useEffect(() => {
    if (!currentUserId) return

    void refreshBroadcasters()
    void refreshRequests()

    channelRef.current = supabase.channel(`stream-collab:${currentUserId}`)
    channelRef.current
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stream_collaboration_requests', filter: `receiver_user_id=eq.${currentUserId}` }, () => {
        void refreshRequests()
      })
      .subscribe()

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
    }
  }, [currentUserId, refreshBroadcasters, refreshRequests])

  return {
    activeBroadcasters,
    incomingRequests,
    pendingRequests,
    loading,
    error,
    refreshBroadcasters,
    sendRequest,
    acceptRequest,
    declineRequest,
    cancelRequest,
  }
}

export default useStreamCollaboration
