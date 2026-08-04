import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || ''
)

async function isCEO(userId: string): Promise<boolean> {
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role, is_admin, is_ceo')
    .eq('id', userId)
    .maybeSingle()

  return !!(profile?.is_ceo || profile?.role === 'ceo' || profile?.is_admin)
}

export async function createGhostSession(req: VercelRequest, res: VercelResponse) {
  try {
    const body = await req.json()
    const { streamId, userId } = body

    if (!streamId || !userId) {
      return res.status(400).json({ error: 'streamId and userId required' })
    }

    const ceoCheck = await isCEO(userId)
    if (!ceoCheck) {
      return res.status(403).json({ error: 'Only CEOs can join ghost mode' })
    }

    const { data: stream } = await supabase
      .from('streams')
      .select('id, livekit_room_name, status, is_live')
      .eq('id', streamId)
      .maybeSingle()

    if (!stream || stream.status !== 'live') {
      return res.status(400).json({ error: 'Stream is not live' })
    }

    const { data: existingSession } = await supabase
      .from('ghost_stream_sessions')
      .select('id')
      .eq('stream_id', streamId)
      .eq('user_id', userId)
      .maybeSingle()

    if (existingSession) {
      return res.status(200).json({ 
        success: true, 
        message: 'Ghost session already exists',
        sessionId: existingSession.id 
      })
    }

    const { data, error } = await supabase
      .from('ghost_stream_sessions')
      .insert({
        stream_id: streamId,
        user_id: userId,
        joined_at: new Date().toISOString(),
        microphone_enabled: true,
        camera_enabled: false,
      })
      .select()
      .single()

    if (error) {
      return res.status(500).json({ error: error.message })
    }

    return res.status(200).json({
      success: true,
      sessionId: data.id,
      streamId: data.stream_id,
      roomName: stream.livekit_room_name || streamId,
    })

  } catch (err) {
    console.error('createGhostSession error:', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

export async function leaveGhostSession(req: VercelRequest, res: VercelResponse) {
  try {
    const body = await req.json()
    const { streamId, userId } = body

    if (!streamId || !userId) {
      return res.status(400).json({ error: 'streamId and userId required' })
    }

    const ceoCheck = await isCEO(userId)
    if (!ceoCheck) {
      return res.status(403).json({ error: 'Only CEOs can leave ghost sessions' })
    }

    const { error } = await supabase
      .from('ghost_stream_sessions')
      .delete()
      .eq('stream_id', streamId)
      .eq('user_id', userId)

    if (error) {
      return res.status(500).json({ error: error.message })
    }

    return res.status(200).json({ success: true, message: 'Ghost session ended' })

  } catch (err) {
    console.error('leaveGhostSession error:', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

export async function getGhostSessions(req: VercelRequest, res: VercelResponse) {
  try {
    const url = new URL(req.url)
    const streamId = url.searchParams.get('streamId')
    const userId = url.searchParams.get('userId')

    if (!streamId) {
      return res.status(400).json({ error: 'streamId required' })
    }

    const ceoCheck = await isCEO(userId || '')
    if (!ceoCheck) {
      return res.status(403).json({ error: 'Only CEOs can view ghost sessions' })
    }

    const { data, error } = await supabase
      .from('ghost_stream_sessions')
      .select('id, user_id, joined_at, microphone_enabled, camera_enabled')
      .eq('stream_id', streamId)

    if (error) {
      return res.status(500).json({ error: error.message })
    }

    return res.status(200).json({ success: true, sessions: data || [] })

  } catch (err) {
    console.error('getGhostSessions error:', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

export default {
  createGhostSession,
  leaveGhostSession,
  getGhostSessions,
}