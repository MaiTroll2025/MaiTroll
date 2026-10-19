import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface GhostModeDetails {
  username: string
  avatar_url: string | null
  ghost_mode_tier: string | null
  ghost_mode_active: boolean
  ghost_mode_expires_at: string | null
}

export default function GhostModeAdminDetails({
  userId,
  canView,
}: {
  userId: string
  canView: boolean
}) {
  const [details, setDetails] = useState<GhostModeDetails | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!canView || !userId) return
    let mounted = true
    void supabase.rpc('get_staff_ghost_profile', { p_target_user_id: userId }).then(({ data, error: rpcError }) => {
      if (!mounted) return
      if (rpcError) {
        console.error('[GhostModeAdminDetails] Failed to load protected profile:', rpcError)
        setError(true)
        return
      }
      const row = Array.isArray(data) ? data[0] : data
      setDetails(row?.ghost_mode_tier ? row as GhostModeDetails : null)
    })
    return () => { mounted = false }
  }, [canView, userId])

  if (!canView || (!details && !error)) return null
  if (error) {
    return <div className="mt-3 rounded border border-red-500/30 bg-red-950/30 p-2 text-xs text-red-200">Protected Ghost Mode details could not be loaded.</div>
  }
  if (!details) return null

  return (
    <div className="mt-3 flex items-center gap-3 rounded-lg border border-amber-400/30 bg-amber-950/20 p-3">
      {details.avatar_url && (
        <img src={details.avatar_url} alt={`${details.username}'s actual profile`} className="h-10 w-10 rounded-full object-cover" />
      )}
      <div className="min-w-0 text-xs">
        <div className="truncate font-semibold text-white">{details.username}</div>
        <div className={details.ghost_mode_active ? 'font-bold text-emerald-300' : 'text-slate-300'}>
          {details.ghost_mode_active ? 'Ghost Mode Active' : 'Ghost Mode Expired'} · {details.ghost_mode_tier}
        </div>
        {details.ghost_mode_expires_at && (
          <div className="mt-0.5 text-slate-400">
            Expires {new Date(details.ghost_mode_expires_at).toLocaleString()}
          </div>
        )}
      </div>
    </div>
  )
}
