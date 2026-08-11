import React from 'react'
import { CheckCircle2, XCircle } from 'lucide-react'
import { resolveDisplayName } from '../../lib/streamCollaboration'
import type { CollaborationRequestRow } from '../../lib/streamCollaboration'

interface CollaborationRequestNotificationProps {
  request: CollaborationRequestRow | null
  onAccept: (request: CollaborationRequestRow) => Promise<void>
  onDecline: (request: CollaborationRequestRow) => Promise<void>
}

export default function CollaborationRequestNotification({ request, onAccept, onDecline }: CollaborationRequestNotificationProps) {
  if (!request) return null

  const expiresAt = request.expires_at ? new Date(request.expires_at).getTime() : Date.now() + 120000
  const remainingMs = Math.max(0, expiresAt - Date.now())
  const seconds = Math.ceil(remainingMs / 1000)

  return (
    <div className="fixed bottom-4 right-4 z-[10000] max-w-sm rounded-3xl border border-cyan-400/30 bg-slate-950/95 p-4 shadow-[0_0_40px_rgba(34,211,238,0.15)]">
      <div className="text-sm font-black text-white">Collaboration request</div>
      <div className="mt-2 text-sm text-slate-300">
        <span className="font-semibold text-cyan-200">{resolveDisplayName({ username: request.metadata?.requester_username as string | undefined }, 'Broadcaster')}</span> wants to collaborate with you.
      </div>
      <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
        <span>Expires in {seconds}s</span>
        <span>Shared chat and viewers will join the session</span>
      </div>
      <div className="mt-4 flex gap-2">
        <button type="button" onClick={() => void onAccept(request)} className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border border-emerald-400/30 bg-emerald-500/15 px-3 py-2 text-sm font-black text-emerald-100">
          <CheckCircle2 className="h-4 w-4" />
          Accept
        </button>
        <button type="button" onClick={() => void onDecline(request)} className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border border-rose-400/30 bg-rose-500/15 px-3 py-2 text-sm font-black text-rose-100">
          <XCircle className="h-4 w-4" />
          Decline
        </button>
      </div>
    </div>
  )
}
