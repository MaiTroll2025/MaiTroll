/**
 * MKey claim-on-join hook.
 *
 * Rule 9 + Rule 14: the MKey is claimed when the invited user actually joins,
 * and only the server may decide that. This hook does one thing — once a real
 * broadcast session has been established on this page, it asks the server to
 * verify and settle any pending invitation.
 *
 * The server may answer "verifying_session", meaning the recipient has been
 * seen inside the broadcast but must still be here in a few seconds. We simply
 * ask again. We never mark anything as claimed ourselves.
 */

import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { claimMKeyOnJoin } from '../lib/mkeys'

interface UseMKeyJoinClaimOptions {
  /** The broadcast the viewer is currently inside. */
  broadcastId: string | null | undefined
  /** Only true once a genuine viewer/seat session exists for this user. */
  sessionEstablished: boolean
  /** Signed-in viewer id. Anonymous viewers cannot hold invitations. */
  userId: string | null | undefined
  onClaimed?: () => void
}

const MAX_ATTEMPTS = 6

export function useMKeyJoinClaim({
  broadcastId,
  sessionEstablished,
  userId,
  onClaimed,
}: UseMKeyJoinClaimOptions) {
  const [claimed, setClaimed] = useState(false)
  const settledKeyRef = useRef<string | null>(null)
  const onClaimedRef = useRef(onClaimed)

  useEffect(() => {
    onClaimedRef.current = onClaimed
  }, [onClaimed])

  useEffect(() => {
    if (!broadcastId || !userId || !sessionEstablished) return

    const key = `${broadcastId}:${userId}`
    if (settledKeyRef.current === key) return

    let cancelled = false
    let timer: number | null = null
    let attempts = 0

    const attempt = async () => {
      if (cancelled) return
      attempts += 1

      const result = await claimMKeyOnJoin(broadcastId)
      if (cancelled) return

      if (result.claimed) {
        settledKeyRef.current = key
        setClaimed(true)
        toast.success('🔑 MKey claimed — thanks for joining!')
        onClaimedRef.current?.()
        return
      }

      // The server has seen us inside the broadcast but wants proof we stayed.
      if (result.reason === 'verifying_session' && attempts < MAX_ATTEMPTS) {
        const waitSeconds = Math.min(Math.max(result.retryAfterSeconds ?? 5, 1), 30)
        timer = window.setTimeout(() => void attempt(), waitSeconds * 1000)
        return
      }

      // No invitation for this broadcast, or it lapsed. Nothing to settle.
      settledKeyRef.current = key
    }

    // Give presence a beat to land before asking the server to verify it.
    timer = window.setTimeout(() => void attempt(), 1500)

    return () => {
      cancelled = true
      if (timer) window.clearTimeout(timer)
    }
  }, [broadcastId, sessionEstablished, userId])

  return { claimed }
}
