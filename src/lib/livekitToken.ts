import { supabase } from '@/lib/supabase'

export type NormalizedLiveKitToken = {
  token: string
  roomName: string
  participantIdentity: string
}

export function normalizeLiveKitTokenResponse(
  raw: any,
  expectedRoomName: string,
  expectedIdentity: string
): NormalizedLiveKitToken {
  const token = raw?.token
  const roomName = raw?.roomName || raw?.room || raw?.livekit_room || expectedRoomName
  const participantIdentity =
    raw?.participantIdentity || raw?.identity || raw?.participantName || expectedIdentity

  if (!raw?.success && raw?.success !== undefined) {
    throw new Error(raw?.error || 'LiveKit token request failed')
  }
  if (!token || typeof token !== 'string') {
    throw new Error('LiveKit token response missing token')
  }
  if (!roomName || typeof roomName !== 'string') {
    throw new Error('LiveKit token response missing roomName')
  }
  if (!participantIdentity || typeof participantIdentity !== 'string') {
    throw new Error('LiveKit token response missing participantIdentity')
  }

  return { token, roomName, participantIdentity }
}

export async function requestLiveKitToken(
  roomName: string,
  userId: string
): Promise<NormalizedLiveKitToken> {
  const { data, error } = await supabase.functions.invoke('livekit-token', {
    body: {
      room: roomName,
      userId,
      identity: userId,
      role: 'publisher',
      isHost: true,
    },
  })

  if (error) {
    const statusCode =
      error?.status || error?.statusCode || error?.status_code || null
    const bodyText = error?.body || error?.message || JSON.stringify(error)
    throw new Error(
      `LiveKit token request failed${statusCode ? ` (${statusCode})` : ''}: ${bodyText}`
    )
  }

  return normalizeLiveKitTokenResponse(data, roomName, userId)
}
