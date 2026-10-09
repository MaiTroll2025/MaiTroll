import { supabase } from './supabase'

/* ============================================================================
 * 🛡️  CRITICAL STREAMING INFRASTRUCTURE - PROTECTED
 *
 * This library initializes streams for Troll Court sessions.
 * Calls POST /api/broadcasts/start-streaming to start the court broadcast.
 *
 * Court sessions are regular broadcasts with special metadata.
 * Modifying this breaks court streaming functionality.
 *
 * PROTECTION: This file is monitored by pre-commit hook.
 * Any changes require explicit confirmation during commit.
 * ============================================================================ */

export interface StartCourtSessionParams {
  sessionId: string
  maxBoxes: number
  roomName: string
  userId: string
  defendantId?: string
}

export interface CourtSessionData {
  id: string
  sessionId: string
  maxBoxes: number
  roomName: string
  status: 'active'
  created_at: string
  startedAt: string
  defendantId?: string
}

export async function startCourtSession(params: StartCourtSessionParams): Promise<{ data: CourtSessionData | null, error: any }> {
  try {
    const { sessionId, maxBoxes, roomName, userId, defendantId } = params
    const now = new Date().toISOString()

    let safeDefendantId: string | null = null
    if (defendantId) {
      const { data: defendantProfile } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('id', defendantId)
        .maybeSingle()

      if (defendantProfile?.id) {
        safeDefendantId = defendantProfile.id
      }
    }

    // Prevent starting a second active/live session
    const { data: existingActive } = await supabase
      .from('court_sessions')
      .select('*')
      .in('status', ['active', 'live'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (existingActive) {
      return {
        data: null,
        error: new Error('A court session is already active')
      }
    }

    // Reuse the waiting slot whenever one exists instead of inserting a conflicting row
    const { data: waitingSession, error: waitingError } = await supabase
      .from('court_sessions')
      .select('*')
      .eq('status', 'waiting')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (waitingError) {
      console.error('Error checking waiting court session:', waitingError)
      return { data: null, error: waitingError }
    }

    const _targetId = waitingSession ? waitingSession.id : sessionId

    const payload = {
      status: 'active',
      started_by: userId,
      started_at: now,
      updated_at: now,
      max_boxes: maxBoxes,
      room_name: roomName,
      defendant_id: safeDefendantId
    }

    const response = waitingSession
      ? await supabase
          .from('court_sessions')
          .update(payload)
          .eq('id', waitingSession.id)
          .select('*')
      : await supabase
          .from('court_sessions')
          .insert({
            id: sessionId,
            session_id: sessionId,
            created_at: now,
            ...payload
          })
          .select('*')

    if (response.error) {
      console.error('Error creating court session:', response.error)
      return { data: null, error: response.error }
    }

    if (!response.data || response.data.length === 0) {
      const err = new Error('Court session was not created or updated successfully.');
      console.error(err, { response });
      return { data: null, error: err };
    }

    const data = response.data[0];

    // Create/update a public stream for viewers to watch the court session
    try {
      const courtChannel = `troll-court-${data.id}`
      const { error: streamError } = await supabase.from('streams').insert({
        user_id: userId,
        broadcaster_id: userId,
        title: `Troll Court Session - ${new Date().toLocaleDateString()}`,
        category: 'court',
        status: 'live',
        is_live: true,
        started_at: now,
        agora_channel: courtChannel,
        box_count: maxBoxes,
        layout_mode: 'grid',
        is_protected: false,
        battle_enabled: false,
      })

      if (streamError) {
        console.error('Error upserting court stream:', streamError)
      }
    } catch (streamCreateError) {
      console.error('Error in court stream creation:', streamCreateError)
    }

    return {
      data: {
        id: data.id,
        sessionId: data.session_id || data.id,
        maxBoxes: data.max_boxes,
        roomName: data.room_name,
        status: data.status,
        created_at: data.created_at,
        startedAt: data.started_at,
        defendantId: data.defendant_id
      },
      error: null
    }
  } catch (err) {
    console.error('Error in startCourtSession:', err)
    return { data: null, error: err }
  }
}
