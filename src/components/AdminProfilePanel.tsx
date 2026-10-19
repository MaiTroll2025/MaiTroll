import { useState, useEffect, useCallback } from 'react'
import { TrendingUp, TrendingDown } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../lib/store'
import { grantAdminLevels, deductAdminLevels, isAdmin } from '../lib/adminCoins'
import GhostModeAdminDetails from '@/components/admin/GhostModeAdminDetails'

interface AdminProfilePanelProps {
  userId: string
  username: string
}

type Action = 'grant_levels' | 'deduct_levels' | null

export default function AdminProfilePanel({ userId, username }: AdminProfilePanelProps) {
  const { user, profile } = useAuthStore()
  const [isAdminUser, setIsAdminUser] = useState(false)
  const [action, setAction] = useState<Action>(null)
  const [amount, setAmount] = useState<number>(1)
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [targetProfile, setTargetProfile] = useState<any>(null)

  const loadTargetProfile = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('user_profiles')
        .select('troll_coins, level')
        .eq('id', userId)
        .single()
      setTargetProfile(data)
    } catch (err) {
      console.error('Error loading target profile:', err)
    }
  }, [userId])

  useEffect(() => {
    setIsAdminUser(isAdmin(user, profile))
    loadTargetProfile()
  }, [userId, user, profile, loadTargetProfile])

  const handleGrant = async () => {
    if (!isAdminUser) {
      toast.error('Admin access required')
      return
    }

    if (amount <= 0) {
      toast.error('Amount must be greater than 0')
      return
    }

    setLoading(true)

    try {
      const result = await grantAdminLevels(userId, amount, reason)
      if (result.success) {
        toast.success(`+${amount} Level granted to ${username}`)
        setAmount(1)
        setReason('')
        await loadTargetProfile()
      } else {
        toast.error(result.error || 'Failed to grant levels')
      }
    } catch (err: any) {
      toast.error(err.message || 'Action failed')
    } finally {
      setLoading(false)
      setAction(null)
    }
  }

  const handleDeduct = async () => {
    if (!isAdminUser) {
      toast.error('Admin access required')
      return
    }

    if (amount <= 0) {
      toast.error('Amount must be greater than 0')
      return
    }

    setLoading(true)

    try {
      const result = await deductAdminLevels(userId, amount, reason)
      if (result.success) {
        toast.success(`-${amount} Level deducted from ${username}`)
        setAmount(1)
        setReason('')
        await loadTargetProfile()
      } else {
        toast.error(result.error || 'Failed to deduct levels')
      }
    } catch (err: any) {
      toast.error(err.message || 'Action failed')
    } finally {
      setLoading(false)
      setAction(null)
    }
  }

  if (!isAdminUser) {
    return null
  }

  return (
    <div className="bg-yellow-950/30 border border-yellow-600/40 rounded-lg p-4 space-y-4">
      <div className="text-sm font-semibold text-yellow-400">Admin Actions</div>
      <GhostModeAdminDetails userId={userId} canView={isAdminUser} />

      {/* Current Stats */}
      {targetProfile && (
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="bg-black/50 rounded p-2">
            <div className="text-gray-400">Troll Coins</div>
            <div className="text-yellow-400 font-bold">{targetProfile.troll_coins || 0}</div>
          </div>
          <div className="bg-black/50 rounded p-2">
            <div className="text-gray-400">Level</div>
            <div className="text-blue-400 font-bold">{targetProfile.level || 1}</div>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      {!action && (
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setAction('grant_levels')}
            className="flex items-center justify-center gap-1 px-3 py-2 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 rounded text-xs font-semibold transition-colors"
          >
            <TrendingUp className="w-3 h-3" />
            Grant Levels
          </button>
          <button
            onClick={() => setAction('deduct_levels')}
            className="flex items-center justify-center gap-1 px-3 py-2 bg-purple-600/20 hover:bg-purple-600/30 text-purple-400 rounded text-xs font-semibold transition-colors"
          >
            <TrendingDown className="w-3 h-3" />
            Deduct Levels
          </button>
        </div>
      )}

      {/* Action Forms */}
      {(action === 'grant_levels' || action === 'deduct_levels') && (
        <div className="space-y-3 p-3 bg-black/40 rounded">
          <div>
            <label className="text-xs text-gray-400 block mb-1">Levels</label>
            <input
              type="number"
              min="1"
              value={amount}
              onChange={(e) => setAmount(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-full px-2 py-1 bg-gray-800 border border-gray-700 rounded text-xs text-white"
            />
          </div>

          <div>
            <label className="text-xs text-gray-400 block mb-1">Reason (Optional)</label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g., Bug fix, Achievement..."
              className="w-full px-2 py-1 bg-gray-800 border border-gray-700 rounded text-xs text-white placeholder-gray-500"
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => action === 'grant_levels' ? handleGrant() : handleDeduct()}
              disabled={loading}
              className="flex-1 px-2 py-1 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 rounded text-xs font-semibold"
            >
              {loading ? 'Processing...' : action === 'grant_levels' ? 'Grant' : 'Deduct'}
            </button>
            <button
              onClick={() => setAction(null)}
              className="flex-1 px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs font-semibold"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
