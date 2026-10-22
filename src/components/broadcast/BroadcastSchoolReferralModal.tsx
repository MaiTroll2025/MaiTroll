import React, { useCallback, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card } from '@/components/ui/card'
import { CardContent } from '@/components/ui/card'
import { CardHeader } from '@/components/ui/card'
import { CardTitle } from '@/components/ui/card'
import { CardDescription } from '@/components/ui/card'
import { AlertCircle, ShieldAlert, Clock } from 'lucide-react'
import { toast } from 'sonner'

interface BroadcastSchoolReferralModalProps {
  isOpen: boolean
  onClose: () => void
  targetUserId?: string | null
  targetUsername?: string | null
  targetStreamId?: string | null
  onReferralCreated?: (referralId: string) => void
}

export default function BroadcastSchoolReferralModal({
  isOpen,
  onClose,
  targetUserId,
  targetUsername,
  targetStreamId,
  onReferralCreated,
}: BroadcastSchoolReferralModalProps) {
  const { profile } = useAuthStore()
  const [reason, setReason] = useState('')
  const [cooldownMinutes, setCooldownMinutes] = useState(60)
  const [loading, setLoading] = useState(false)

  const isStaff = Boolean(
    profile?.is_admin ||
      profile?.is_lead_officer ||
      profile?.is_troll_officer ||
      profile?.role === 'admin' ||
      profile?.role === 'superadmin' ||
      profile?.is_officer ||
      String(profile?.role) === 'staff'
  )

  const defaultReasons = [
    'Failure to engage with broadcast chat',
    'Extended silence during active broadcast',
    'Violation of broadcast community guidelines',
    'Repeated moderator warnings unaddressed',
    'Broadcast disruption or trolling',
  ]

  const handleSubmit = useCallback(async () => {
    if (!isStaff) {
      toast.error('Only staff can refer users to Broadcast School.')
      return
    }
    if (!targetUserId) {
      toast.error('No target user specified.')
      return
    }
    if (!reason.trim()) {
      toast.error('Please provide a reason for the referral.')
      return
    }

    setLoading(true)
    try {
      const { data, error } = await supabase.rpc('refer_to_broadcast_school', {
        p_target_user_id: targetUserId,
        p_reason: reason.trim(),
        p_stream_id: targetStreamId ?? null,
        p_cooldown_minutes: cooldownMinutes,
      })

      if (error) {
        console.error('[BroadcastSchoolReferralModal] RPC error:', error)
        toast.error(error?.message || 'Failed to create referral.')
        setLoading(false)
        return
      }

      if (!data?.success) {
        toast.error(data?.message || 'Failed to create referral.')
        setLoading(false)
        return
      }

      toast.success('User referred to Broadcast School.')
      onReferralCreated?.(data.data?.referral_id)
      onClose()
    } catch (err) {
      console.error('[BroadcastSchoolReferralModal] Exception:', err)
      toast.error('An unexpected error occurred.')
    } finally {
      setLoading(false)
    }
  }, [isStaff, targetUserId, reason, targetStreamId, cooldownMinutes, onReferralCreated, onClose])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-slate-950/95 p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <ShieldAlert size={28} className="text-amber-400" />
            <h2 className="text-xl font-bold text-white">Refer to Broadcast School</h2>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            ×
          </Button>
        </div>

        {!isStaff && (
          <Card className="border-red-500/30 bg-red-500/10 mb-6 p-4">
            <CardHeader className="flex flex-row items-center space-x-2">
              <AlertCircle size={16} className="text-red-400" />
              <CardTitle className="text-sm font-bold text-red-400">Staff Only</CardTitle>
            </CardHeader>
            <CardDescription className="text-xs text-red-300">
              You do not have staff privileges to create Broadcast School referrals.
            </CardDescription>
          </Card>
        )}

        <Card className="border-slate-700/50 mb-6 p-4">
          <CardHeader>
            <CardTitle className="font-bold text-white text-sm">Target User</CardTitle>
            <CardDescription className="text-xs text-slate-400">
              {targetUsername || 'Unknown user'} ({targetUserId || '—'})
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-3">
            <p className="text-xs text-slate-400 mb-3">
              Stream: {targetStreamId || 'None (general referral)'}
            </p>

            <div className="space-y-3">
              <Label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Referral Reason
              </Label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                <option value="">Select a reason...</option>
                {defaultReasons.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
                <option value="custom">Custom reason</option>
              </select>
              {reason === 'custom' && (
                <Textarea
                  label="Custom Reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Enter a custom reason for the referral..."
                  className="mt-2"
                />
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-700/50 p-4">
          <CardHeader className="flex flex-row items-center space-x-2">
            <Clock size={16} className="text-amber-400" />
            <CardTitle className="font-bold text-white text-sm">Cooldown Period</CardTitle>
          </CardHeader>
          <CardContent className="pt-3">
            <p className="text-xs text-slate-400 mb-3">
              How long the user is blocked from starting broadcasts after the referral.
            </p>
            <div className="flex items-center space-x-2">
              <Input
                type="number"
                min="0"
                value={cooldownMinutes}
                onChange={(e) => setCooldownMinutes(Math.max(0, Number(e.target.value) || 0))}
                className="w-24 bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
              <span className="text-xs text-slate-500">minutes</span>
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col sm:flex-row gap-3 pt-6">
          <Button
            onClick={handleSubmit}
            disabled={loading || !isStaff || !reason.trim()}
            className="w-full sm:w-auto bg-gradient-to-r from-amber-400 to-orange-500 text-black font-bold py-3"
          >
            {loading ? 'Referring...' : 'Create Referral'}
          </Button>
          <Button variant="secondary" onClick={onClose} className="w-full sm:w-auto py-3">
            Cancel
          </Button>
        </div>
      </div>
    </div>
  )
}
