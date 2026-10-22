import React from 'react'
import { AlertCircle, CheckCircle, Clock, ShieldAlert, User } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { CardContent } from '@/components/ui/card'
import { CardHeader } from '@/components/ui/card'
import { CardTitle } from '@/components/ui/card'

interface BroadcastSchoolReviewStatusProps {
  inBroadcastSchool: boolean
  reviewStatus: string | null
  attemptsCount: number
  cooldownUntil: string | null
  completedAt: string | null
}

export default function BroadcastSchoolReviewStatus({
  inBroadcastSchool,
  reviewStatus,
  attemptsCount,
  cooldownUntil,
  completedAt,
}: BroadcastSchoolReviewStatusProps) {
  const isInSchool = Boolean(inBroadcastSchool)
  const passed = reviewStatus === 'passed'
  const failed = reviewStatus === 'failed'
  const pending = reviewStatus === 'pending'

  const getStatusInfo = () => {
    if (passed) {
      return {
        label: 'Cleared to Broadcast',
        icon: <CheckCircle size={20} className="text-green-400" />,
        color: 'text-green-400',
        bg: 'bg-green-500/10 border-green-500/30',
      }
    }
    if (failed) {
      return {
        label: 'Assessment Not Passed',
        icon: <AlertCircle size={20} className="text-amber-400" />,
        color: 'text-amber-400',
        bg: 'bg-amber-500/10 border-amber-500/30',
      }
    }
    if (pending) {
      return {
        label: 'Pending Staff Review',
        icon: <Clock size={20} className="text-blue-400" />,
        color: 'text-blue-400',
        bg: 'bg-blue-500/10 border-blue-500/30',
      }
    }
    if (isInSchool) {
      return {
        label: 'In Broadcast School',
        icon: <ShieldAlert size={20} className="text-amber-400" />,
        color: 'text-amber-400',
        bg: 'bg-amber-500/10 border-amber-500/30',
      }
    }
    return {
      label: 'No Broadcast School Record',
      icon: <User size={20} className="text-slate-400" />,
      color: 'text-slate-400',
      bg: 'bg-slate-800 border-slate-600/50',
    }
  }

  const status = getStatusInfo()

  return (
    <Card className={`rounded-xl border ${status.bg} p-4`}>
      <CardHeader className="flex flex-row items-center space-x-3 pb-2">
        {status.icon}
        <CardTitle className="font-bold text-white text-sm">{status.label}</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Review Status</span>
            <span className={`font-mono ${status.color}`}>
              {reviewStatus?.toUpperCase() || 'NONE'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Attempts</span>
            <span className="font-mono text-white">{attemptsCount}</span>
          </div>
          {cooldownUntil && (
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Cooldown Until</span>
              <span className="font-mono text-amber-400">
                {new Date(cooldownUntil).toLocaleString()}
              </span>
            </div>
          )}
          {completedAt && (
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Completed At</span>
              <span className="font-mono text-green-400">
                {new Date(completedAt).toLocaleString()}
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
