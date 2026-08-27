import React, { useState } from 'react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/lib/store'
import {
  X,
  Hammer,
  ShieldCheck,
  AlertTriangle,
  Coins,
  Check,
} from 'lucide-react'

interface RaidModalProps {
  isOpen: boolean
  onClose: () => void
  targetUserId: string
  targetUsername: string
  targetAvatarUrl?: string | null
  streamId: string
  mode?: 'raid' | 'repair'
  onRaidComplete?: () => void
}

export default function RaidModal({
  isOpen,
  onClose,
  targetUserId,
  targetUsername,
  targetAvatarUrl,
  streamId,
  mode = 'raid',
  onRaidComplete,
}: RaidModalProps) {
  const { user, profile } = useAuthStore()
  const [loading, setLoading] = useState(false)
  const [blocked, setBlocked] = useState(false)
  const [remainingBlockers, setRemainingBlockers] = useState(0)
  const [success, setSuccess] = useState(false)

  if (!isOpen) return null

  const handleAction = async () => {
    if (!user || !profile) {
      toast.error('You must be logged in')
      return
    }

    setLoading(true)
    setBlocked(false)
    setRemainingBlockers(0)

    try {
      if (mode === 'repair') {
        const { data, error } = await supabase.rpc('repair_broadcast', {
          p_broadcast_id: streamId,
          p_repairer_id: user.id,
        })

        if (error) throw error

        if (data?.success) {
          setSuccess(true)
          toast.success(data.message || 'Broadcast repaired!')
          onRaidComplete?.()
          setTimeout(onClose, 1500)
        } else {
          toast.error(data?.message || 'Repair failed')
        }
      } else {
        const { data, error } = await supabase.rpc('raid_broadcast', {
          p_broadcaster_id: targetUserId,
          p_raider_id: user.id,
          p_stream_id: streamId,
          p_coins_spent: 25,
        })

        if (error) throw error

        if (data?.blocked) {
          setBlocked(true)
          setRemainingBlockers(data.remaining_blockers || 0)
          toast.success(`Property raid was blocked! ${data.remaining_blockers} blockers remaining.`)
        } else {
          setSuccess(true)
          toast.success(`You raided ${targetUsername}'s property! -25 coins`)
        }

        onRaidComplete?.()
      }
    } catch (err: any) {
      toast.error(err.message || `Failed to ${mode}`)
    } finally {
      setLoading(false)
    }
  }

  const userCoins = profile?.hype_coins || 0
  const canAfford = mode === 'raid' ? userCoins >= 25 : true

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-sm overflow-hidden rounded-3xl border border-white/10 bg-[#0a0b14] shadow-[0_20px_60px_rgba(0,0,0,0.6)]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
          <div className="flex items-center gap-2">
            {mode === 'repair' ? (
              <Hammer size={16} className="text-cyan-400" />
            ) : (
              <Hammer size={16} className="text-red-400" />
            )}
            <h3 className="text-sm font-black text-white uppercase tracking-wider">
              {mode === 'repair' ? 'Repair Property' : 'Raid Property'}
            </h3>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-zinc-500 hover:text-white"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="space-y-4 px-5 py-5">
          {/* Target info */}
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 overflow-hidden rounded-full border border-white/10 bg-[#0a0b14]">
              {targetAvatarUrl ? (
                <img
                  src={targetAvatarUrl}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className={cn(
                  'flex h-full w-full items-center justify-center',
                  mode === 'repair'
                    ? 'bg-gradient-to-br from-cyan-700 to-blue-700'
                    : 'bg-gradient-to-br from-red-700 to-orange-700'
                )}>
                  <span className="text-lg font-black text-white">
                    {targetUsername[0]?.toUpperCase()}
                  </span>
                </div>
              )}
            </div>

            <div>
              <p className="text-sm font-black text-white">
                {targetUsername}
              </p>
              <p className="text-[10px] font-bold text-zinc-500">
                Broadcast Property
              </p>
            </div>
          </div>

          {/* Cost info */}
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.025] p-3">
            {mode === 'repair' ? (
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-zinc-500">
                  Repair Cost
                </span>
                <span className="flex items-center gap-1 text-xs font-black text-cyan-300">
                  <Coins size={12} />
                  25 coins
                </span>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider text-zinc-500">
                    Raid Cost
                  </span>
                  <span className="flex items-center gap-1 text-xs font-black text-yellow-300">
                    <Coins size={12} />
                    25 coins
                  </span>
                </div>

                <div className="mt-2 flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider text-zinc-500">
                    Your Balance
                  </span>
                  <span className={cn(
                    'text-xs font-black',
                    canAfford ? 'text-emerald-300' : 'text-red-300'
                  )}>
                    {userCoins.toLocaleString()}
                  </span>
                </div>
              </>
            )}
          </div>

          {/* Blocked result */}
          {blocked && (
            <div className="rounded-xl border border-cyan-400/20 bg-cyan-400/10 p-3">
              <div className="flex items-start gap-2">
                <ShieldCheck size={16} className="mt-0.5 shrink-0 text-cyan-300" />
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-cyan-300">
                    Raid Blocked
                  </p>
                  <p className="mt-1 text-[10px] font-bold text-zinc-400">
                    This property has {remainingBlockers} blocker{remainingBlockers !== 1 ? 's' : ''} remaining. Your coins were spent but the raid was stopped!
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Success result */}
          {success && !blocked && mode === 'raid' && (
            <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-3">
              <div className="flex items-start gap-2">
                <Check size={16} className="mt-0.5 shrink-0 text-emerald-300" />
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-emerald-300">
                    Raid Successful
                  </p>
                  <p className="mt-1 text-[10px] font-bold text-zinc-400">
                    You raided {targetUsername}'s property!
                  </p>
                </div>
              </div>
            </div>
          )}

          {success && mode === 'repair' && (
            <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-3">
              <div className="flex items-start gap-2">
                <Check size={16} className="mt-0.5 shrink-0 text-emerald-300" />
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-emerald-300">
                    Repaired
                  </p>
                  <p className="mt-1 text-[10px] font-bold text-zinc-400">
                    Broadcast property repaired successfully!
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Warning */}
          {!blocked && !success && mode === 'raid' && (
            <div className="flex items-start gap-2 rounded-xl border border-amber-400/10 bg-amber-400/5 p-3">
              <AlertTriangle size={14} className="mt-0.5 shrink-0 text-amber-300" />
              <p className="text-[10px] font-bold text-zinc-400">
                Raiding will spend 25 coins. If the property has blockers active, your raid will be blocked but coins are still spent.
              </p>
            </div>
          )}

          {!blocked && !success && mode === 'repair' && (
            <div className="flex items-start gap-2 rounded-xl border border-amber-400/10 bg-amber-400/5 p-3">
              <AlertTriangle size={14} className="mt-0.5 shrink-0 text-amber-300" />
              <p className="text-[10px] font-bold text-zinc-400">
                Repairing will cost 25 coins. The coins will go to the property owner.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-white/[0.06] px-5 py-4">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 rounded-xl border border-white/10 bg-white/[0.04] py-3 text-[10px] font-black uppercase tracking-wider text-zinc-400 transition hover:bg-white/[0.08] hover:text-white disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleAction}
              disabled={loading || (!canAfford && mode === 'raid')}
              className={cn(
                'flex-1 rounded-xl py-3 text-[10px] font-black uppercase tracking-wider transition disabled:opacity-50',
                mode === 'repair'
                  ? 'border border-cyan-400/30 bg-gradient-to-r from-cyan-500/20 to-blue-500/20 text-cyan-200 hover:from-cyan-500/30 hover:to-blue-500/30'
                  : canAfford
                    ? 'border border-red-400/30 bg-gradient-to-r from-red-500/20 to-orange-500/20 text-red-200 hover:from-red-500/30 hover:to-orange-500/30'
                    : 'border border-white/5 bg-white/[0.02] text-zinc-600 cursor-not-allowed'
              )}
            >
              {loading ? 'Processing...' : blocked ? 'Blocked' : success ? 'Done' : mode === 'repair' ? 'Repair' : 'Raid'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ')
}
