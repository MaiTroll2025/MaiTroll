// src/hooks/useLiveViewer.ts
// ─────────────────────────────────────────────────────────────────────────────
// Shared LiveKit session logic for the VIEWER experience.
//
// Single source of truth for the LiveKit connection used by BOTH the web
// ViewerPage and the phone PhoneViewerPage. A viewer connects, subscribes to
// the broadcaster's published tracks, and tears down cleanly. The page that
// consumes this hook owns the (different) viewer layout.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useRef, useState } from 'react'
import { Room, RemoteParticipant } from 'livekit-client'
import { getLiveKitUrl } from './useLiveBroadcast'

export interface LiveViewerSession {
  roomRef: React.MutableRefObject<Room | null>
  isConnecting: boolean
  isConnected: boolean
  remoteParticipants: Map<string, RemoteParticipant>
  connect: () => Promise<void>
  disconnect: () => void
}

interface UseLiveViewerOptions {
  streamId: string
  onConnected?: (room: Room) => void
}

export function useLiveViewer({ streamId, onConnected }: UseLiveViewerOptions): LiveViewerSession {
  const roomRef = useRef<Room | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const [isConnected, setIsConnected] = useState(false)
  const [remoteParticipants, setRemoteParticipants] = useState<Map<string, RemoteParticipant>>(new Map())
  const livekitRoomDisconnectedCountRef = useRef(0)

  const syncRemoteParticipantSnapshots = useCallback(() => {
    const room = roomRef.current
    if (!room) return
    const next = new Map<string, RemoteParticipant>()
    room.remoteParticipants.forEach((p) => next.set(p.identity, p))
    setRemoteParticipants(next)
  }, [])

  const attachLiveKitHandlers = useCallback(
    (room: Room) => {
      room.on('participantConnected', syncRemoteParticipantSnapshots)
      room.on('participantDisconnected', syncRemoteParticipantSnapshots)
      room.on('trackSubscribed', syncRemoteParticipantSnapshots)
      room.on('trackUnsubscribed', syncRemoteParticipantSnapshots)
    },
    [syncRemoteParticipantSnapshots],
  )

  const detachLiveKitHandlers = useCallback((room: Room) => {
    room.removeAllListeners('participantConnected')
    room.removeAllListeners('participantDisconnected')
    room.removeAllListeners('trackSubscribed')
    room.removeAllListeners('trackUnsubscribed')
  }, [])

  const disconnectLiveKitRoom = useCallback(() => {
    const room = roomRef.current
    if (!room) return
    try {
      detachLiveKitHandlers(room)
    } catch {
      /* ignore */
    }
    try {
      room.removeAllListeners()
    } catch {
      /* ignore */
    }
    try {
      room.disconnect().catch(() => {})
    } catch {
      /* ignore */
    }
    roomRef.current = null
    livekitRoomDisconnectedCountRef.current += 1
  }, [detachLiveKitHandlers])

  const connect = useCallback(async () => {
    if (isConnecting) return
    setIsConnecting(true)
    try {
      const expectedRoomName = `stream_${streamId}`
      const { data: tokenData, error: tokenError } = await (
        await import('../lib/supabase')
      ).supabase.functions.invoke('livekit-token', {
        body: {
          room: expectedRoomName,
          identity: `viewer_${streamId}_${Math.random().toString(36).slice(2, 8)}`,
          metadata: { role: 'viewer', streamId },
        },
      })

      if (tokenError || !tokenData?.token) {
        console.error('[useLiveViewer] Failed to fetch LiveKit token', tokenError)
        return
      }

      const livekitUrl = getLiveKitUrl()
      if (!livekitUrl) return

      const room = new Room()
      roomRef.current = room
      attachLiveKitHandlers(room)

      if (room.state !== 'connected') {
        await room.connect(livekitUrl, tokenData.token)
      }

      syncRemoteParticipantSnapshots()
      setIsConnected(true)
      onConnected?.(room)
    } catch (err) {
      console.error('[useLiveViewer] connect failed', err)
    } finally {
      setIsConnecting(false)
    }
  }, [isConnecting, streamId, attachLiveKitHandlers, syncRemoteParticipantSnapshots, onConnected])

  const disconnect = useCallback(() => {
    disconnectLiveKitRoom()
    setRemoteParticipants(new Map())
    setIsConnected(false)
  }, [disconnectLiveKitRoom])

  useEffect(() => {
    return () => {
      disconnectLiveKitRoom()
    }
  }, [disconnectLiveKitRoom])

  return {
    roomRef,
    isConnecting,
    isConnected,
    remoteParticipants,
    connect,
    disconnect,
  }
}
