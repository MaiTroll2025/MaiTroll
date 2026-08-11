import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const MAX_BROADCASTERS = 6
const MAX_GUEST_SEATS = 3

serve(async (req) => {
  const origin = req.headers.get('origin')
  const headers = corsHeaders(origin)

  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(JSON.stringify({ error: 'Server configuration error' }), { status: 500, headers: { ...headers, 'content-type': 'application/json' } })
    }

    const authHeader = req.headers.get('Authorization') || ''
    if (!authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Missing authentication token', code: 'UNAUTHORIZED' }), { status: 401, headers: { ...headers, 'content-type': 'application/json' } })
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey)
    const userClient = createClient(supabaseUrl, serviceRoleKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    })

    const { data: { user }, error: userError } = await userClient.auth.getUser()
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid or expired authentication token', code: 'UNAUTHORIZED' }), { status: 401, headers: { ...headers, 'content-type': 'application/json' } })
    }

    const body = await req.json().catch(() => ({}))
    const action = String(body?.action || '')

    if (!action) {
      return new Response(JSON.stringify({ error: 'Action is required', code: 'INVALID_ACTION' }), { status: 400, headers: { ...headers, 'content-type': 'application/json' } })
    }

    if (action === 'send_request') {
      const payload = body.payload || {}
      const requestId = crypto.randomUUID()
      const expiresAt = new Date(Date.now() + 2 * 60 * 1000).toISOString()
      const { error } = await adminClient.from('stream_collaboration_requests').insert({
        id: requestId,
        requester_user_id: user.id,
        requester_stream_id: payload.requester_stream_id,
        requester_platform: payload.requester_platform || 'mai_troll_broadcast',
        receiver_user_id: payload.receiver_user_id,
        receiver_stream_id: payload.receiver_stream_id,
        receiver_platform: payload.receiver_platform || 'mai_troll_broadcast',
        requested_session_id: payload.requested_session_id || null,
        status: 'pending',
        created_at: new Date().toISOString(),
        expires_at: expiresAt,
        metadata: { requester_username: payload.requester_username || null },
      })

      if (error) {
        return new Response(JSON.stringify({ error: error.message, code: 'INSERT_FAILED' }), { status: 400, headers: { ...headers, 'content-type': 'application/json' } })
      }

      return new Response(JSON.stringify({ ok: true, request_id: requestId }), { status: 200, headers: { ...headers, 'content-type': 'application/json' } })
    }

    if (action === 'accept_request') {
      const requestId = String(body.request_id || '')
      if (!requestId) {
        return new Response(JSON.stringify({ error: 'request_id is required', code: 'INVALID_REQUEST_ID' }), { status: 400, headers: { ...headers, 'content-type': 'application/json' } })
      }

      const { data: requestRow, error: requestError } = await adminClient
        .from('stream_collaboration_requests')
        .select('*')
        .eq('id', requestId)
        .maybeSingle()

      if (requestError || !requestRow) {
        return new Response(JSON.stringify({ error: 'Request not found', code: 'REQUEST_NOT_FOUND' }), { status: 404, headers: { ...headers, 'content-type': 'application/json' } })
      }

      if (requestRow.receiver_user_id !== user.id) {
        return new Response(JSON.stringify({ error: 'Only the receiver can accept the request', code: 'FORBIDDEN' }), { status: 403, headers: { ...headers, 'content-type': 'application/json' } })
      }

      if (requestRow.status !== 'pending') {
        return new Response(JSON.stringify({ error: 'Request is no longer pending', code: 'INVALID_STATUS' }), { status: 400, headers: { ...headers, 'content-type': 'application/json' } })
      }

      const now = Date.now()
      const expiresAt = requestRow.expires_at ? new Date(requestRow.expires_at).getTime() : 0
      if (expiresAt && expiresAt < now) {
        await adminClient.from('stream_collaboration_requests').update({ status: 'expired', updated_at: new Date().toISOString() }).eq('id', requestId)
        return new Response(JSON.stringify({ error: 'Request expired', code: 'EXPIRED' }), { status: 400, headers: { ...headers, 'content-type': 'application/json' } })
      }

      const sessionId = crypto.randomUUID()
      const { error: sessionError } = await adminClient.from('stream_collaboration_sessions').insert({
        id: sessionId,
        primary_broadcaster_id: requestRow.requester_user_id,
        primary_stream_id: requestRow.requester_stream_id,
        canonical_livekit_room: requestRow.requester_stream_id,
        canonical_platform: requestRow.requester_platform,
        status: 'active',
        maximum_broadcasters: MAX_BROADCASTERS,
        maximum_guest_seats: MAX_GUEST_SEATS,
        created_at: new Date().toISOString(),
        started_at: new Date().toISOString(),
        metadata: { request_id: requestId },
      })

      if (sessionError) {
        return new Response(JSON.stringify({ error: sessionError.message, code: 'SESSION_CREATE_FAILED' }), { status: 400, headers: { ...headers, 'content-type': 'application/json' } })
      }

      const participants = [
        {
          id: crypto.randomUUID(),
          collaboration_session_id: sessionId,
          broadcaster_user_id: requestRow.requester_user_id,
          original_stream_id: requestRow.requester_stream_id,
          platform: requestRow.requester_platform,
          role: 'primary_host',
          participant_status: 'active',
          joined_at: new Date().toISOString(),
          metadata: { request_id: requestId },
        },
        {
          id: crypto.randomUUID(),
          collaboration_session_id: sessionId,
          broadcaster_user_id: requestRow.receiver_user_id,
          original_stream_id: requestRow.receiver_stream_id,
          platform: requestRow.receiver_platform,
          role: 'broadcaster',
          participant_status: 'active',
          joined_at: new Date().toISOString(),
          metadata: { request_id: requestId },
        },
      ]

      const { error: participantsError } = await adminClient.from('stream_collaboration_participants').insert(participants)
      if (participantsError) {
        return new Response(JSON.stringify({ error: participantsError.message, code: 'PARTICIPANT_CREATE_FAILED' }), { status: 400, headers: { ...headers, 'content-type': 'application/json' } })
      }

      await adminClient.from('stream_collaboration_requests').update({ status: 'accepted', updated_at: new Date().toISOString(), accepted_at: new Date().toISOString() }).eq('id', requestId)

      return new Response(JSON.stringify({ ok: true, session_id: sessionId }), { status: 200, headers: { ...headers, 'content-type': 'application/json' } })
    }

    return new Response(JSON.stringify({ error: 'Unsupported action', code: 'UNSUPPORTED_ACTION' }), { status: 400, headers: { ...headers, 'content-type': 'application/json' } })
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error?.message || 'Unknown error', code: 'INTERNAL_ERROR' }), { status: 500, headers: { 'content-type': 'application/json' } })
  }
})
