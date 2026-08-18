import { useEffect, useState, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuthStore } from '@/lib/store'
import * as recordLabelService from '@/services/maiRecordLabel'
import { MaiTrollTheme } from '@/styles/trollCityTheme'
import { toast } from 'sonner'
import {
  ArrowLeft,
  Loader2,
  ShieldCheck,
  Wallet,
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import type { ArtistStaffMembershipResult, ArtistStaffPaymentResult } from '@/services/maiRecordLabel'

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-500/20 text-green-300 border-green-500/30',
  pending: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  suspended: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
  terminated: 'bg-red-500/20 text-red-300 border-red-500/30',
  declined: 'bg-gray-500/20 text-gray-300 border-gray-500/30',
  expired: 'bg-gray-500/20 text-gray-300 border-gray-500/30',
}

export default function ArtistStaffDetailPage() {
  const { membershipId } = useParams<{ membershipId: string }>()
  const navigate = useNavigate()
  const { user } = useAuthStore()

  const [loading, setLoading] = useState(true)
  const [member, setMember] = useState<ArtistStaffMembershipResult | null>(null)
  const [payments, setPayments] = useState<ArtistStaffPaymentResult[]>([])

  const [showSuspendDialog, setShowSuspendDialog] = useState(false)
  const [showTerminateDialog, setShowTerminateDialog] = useState(false)
  const [showReactivateDialog, setShowReactivateDialog] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)

  const load = useCallback(async () => {
    if (!user?.id || !membershipId) return

    try {
      setLoading(true)
      const artistResult = await recordLabelService.getArtistProfileByUserId(user.id)
      const artist = artistResult.data

      if (!artist) {
        toast.error('You must be an approved MAI artist.')
        navigate('/mai-record-label', { replace: true })
        return
      }

      const currentArtistId = artist.id

      const staffResult = await recordLabelService.getArtistStaff({ artistId: currentArtistId })
      if (staffResult.error) throw staffResult.error

      const found = (staffResult.data || []).find((s) => s.id === membershipId)
      if (!found) {
        toast.error('Staff member not found.')
        navigate('/artist/dashboard/staff')
        return
      }

      setMember(found)

      const paymentsResult = await recordLabelService.getArtistStaffPayments({ artistId: currentArtistId })
      if (paymentsResult.error) throw paymentsResult.error

      setPayments((paymentsResult.data || []).filter((p) => p.membership_id === membershipId))
    } catch (error: any) {
      console.error('[StaffDetail] Failed:', error)
      toast.error(error?.message || 'Failed to load staff details.')
    } finally {
      setLoading(false)
    }
  }, [user?.id, membershipId, navigate])

  useEffect(() => {
    load()
  }, [load])

  const handleSuspend = async () => {
    if (!membershipId) return
    setActionLoading(true)
    try {
      const { error } = await recordLabelService.suspendArtistStaffMember({ membershipId })
      if (error) throw error
      toast.success('Staff member suspended.')
      setShowSuspendDialog(false)
      load()
    } catch (error: any) {
      toast.error(error?.message || 'Failed to suspend staff member.')
    } finally {
      setActionLoading(false)
    }
  }

  const handleTerminate = async () => {
    if (!membershipId) return
    setActionLoading(true)
    try {
      const { error } = await recordLabelService.terminateArtistStaffMember({ membershipId })
      if (error) throw error
      toast.success('Staff member terminated.')
      setShowTerminateDialog(false)
      load()
    } catch (error: any) {
      toast.error(error?.message || 'Failed to terminate staff member.')
    } finally {
      setActionLoading(false)
    }
  }

  const handleReactivate = async () => {
    if (!membershipId) return
    setActionLoading(true)
    try {
      const { error } = await recordLabelService.reactivateArtistStaffMember({ membershipId })
      if (error) throw error
      toast.success('Staff member reactivated.')
      setShowReactivateDialog(false)
      load()
    } catch (error: any) {
      toast.error(error?.message || 'Failed to reactivate staff member.')
    } finally {
      setActionLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0814] text-white flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 mx-auto mb-4 animate-spin text-cyan-400" />
          <p className="text-lg text-slate-300">Loading staff details...</p>
        </div>
      </div>
    )
  }

  if (!member) {
    return (
      <div className="min-h-screen bg-[#0A0814] text-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg text-slate-300">Staff member not found.</p>
          <Button onClick={() => navigate('/artist/dashboard/staff')} className={`${MaiTrollTheme.components.buttonPrimary} mt-4`}>
            Back to Team
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0A0814] text-white">
      <div className="mx-auto max-w-4xl px-4 py-8 md:px-6 lg:px-8">
        <button
          onClick={() => navigate('/artist/dashboard/staff')}
          className="mb-6 flex items-center gap-2 text-sm text-slate-400 transition hover:text-white"
        >
          <ArrowLeft size={18} />
          Back to Team
        </button>

        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-16 h-16 rounded-full bg-gray-700 flex items-center justify-center text-2xl text-gray-300">
              {(member.employee_display_name || member.employee_username || '?')[0]?.toUpperCase()}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">{member.employee_display_name || member.employee_username}</h1>
              <p className="text-gray-400">@{member.employee_username}</p>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className={STATUS_COLORS[member.status] || 'border-gray-500 text-gray-300'}>
                  {member.status}
                </Badge>
                <span className="text-sm text-gray-400">{member.position}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <Card className="bg-[#141414] border-[#2C2C2C]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wallet className="h-5 w-5 text-cyan-400" />
                Compensation
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-400">Pay Type</span>
                <span className="text-white font-medium">{member.pay_type}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Amount</span>
                <span className="text-white font-medium">{member.pay_amount.toLocaleString()} {member.pay_currency}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Frequency</span>
                <span className="text-white font-medium">{member.pay_frequency}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Start Date</span>
                <span className="text-white font-medium">{formatDate(member.accepted_at || member.start_date)}</span>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-[#141414] border-[#2C2C2C]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-purple-400" />
                Permissions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {Object.entries(member.permissions || {}).map(([key, value]) => (
                  value && (
                    <Badge key={key} variant="outline" className="bg-purple-500/10 text-purple-300 border-purple-500/30">
                      {key.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                    </Badge>
                  )
                ))}
                {Object.keys(member.permissions || {}).length === 0 && (
                  <span className="text-sm text-gray-400">No permissions granted.</span>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {member.notes && (
          <Card className="bg-[#141414] border-[#2C2C2C] mb-6">
            <CardHeader>
              <CardTitle>Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-300">{member.notes}</p>
            </CardContent>
          </Card>
        )}

        {payments.length > 0 && (
          <Card className="bg-[#141414] border-[#2C2C2C] mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wallet className="h-5 w-5 text-green-400" />
                Payment History
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {payments.map((payment) => (
                  <div key={payment.id} className="flex items-center justify-between p-3 rounded-lg bg-black/30 border border-[#2C2C2C]">
                    <div>
                      <p className="text-white font-medium">{payment.amount.toLocaleString()} {payment.currency}</p>
                      <p className="text-sm text-gray-400">{formatDate(payment.created_at)}</p>
                    </div>
                    <Badge variant="outline" className={STATUS_COLORS[payment.status] || 'border-gray-500 text-gray-300'}>
                      {payment.status}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="bg-[#141414] border-[#2C2C2C]">
          <CardHeader>
            <CardTitle>Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {member.status === 'active' && (
                <>
                  <Button
                    onClick={() => setShowSuspendDialog(true)}
                    variant="outline"
                    className="border-orange-500/30 text-orange-300 hover:bg-orange-500/10"
                  >
                    Suspend
                  </Button>
                  <Button
                    onClick={() => setShowTerminateDialog(true)}
                    variant="destructive"
                  >
                    Terminate
                  </Button>
                </>
              )}
              {member.status === 'suspended' && (
                <>
                  <Button
                    onClick={() => setShowReactivateDialog(true)}
                    className={MaiTrollTheme.components.buttonPrimary}
                  >
                    Reactivate
                  </Button>
                  <Button
                    onClick={() => setShowTerminateDialog(true)}
                    variant="destructive"
                  >
                    Terminate
                  </Button>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={showSuspendDialog} onOpenChange={setShowSuspendDialog}>
        <DialogContent className="bg-[#141414] border-[#2C2C2C] text-white">
          <DialogHeader>
            <DialogTitle>Suspend Staff Member?</DialogTitle>
          </DialogHeader>
          <p className="text-gray-400">This will immediately remove their access to your artist workspace.</p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowSuspendDialog(false)} disabled={actionLoading}>
              Cancel
            </Button>
            <Button onClick={handleSuspend} disabled={actionLoading} className="bg-orange-600 hover:bg-orange-500">
              {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Suspend'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showTerminateDialog} onOpenChange={setShowTerminateDialog}>
        <DialogContent className="bg-[#141414] border-[#2C2C2C] text-white">
          <DialogHeader>
            <DialogTitle>Terminate Staff Member?</DialogTitle>
          </DialogHeader>
          <p className="text-gray-400">This will permanently end their employment. This action cannot be undone.</p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowTerminateDialog(false)} disabled={actionLoading}>
              Cancel
            </Button>
            <Button onClick={handleTerminate} disabled={actionLoading} variant="destructive">
              {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Terminate'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showReactivateDialog} onOpenChange={setShowReactivateDialog}>
        <DialogContent className="bg-[#141414] border-[#2C2C2C] text-white">
          <DialogHeader>
            <DialogTitle>Reactivate Staff Member?</DialogTitle>
          </DialogHeader>
          <p className="text-gray-400">This will restore their access to your artist workspace.</p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowReactivateDialog(false)} disabled={actionLoading}>
              Cancel
            </Button>
            <Button onClick={handleReactivate} disabled={actionLoading} className={MaiTrollTheme.components.buttonPrimary}>
              {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Reactivate'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
