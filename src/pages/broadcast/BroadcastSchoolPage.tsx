import React, { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { CardContent } from '@/components/ui/card'
import { CardHeader } from '@/components/ui/card'
import { CardTitle } from '@/components/ui/card'
import { CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ShieldAlert, UserPlus, Clock } from 'lucide-react'
import { toast } from 'sonner'
import BroadcastSchoolAssessment from '@/components/broadcast/BroadcastSchoolAssessment'
import BroadcastSchoolReviewStatus from '@/components/broadcast/BroadcastSchoolReviewStatus'
import BroadcastSchoolTimer from '@/components/broadcast/BroadcastSchoolTimer'
import BroadcastSchoolReferralModal from '@/components/broadcast/BroadcastSchoolReferralModal'

interface BroadcastSchoolStatus {
  user_id: string
  in_broadcast_school: boolean
  review_status: string
  attempts_count: number
  cooldown_until: string | null
  completed_at: string | null
  referral: {
    id: string
    reason: string
    status: string
    referred_at: string
    referred_by: string | null
  } | null
  latest_attempt: {
    id: string
    score: number
    passed: boolean
    submitted_at: string | null
    attempts_count: number
  } | null
  latest_review: {
    id: string
    status: string
    reviewer_id: string | null
    reviewed_at: string | null
    review_notes: string | null
  } | null
}

interface BroadcastSchoolPageProps {
  _referralId?: string | null
}

export default function BroadcastSchoolPage({ _referralId }: BroadcastSchoolPageProps) {
  const { user, profile } = useAuthStore()
  const [status, setStatus] = useState<BroadcastSchoolStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [assessmentComplete, setAssessmentComplete] = useState(false)
  const [referralModalOpen, setReferralModalOpen] = useState(false)
  const [referralTargetId, setReferralTargetId] = useState('')

  const fetchStatus = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)
    try {
      const { data, error } = await supabase.rpc('get_broadcast_school_status', {
        p_user_id: user.id,
      })

      if (error) {
        console.error('[BroadcastSchoolPage] RPC error:', error)
        toast.error(error?.message || 'Failed to load Broadcast School status.')
        setLoading(false)
        return
      }

      setStatus(data?.data ?? null)
    } catch (err) {
      console.error('[BroadcastSchoolPage] Exception:', err)
      toast.error('An unexpected error occurred.')
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  useEffect(() => {
    void fetchStatus()
  }, [fetchStatus])

  const handleAssessmentComplete = useCallback(() => {
    setAssessmentComplete(true)
    void fetchStatus()
  }, [fetchStatus])

  const canTakeAssessment = status
    ? status.in_broadcast_school && status.review_status !== 'passed'
    : false

  const isStaff = Boolean(
    profile?.is_admin ||
      profile?.is_lead_officer ||
      profile?.is_troll_officer ||
      profile?.role === 'admin' ||
      profile?.role === 'superadmin' ||
      profile?.is_officer ||
      String(profile?.role) === 'staff'
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4 bg-slate-950">
        <div className="flex flex-col items-center space-y-3">
          <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-400">Loading Broadcast School status...</p>
        </div>
      </div>
    )
  }

  if (!status) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4 bg-slate-950">
        <Card className="w-full max-w-md rounded-3xl border border-slate-700/50 p-6 shadow-2xl">
          <CardHeader>
            <CardTitle className="text-white">Broadcast School</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-slate-400">
              Unable to load your Broadcast School status. Please try again.
            </p>
          </CardContent>
          <CardContent className="pt-4">
            <Button onClick={() => window.location.reload()} className="w-full">
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Staff view: referral management
  if (isStaff && !status.in_broadcast_school && status.review_status === 'none') {
    return (
      <div className="flex items-center justify-center min-h-screen p-4 bg-slate-950">
        <Card className="w-full max-w-2xl rounded-3xl border border-slate-700/50 p-6 shadow-2xl">
          <CardHeader className="pb-4">
            <div className="flex items-center space-x-3">
              <ShieldAlert size={28} className="text-amber-400" />
              <CardTitle className="font-bold text-white">Broadcast School Referral</CardTitle>
            </div>
            <CardDescription className="text-slate-400">
              Refer a broadcaster to Broadcast School when they require moderation-based retraining.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-slate-400 text-sm mb-4">
              You are viewing this as a staff member. Enter the target user ID to refer them to
              Broadcast School.
            </p>
            <div className="space-y-4">
              <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
                <Label className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2 block">
                  Target User ID
                </Label>
                <Input
                  value={referralTargetId}
                  onChange={(e) => setReferralTargetId(e.target.value)}
                  placeholder="Enter user UUID..."
                  className="bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
              <Button
                onClick={() => {
                  if (!referralTargetId) {
                    toast.error('Please enter a target user ID.')
                    return
                  }
                  setReferralModalOpen(true)
                }}
                className="w-full bg-gradient-to-r from-amber-400 to-orange-500 text-black font-bold py-3"
              >
                Open Referral Form
              </Button>
            </div>

            <BroadcastSchoolReferralModal
              isOpen={referralModalOpen}
              onClose={() => setReferralModalOpen(false)}
              targetUserId={referralTargetId || undefined}
              targetUsername={undefined}
              targetStreamId={undefined}
              onReferralCreated={() => {
                setReferralModalOpen(false)
                setReferralTargetId('')
                void fetchStatus()
              }}
            />
          </CardContent>
        </Card>
      </div>
    )
  }

  // User in broadcast school - show assessment or review status
  if (status.in_broadcast_school) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4 bg-slate-950">
        <div className="w-full max-w-3xl">
          <div className="flex items-center justify-between mb-6">
            <Card className="flex-1 rounded-3xl border border-slate-700/50 p-6">
              <CardHeader>
                <div className="flex items-center space-x-3">
                  <ShieldAlert size={28} className="text-amber-400" />
                  <CardTitle className="font-bold text-white">Broadcast School</CardTitle>
                </div>
                <CardDescription className="text-slate-400">
                  You have been referred to Broadcast School. Complete the assessment below.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-4">
                <BroadcastSchoolReviewStatus
                  inBroadcastSchool={status.in_broadcast_school}
                  reviewStatus={status.review_status}
                  attemptsCount={status.attempts_count}
                  cooldownUntil={status.cooldown_until}
                  completedAt={status.completed_at}
                />
                {status.referral && (
                  <div className="mt-4 p-3 bg-slate-800/50 rounded-lg border border-slate-700/30">
                    <p className="text-xs text-slate-400 mb-1">Referral Reason</p>
                    <p className="text-sm text-white">{status.referral.reason}</p>
                    <p className="text-xs text-slate-500 mt-1">
                      Referred: {new Date(status.referral.referred_at).toLocaleString()}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {canTakeAssessment && !assessmentComplete ? (
            <BroadcastSchoolAssessment
              _referralId={null}
              onComplete={handleAssessmentComplete}
            />
          ) : null}

          {!canTakeAssessment && !assessmentComplete && status.review_status === 'pending' && (
            <Card className="mt-6 rounded-3xl border border-slate-700/50 bg-blue-500/10 p-6">
              <CardHeader>
                <CardTitle className="text-white font-bold">Pending Staff Review</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-slate-300">
                  Your assessment has been submitted and is awaiting review by the moderation team.
                  You will be notified once your review is complete. You cannot start a broadcast
                  until you are cleared.
                </p>
                <div className="mt-4 flex items-center space-x-2">
                  <Clock size={16} className="text-blue-400" />
                  <span className="text-xs text-blue-300">
                    Check back later for your review result.
                  </span>
                </div>
              </CardContent>
            </Card>
          )}

          {!canTakeAssessment && !assessmentComplete && status.review_status === 'failed' && (
            <Card className="mt-6 rounded-3xl border border-slate-700/50 bg-amber-500/10 p-6">
              <CardHeader>
                <CardTitle className="text-white font-bold">Assessment Not Passed</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-slate-300">
                  You did not pass the assessment. You may retry after your cooldown period expires.
                </p>
                {status.cooldown_until && (
                  <div className="mt-4">
                    <BroadcastSchoolTimer cooldownUntil={status.cooldown_until} />
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {!canTakeAssessment && !assessmentComplete && status.review_status === 'requires_officer_review' && (
            <Card className="mt-6 rounded-3xl border border-slate-700/50 bg-amber-500/10 p-6">
              <CardHeader>
                <CardTitle className="text-white font-bold">Officer Review Required</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-slate-300">
                  You have failed the assessment 3 times. An officer must review your case before you
                  can retry or start a broadcast. Please wait for a moderator to review your submission.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    )
  }

  // User not in broadcast school - show info
  return (
    <div className="flex items-center justify-center min-h-screen p-4 bg-slate-950">
      <Card className="w-full max-w-md rounded-3xl border border-slate-700/50 p-6 shadow-2xl">
        <CardHeader>
          <div className="flex items-center space-x-3">
            <UserPlus size={28} className="text-blue-400" />
            <CardTitle className="font-bold text-white">Broadcast School</CardTitle>
          </div>
          <CardDescription className="text-slate-400">
            Broadcast School is a moderation-based retraining program for broadcasters.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-400 mb-4">
            You are not currently enrolled in Broadcast School. If a staff member refers you here,
            you will need to complete the 10-question assessment and pass staff review before you
            can start broadcasting again.
          </p>
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
            <p className="text-xs text-slate-500 mb-2 uppercase tracking-wider font-bold">
              What to Expect
            </p>
            <ul className="text-sm text-slate-300 space-y-2 list-disc list-inside">
              <li>10 multiple-choice questions on broadcast rules</li>
              <li>Passing score: 70%</li>
              <li>Assessment reviewed by platform staff</li>
              <li>Cooldown period if you do not pass</li>
              <li>After 3 failed attempts, officer review is required</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
